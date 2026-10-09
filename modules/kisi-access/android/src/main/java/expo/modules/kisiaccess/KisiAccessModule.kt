package expo.modules.kisiaccess

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.Field
import de.kisi.android.SecureUnlockConfiguration
import de.kisi.android.st2u.Login
import de.kisi.android.st2u.UnlockError
import io.reactivex.rxjava3.core.Maybe
import de.kisi.android.nearby.KisiBeacon
import de.kisi.android.nearby.KisiBeaconTracker
import android.os.SystemClock
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.functions.Queues

class KisiCredential : Record {
  @Field var organizationId: Int = 0
  @Field var loginId: Int = 0
  @Field var secret: String = ""
  @Field var phoneKey: String = ""
  @Field var onlineCertificate: String = ""
  @Field var validFrom: Double = 0.0
  @Field var validUntil: Double = 0.0
}

class KisiAccessModule : Module() {
  @Volatile private var credential: KisiCredential? = null
  private var tracker: KisiBeaconTracker? = null
  @Volatile private var nearby: Pair<Long, List<KisiBeacon>> = Pair(0, emptyList())

  override fun definition() = ModuleDefinition {
    Name("KisiAccess")
    Events("onUnlock", "onReaderError")
    AsyncFunction("startReaderScan") {
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("Android application context is unavailable.")
      if (tracker == null) {
        nearby = Pair(0, emptyList())
        tracker = KisiBeaconTracker(context,
          { _ ->
            nearby = Pair(0, emptyList())
            sendEvent("onReaderError", mapOf("message" to "Could not scan the entrance reader. Enable Bluetooth and location, check nearby-device permissions, and retry."))
          },
          { beacons -> nearby = Pair(SystemClock.elapsedRealtime(), beacons.toList()) }
        )
      }
      tracker?.startRanging()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopReaderScan") {
      tracker?.stopRanging()
      tracker = null
      nearby = Pair(0, emptyList())
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("proximityProof") { lockId: Long ->
      val snapshot = nearby
      require(lockId > 0 && SystemClock.elapsedRealtime() - snapshot.first < 5000) {
        "No fresh entrance reader signal. Turn on Bluetooth, stand near the reader, and retry."
      }
      val reader = snapshot.second.firstOrNull { it.lockId == lockId }
        ?: throw IllegalStateException("The entrance reader is not nearby. Stand near the reader and retry.")
      reader.totp.toString()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("initialize") { partnerId: Int, value: KisiCredential ->
      require(partnerId > 0 && value.organizationId > 0 && value.loginId > 0
        && value.secret.isNotBlank() && value.phoneKey.isNotBlank() && value.onlineCertificate.isNotBlank()
        && value.validFrom.isFinite() && value.validUntil.isFinite()
        && value.validUntil > value.validFrom && value.validUntil > System.currentTimeMillis()) {
        "Missing, invalid, or expired Kisi device credential."
      }
      val context = appContext.reactContext?.applicationContext
        ?: throw IllegalStateException("Android application context is unavailable.")
      credential = value
      SecureUnlockConfiguration.init(
        context = context,
        clientId = partnerId,
        fetchLoginCallback = { organizationId ->
          val current = credential
          val now = System.currentTimeMillis().toDouble()
          if (current == null || now < current.validFrom || now >= current.validUntil
            || (organizationId != null && organizationId != current.organizationId)) {
            Maybe.empty()
          } else {
            Maybe.just(Login(current.loginId, current.secret, current.phoneKey, current.onlineCertificate))
          }
        },
        onUnlockCompleteCallback = { _, error ->
          sendEvent("onUnlock", if (error == UnlockError.NONE) mapOf("success" to true)
            else mapOf("success" to false, "error" to "Kisi could not unlock the door. Check your booking access and reader connection."))
        }
      )
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("clearCredentials") {
      credential = null
      tracker?.stopRanging()
      tracker = null
      nearby = Pair(0, emptyList())
    }.runOnQueue(Queues.MAIN)
    OnDestroy {
      credential = null
      nearby = Pair(0, emptyList())
      Handler(Looper.getMainLooper()).post {
        tracker?.stopRanging()
        tracker = null
      }
    }
  }
}
