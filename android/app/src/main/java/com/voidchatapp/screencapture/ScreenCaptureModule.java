package com.voidchatapp.screencapture;

import android.app.Activity;
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
        runOnUiThread(window -> {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            Log.d(TAG, "allowScreenCapture: FLAG_SECURE removed");
        });
    }

    @ReactMethod
    public void disallowScreenCapture() {
        runOnUiThread(window -> {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            Log.d(TAG, "disallowScreenCapture: FLAG_SECURE set");
        });
    }

    /** Выполняет действие с Window на UI потоке. */
    private void runOnUiThread(WindowCallback callback) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                Log.w(TAG, "runOnUiThread: current activity is null");
                return;
            }
            activity.runOnUiThread(() -> {
                try {
                    callback.run(activity.getWindow());
                } catch (Exception e) {
                    Log.e(TAG, "Window operation error", e);
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "runOnUiThread error", e);
        }
    }

    private interface WindowCallback {
        void run(android.view.Window window);
    }
}
