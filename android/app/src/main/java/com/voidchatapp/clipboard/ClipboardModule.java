package com.voidchatapp.clipboard;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class ClipboardModule extends ReactContextBaseJavaModule {
    public static final String NAME = "Clipboard";

    public ClipboardModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void setString(String text) {
        ClipboardManager clipboard = (ClipboardManager)
            getReactApplicationContext().getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("VoidChat", text);
        clipboard.setPrimaryClip(clip);
    }
}
