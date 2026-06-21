package com.modium.browser.download

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.modium.browser.R
import com.modium.browser.ui.BrowserActivity
import java.util.concurrent.Executors

class DownloadService : Service() {

    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var notificationManager: NotificationManager

    override fun onCreate() {
        super.onCreate()
        DownloadEngine.ensureStarted(applicationContext)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.download_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val url = intent?.getStringExtra(EXTRA_URL)
        val formatId = intent?.getStringExtra(EXTRA_FORMAT_ID)
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: getString(R.string.download_notification_title)
        val notificationId = startId

        if (url == null || formatId == null) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        startForeground(notificationId, buildProgressNotification(title, 0))

        executor.execute {
            val outputDir = (getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: filesDir).absolutePath
            DownloadEngine.download(
                url = url,
                formatId = formatId,
                outputDir = outputDir,
                callback = object : DownloadProgressCallback {
                    override fun onProgress(percent: Double, etaSeconds: Int, speedBytesPerSec: Int) {
                        val safePercent = if (percent in 0.0..100.0) percent.toInt() else -1
                        notificationManager.notify(notificationId, buildProgressNotification(title, safePercent))
                    }

                    override fun onComplete(filePath: String) {
                        notificationManager.notify(notificationId, buildDoneNotification(title, success = true))
                        stopForeground(STOP_FOREGROUND_DETACH)
                        stopSelf(startId)
                    }

                    override fun onError(message: String) {
                        notificationManager.notify(notificationId, buildDoneNotification(title, success = false))
                        stopForeground(STOP_FOREGROUND_DETACH)
                        stopSelf(startId)
                    }
                }
            )
        }

        return START_NOT_STICKY
    }

    private fun buildProgressNotification(title: String, percent: Int): Notification {
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_download)
            .setContentTitle(title)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setContentIntent(openAppPendingIntent())

        if (percent in 0..100) {
            builder.setContentText(getString(R.string.download_progress, percent))
            builder.setProgress(100, percent, false)
        } else {
            builder.setContentText(getString(R.string.download_in_progress))
            builder.setProgress(0, 0, true)
        }
        return builder.build()
    }

    private fun buildDoneNotification(title: String, success: Boolean): Notification {
        val text = if (success) getString(R.string.download_complete) else getString(R.string.download_failed)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_download)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(false)
            .setAutoCancel(true)
            .setContentIntent(openAppPendingIntent())
            .build()
    }

    private fun openAppPendingIntent(): PendingIntent {
        val intent = Intent(this, BrowserActivity::class.java)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(this, 0, intent, flags)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "modium_downloads"
        const val EXTRA_URL = "extra_url"
        const val EXTRA_FORMAT_ID = "extra_format_id"
        const val EXTRA_TITLE = "extra_title"

        fun start(context: Context, url: String, formatId: String, title: String) {
            val intent = Intent(context, DownloadService::class.java).apply {
                putExtra(EXTRA_URL, url)
                putExtra(EXTRA_FORMAT_ID, formatId)
                putExtra(EXTRA_TITLE, title)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
