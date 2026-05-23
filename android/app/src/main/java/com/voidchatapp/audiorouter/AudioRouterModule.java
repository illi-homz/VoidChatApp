package com.voidchatapp.audiorouter;

import android.content.Context;
import android.media.AudioManager;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class AudioRouterModule extends ReactContextBaseJavaModule {
    public static final String NAME = "AudioRouter";

    private final AudioManager audioManager;
    private int originalMode = AudioManager.MODE_NORMAL;
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

            audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
            Log.d(TAG, "startAudioSession: set mode MODE_IN_COMMUNICATION");

            audioManager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN);
            Log.d(TAG, "startAudioSession: requested audio focus");

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

            audioManager.abandonAudioFocus(null);
            Log.d(TAG, "stopAudioSession: abandoned audio focus");

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
}
