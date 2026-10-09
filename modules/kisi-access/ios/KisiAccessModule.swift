import ExpoModulesCore
import SecureAccess
import Foundation
import CoreLocation

private final class KisiReaderPermission: NSObject, CLLocationManagerDelegate {
  private lazy var manager = CLLocationManager()
  private var pending: Promise?

  func start(_ promise: Promise) {
    guard pending == nil else {
      promise.reject(NSError(domain: "KisiAccess", code: 2, userInfo: [NSLocalizedDescriptionKey: "A reader permission request is already in progress."]))
      return
    }
    manager.delegate = self
    pending = promise
    if manager.authorizationStatus == .notDetermined {
      manager.requestWhenInUseAuthorization()
    } else {
      finish()
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { finish() }

  private func finish() {
    guard let promise = pending, manager.authorizationStatus != .notDetermined else { return }
    pending = nil
    guard manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse else {
      promise.reject(NSError(domain: "KisiAccess", code: 3, userInfo: [NSLocalizedDescriptionKey: "Allow location access in device settings to detect the nearby entrance reader."]))
      return
    }
    ReaderManager.shared.startMonitoring()
    ReaderManager.shared.startRanging()
    promise.resolve(nil)
  }
}

struct KisiCredential: Record {
  @Field var organizationId: Int = 0
  @Field var loginId: Int = 0
  @Field var secret: String = ""
  @Field var phoneKey: String = ""
  @Field var onlineCertificate: String = ""
  @Field var validFrom: Double = 0
  @Field var validUntil: Double = 0
}

private final class KisiDelegate: TapToAccessDelegate, @unchecked Sendable {
  private let lock = NSLock()
  private var credential: KisiCredential?
  private var partnerId = 0
  private var report: ((Bool, String?) -> Void)?

  func setReport(_ callback: ((Bool, String?) -> Void)?) {
    lock.lock()
    defer { lock.unlock() }
    report = callback
  }

  private func reportResult(_ success: Bool, _ error: String?) {
    lock.lock()
    let callback = report
    lock.unlock()
    callback?(success, error)
  }

  func configure(_ id: Int, _ value: KisiCredential?) {
    lock.lock()
    defer { lock.unlock() }
    partnerId = id
    credential = value
  }

  private func currentLogin(_ organization: Int?) -> Login? {
    lock.lock()
    defer { lock.unlock() }
    guard let value = credential else { return nil }
    let now = Date().timeIntervalSince1970 * 1000
    guard now >= value.validFrom, now < value.validUntil,
          organization == nil || organization == value.organizationId else { return nil }
    return Login(id: value.loginId, token: value.secret, key: value.phoneKey, certificate: value.onlineCertificate)
  }

  private func clientId() -> Int {
    lock.lock()
    defer { lock.unlock() }
    return partnerId
  }

  func tapToAccessClientID() async -> Int { clientId() }
  func tapToAccessLoginForOrganization(_ organization: Int?) async -> Login? { currentLogin(organization) }
  func tapToAccessSuccess(online: Bool, duration: TimeInterval) { reportResult(true, nil) }
  func tapToAccessFailure(error: TapToAccessError, duration: TimeInterval) {
    reportResult(false, "Kisi could not unlock the door. Check your booking access and reader connection.")
  }
}

public class KisiAccessModule: Module {
  private let kisiDelegate = KisiDelegate()
  private let readerPermission = KisiReaderPermission()

  public func definition() -> ModuleDefinition {
    Name("KisiAccess")
    Events("onUnlock", "onReaderError")
    AsyncFunction("startReaderScan") { (promise: Promise) in
      self.readerPermission.start(promise)
    }.runOnQueue(.main)
    AsyncFunction("stopReaderScan") {
      ReaderManager.shared.stopRanging()
      ReaderManager.shared.stopMonitoring()
    }.runOnQueue(.main)
    AsyncFunction("proximityProof") { (lockId: Int) -> String in
      guard lockId > 0, ReaderManager.shared.isNearbyLock(lockId),
            let proof = ReaderManager.shared.proximityProofForLock(lockId) else {
        throw NSError(domain: "KisiAccess", code: 4, userInfo: [NSLocalizedDescriptionKey: "The entrance reader is not nearby. Turn on Bluetooth, stand near the reader, and retry."])
      }
      return String(proof)
    }.runOnQueue(.main)
    AsyncFunction("initialize") { (partnerId: Int, credential: KisiCredential) in
      guard partnerId > 0, credential.organizationId > 0, credential.loginId > 0,
            !credential.secret.isEmpty, !credential.phoneKey.isEmpty, !credential.onlineCertificate.isEmpty,
            credential.validFrom.isFinite, credential.validUntil.isFinite,
            credential.validUntil > credential.validFrom,
            credential.validUntil > Date().timeIntervalSince1970 * 1000 else {
        throw NSError(domain: "KisiAccess", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing, invalid, or expired Kisi device credential."])
      }
      self.kisiDelegate.configure(partnerId, credential)
      self.kisiDelegate.setReport { [weak self] success, error in
        var payload: [String: Any] = ["success": success]
        if let error { payload["error"] = error }
        self?.sendEvent("onUnlock", payload)
      }
      TapToAccessManager.shared.delegate = self.kisiDelegate
      TapToAccessManager.shared.start()
    }.runOnQueue(.main)
    AsyncFunction("clearCredentials") {
      self.kisiDelegate.configure(0, nil)
      self.kisiDelegate.setReport(nil)
      TapToAccessManager.shared.stop()
      TapToAccessManager.shared.delegate = nil
      ReaderManager.shared.stopRanging()
      ReaderManager.shared.stopMonitoring()
    }.runOnQueue(.main)
    OnDestroy {
      self.kisiDelegate.configure(0, nil)
      self.kisiDelegate.setReport(nil)
      Task { @MainActor in
        TapToAccessManager.shared.stop()
        TapToAccessManager.shared.delegate = nil
        ReaderManager.shared.stopRanging()
        ReaderManager.shared.stopMonitoring()
      }
    }
  }
}
