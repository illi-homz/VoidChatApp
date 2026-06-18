package com.voidchatapp

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash
import io.wazo.callkeep.RNCallKeepModule

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "VoidChatApp"

  override fun onCreate(savedInstanceState: Bundle?) {
    RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(savedInstanceState)
    // Блокируем скриншоты только в релизной сборке.
    // В debug-сборке скриншоты разрешены для удобства разработки.
    if (!BuildConfig.DEBUG) {
      window.setFlags(
        WindowManager.LayoutParams.FLAG_SECURE,
        WindowManager.LayoutParams.FLAG_SECURE
      )
    }
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    when (requestCode) {
      RNCallKeepModule.REQUEST_READ_PHONE_STATE -> {
        RNCallKeepModule.onRequestPermissionsResult(requestCode, permissions, grantResults)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)

    // Если notification тапнули — шлём событие напрямую в JS
    if (intent.hasExtra("contactId")) {
      val contactId = intent.getStringExtra("contactId") ?: return
      Log.d("MainActivity", "Notification tapped for contact: $contactId")

      try {
        val reactHost = (application as MainApplication).reactHost
        reactHost.currentReactContext?.let { context ->
          context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("notification_tapped", contactId)
          Log.d("MainActivity", "Emitted notification_tapped event")
        }
      } catch (e: Exception) {
        Log.e("MainActivity", "Failed to emit notification_tapped event", e)
      }
    }
  }
}
