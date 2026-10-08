import ExpoModulesCore
import SecureAccess
import Foundation

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

  public func definition() -> ModuleDefinition {
    Name("KisiAccess")
    Events("onUnlock")
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
    }.runOnQueue(.main)
    OnDestroy {
      self.kisiDelegate.configure(0, nil)
      self.kisiDelegate.setReport(nil)
      Task { @MainActor in
        TapToAccessManager.shared.stop()
        TapToAccessManager.shared.delegate = nil
      }
    }
  }
}
