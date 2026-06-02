package com.voidchatapp.screencapture;

import android.util.Log;
import android.view.WindowManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class ScreenCaptureModule extends ReactContextBaseJavaModule {
    public static final String NAME = "ScreenCapture";
    private static final String TAG = "ScreenCapture";

    public ScreenCaptureModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void allowScreenCapture() {
        try {
            var activity = getCurrentActivity();
            if (activity == null) {
                Log.w(TAG, "allowScreenCapture: current activity is null");
                return;
            }
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            Log.d(TAG, "allowScreenCapture: FLAG_SECURE removed");
        } catch (Exception e) {
            Log.e(TAG, "allowScreenCapture error", e);
        }
    }

    @ReactMethod
    public void disallowScreenCapture() {
        try {
            var activity = getCurrentActivity();
            if (activity == null) {
                Log.w(TAG, "disallowScreenCapture: current activity is null");
                return;
            }
            activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            Log.d(TAG, "disallowScreenCapture: FLAG_SECURE set");
        } catch (Exception e) {
            Log.e(TAG, "disallowScreenCapture error", e);
        }
    }
}
