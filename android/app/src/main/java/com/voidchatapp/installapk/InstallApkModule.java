package com.voidchatapp.installapk;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;

public class InstallApkModule extends ReactContextBaseJavaModule {
    public static final String NAME = "InstallApk";
    private static final String TAG = "InstallApk";

    private final ReactApplicationContext reactContext;

    public InstallApkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void installApk(String filePath) {
        try {
            Log.d(TAG, "installApk: " + filePath);

            File file = new File(filePath);

            // На Android 7+ (API 24+) используем FileProvider
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                        reactContext,
                        reactContext.getPackageName() + ".provider",
                        file
                );
            } else {
                apkUri = Uri.fromFile(file);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            reactContext.startActivity(intent);
            Log.d(TAG, "installApk: intent sent successfully");
        } catch (Exception e) {
            Log.e(TAG, "installApk error", e);
            throw new RuntimeException("Failed to install APK: " + e.getMessage(), e);
        }
    }
}
