package com.voidchatapp.background

import androidx.annotation.NonNull
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.Collections

class BackgroundServicePackage : ReactPackage {

    @NonNull
    override fun createNativeModules(@NonNull reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(BackgroundServiceModule(reactContext))
    }

    @NonNull
    override fun createViewManagers(@NonNull reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return Collections.emptyList()
    }
}
