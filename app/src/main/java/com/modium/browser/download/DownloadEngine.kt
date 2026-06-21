package com.modium.browser.download

import android.content.Context
import com.chaquo.python.PyObject
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform

data class DownloadFormat(
    val formatId: String,
    val ext: String,
    val label: String,
    val filesizeBytes: Long,
    val isAudioOnly: Boolean
)

data class DownloadInfo(
    val title: String,
    val thumbnailUrl: String,
    val durationSeconds: Long,
    val formats: List<DownloadFormat>
)

/** Implemented in Kotlin, called directly from Python's progress_hooks. */
interface DownloadProgressCallback {
    fun onProgress(percent: Double, etaSeconds: Int, speedBytesPerSec: Int)
    fun onComplete(filePath: String)
    fun onError(message: String)
}

/**
 * Thin wrapper around the `downloader.py` module bundled under src/main/python.
 * yt-dlp runs in-process (via Chaquopy), no external server or shelled-out binary needed.
 * All calls here are blocking -- always invoke from a background thread.
 */
object DownloadEngine {

    fun ensureStarted(context: Context) {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(context))
        }
    }

    private fun module(): PyObject = Python.getInstance().getModule("downloader")

    private fun PyObject?.asStr(): String = this?.toString() ?: ""
    private fun PyObject?.asLong(): Long = this?.toJava(java.lang.Long::class.java)?.toLong() ?: 0L
    private fun PyObject?.asBool(): Boolean = this?.toJava(java.lang.Boolean::class.java)?.booleanValue() ?: false

    /** Blocking. Resolves a page URL (YouTube, Twitter/X, TikTok, Instagram, etc.) into formats. */
    fun fetchInfo(url: String): DownloadInfo {
        val result = module().callAttr("get_info", url)
        val map = result.asMap()

        val formats = (map[PyObject.fromJava("formats")]?.asList() ?: emptyList()).map { f ->
            val fMap = f.asMap()
            DownloadFormat(
                formatId = fMap[PyObject.fromJava("format_id")].asStr(),
                ext = fMap[PyObject.fromJava("ext")].asStr(),
                label = fMap[PyObject.fromJava("label")].asStr(),
                filesizeBytes = fMap[PyObject.fromJava("filesize")].asLong(),
                isAudioOnly = fMap[PyObject.fromJava("is_audio_only")].asBool()
            )
        }

        return DownloadInfo(
            title = map[PyObject.fromJava("title")].asStr().ifBlank { url },
            thumbnailUrl = map[PyObject.fromJava("thumbnail")].asStr(),
            durationSeconds = map[PyObject.fromJava("duration")].asLong(),
            formats = formats
        )
    }

    /** Blocking. Reports progress/completion/errors through [callback] on the calling thread. */
    fun download(url: String, formatId: String, outputDir: String, callback: DownloadProgressCallback) {
        module().callAttr("download", url, formatId, outputDir, callback)
    }
}