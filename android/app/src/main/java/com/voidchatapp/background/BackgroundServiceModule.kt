package com.voidchatapp.background

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.voidchatapp.MainActivity

/**
 * Native module to control the [BackgroundSocketService] foreground service
 * and show local notifications for messages when the app is in background.
 *
 * Exposed to JS as `NativeModules.BackgroundService`.
 */
class BackgroundServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "BackgroundService"
        private const val TAG = "BgServiceModule"

        // Notification channels
        const val CHANNEL_BG = "voidchat-background"
        const val CHANNEL_MESSAGES = "voidchat-messages"

        // Notification IDs
        private const val MSG_NOTIFICATION_ID_BASE = 10000
    }

    override fun getName(): String = NAME

    // ---- Foreground Service Lifecycle ----

    @ReactMethod
    fun start(promise: Promise) {
        try {
            val context = getReactApplicationContext()
            val intent = Intent(context, BackgroundSocketService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.d(TAG, "start: BackgroundSocketService started")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "start error", e)
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            val context = getReactApplicationContext()
            context.stopService(Intent(context, BackgroundSocketService::class.java))
            Log.d(TAG, "stop: BackgroundSocketService stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "stop error", e)
            promise.reject("STOP_ERROR", e.message)
        }
    }

    // ---- Message Notifications ----

    @ReactMethod
    fun showNotification(channelId: String, title: String, body: String, contactId: String) {
        try {
            val context = getReactApplicationContext()
            createMessageChannelIfNeeded(context)

            val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            // Create intent to open MainActivity
            // Optionally pass contactId as extra for deep linking
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                if (contactId.isNotEmpty()) {
                    putExtra("contactId", contactId)
                }
            }

            // Generate unique notification ID per contact to avoid replacing
            val notificationId = MSG_NOTIFICATION_ID_BASE + (contactId.hashCode() and 0x7FFFFFFF) % 10000

            // Use notificationId as requestCode so each contact has its own PendingIntent
            val pendingIntent = PendingIntent.getActivity(
                context, notificationId, intent, pendingIntentFlags
            )

            val notification = NotificationCompat.Builder(context, channelId)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()

            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(notificationId, notification)

            Log.d(TAG, "showNotification: $title — $body")
        } catch (e: Exception) {
            Log.e(TAG, "showNotification error", e)
        }
    }

    private fun createMessageChannelIfNeeded(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_MESSAGES,
                "Новые сообщения",
                NotificationManager.IMPORTANCE_HIGH  // Sound + heads-up
            ).apply {
                description = "Уведомления о новых сообщениях"
                enableVibration(true)
            }
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
