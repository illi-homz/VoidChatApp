package com.voidchatapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.voidchatapp.audiorouter.AudioRouterPackage
import com.voidchatapp.clipboard.ClipboardPackage
import com.voidchatapp.installapk.InstallApkPackage
import com.voidchatapp.screencapture.ScreenCapturePackage
import io.wazo.callkeep.RNCallKeepPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ClipboardPackage())
          add(ScreenCapturePackage())
          add(AudioRouterPackage())
          add(InstallApkPackage())
          add(RNCallKeepPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
