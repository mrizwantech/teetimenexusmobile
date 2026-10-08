package expo.modules.kisiaccess

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.Field
import de.kisi.android.SecureUnlockConfiguration
import de.kisi.android.st2u.Login
import de.kisi.android.st2u.UnlockError
import io.reactivex.rxjava3.core.Maybe

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

  override fun definition() = ModuleDefinition {
    Name("KisiAccess")
    Events("onUnlock")
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
    }
    AsyncFunction("clearCredentials") { credential = null }
    OnDestroy { credential = null }
  }
}
