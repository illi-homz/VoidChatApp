package com.voidchatapp.audiorouter;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class AudioRouterModule extends ReactContextBaseJavaModule {
    public static final String NAME = "AudioRouter";

    private final AudioManager audioManager;
    private int originalMode = AudioManager.MODE_NORMAL;
    private AudioFocusRequest audioFocusRequest;
    private static final String TAG = "AudioRouter";

    public AudioRouterModule(ReactApplicationContext reactContext) {
        super(reactContext);
        audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void setSpeakerphoneOn(boolean on) {
        try {
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            audioManager.setSpeakerphoneOn(on);
            Log.d(TAG, "setSpeakerphoneOn: " + on);
        } catch (Exception e) {
            Log.e(TAG, "setSpeakerphoneOn error", e);
        }
    }

    @ReactMethod
    public void startAudioSession() {
        try {
            originalMode = audioManager.getMode();
            Log.d(TAG, "startAudioSession: saved original mode = " + originalMode);

            // Устанавливаем режим связи (VoIP) ДО getUserMedia, чтобы WebRTC
            // инициализировал аудио-пайплайн в правильном режиме.
            // На Samsung это критично — смена режима после getUserMedia игнорируется.
            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            Log.d(TAG, "startAudioSession: set mode MODE_IN_COMMUNICATION");

            // Выставляем громкость на максимум для обоих стримов, которые
            // может использовать WebRTC (зависит от прошивки устройства)
            audioManager.setStreamVolume(AudioManager.STREAM_VOICE_CALL,
                    audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL), 0);

            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC,
                    audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
            Log.d(TAG, "startAudioSession: set volume to max for both streams");
        } catch (Exception e) {
            Log.e(TAG, "startAudioSession error", e);
        }
    }

    @ReactMethod
    public void stopAudioSession() {
        try {
            audioManager.setSpeakerphoneOn(false);
            Log.d(TAG, "stopAudioSession: speakerphone off");

            audioManager.setMode(originalMode);
            Log.d(TAG, "stopAudioSession: restored mode = " + originalMode);

            originalMode = AudioManager.MODE_NORMAL;
        } catch (Exception e) {
            Log.e(TAG, "stopAudioSession error", e);
        }
    }

    @ReactMethod
    public void setMicrophoneMute(boolean mute) {
        try {
            audioManager.setMicrophoneMute(mute);
            Log.d(TAG, "setMicrophoneMute: " + mute);
        } catch (Exception e) {
            Log.e(TAG, "setMicrophoneMute error", e);
        }
    }

    @ReactMethod
    public void rawToCache(String rawResourceName, String cacheFileName, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            int resId = context.getResources().getIdentifier(rawResourceName, "raw", context.getPackageName());
            if (resId == 0) {
                promise.reject("RESOURCE_NOT_FOUND", "Raw resource not found: " + rawResourceName);
                return;
            }

            InputStream inputStream = context.getResources().openRawResource(resId);
            File cacheDir = new File(context.getCacheDir(), "sounds");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File outputFile = new File(cacheDir, cacheFileName);

            FileOutputStream outputStream = new FileOutputStream(outputFile);
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }
            outputStream.close();
            inputStream.close();

            promise.resolve(outputFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "rawToCache error", e);
            promise.reject("COPY_ERROR", e.getMessage());
        }
    }
}
