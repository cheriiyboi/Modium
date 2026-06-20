package com.modium.browser.ui

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.modium.browser.blocker.FilterListManager
import com.modium.browser.data.Settings
import java.io.ByteArrayInputStream

class ModiumWebViewClient(
    private val context: Context,
    private val onPageStarted: (String) -> Unit,
    private val onPageFinished: (String) -> Unit,
    private val onBlockedRequest: () -> Unit,
    private val onSecurityStateChanged: (Boolean) -> Unit
) : WebViewClient() {

    private val emptyResponse: WebResourceResponse
        get() = WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream(ByteArray(0)))

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        val url = request.url.toString()

        if (Settings.blockAds(context) &&
            FilterListManager.shouldBlock(context, url, true)
        ) {
            onBlockedRequest()
            return emptyResponse
        }

        return super.shouldInterceptRequest(view, request)
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url
        val scheme = uri.scheme?.lowercase()

        if (scheme != "http" && scheme != "https") {
            // Let the system handle non-http(s) intents (mailto:, tel:, intent:, market:, etc.)
            return try {
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                context.startActivity(intent)
                true
            } catch (e: android.content.ActivityNotFoundException) {
                true
            }
        }

        if (scheme == "http" && Settings.httpsUpgrade(context)) {
            val upgraded = uri.buildUpon().scheme("https").build()
            view.loadUrl(upgraded.toString())
            return true
        }

        return false
    }

    override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        onSecurityStateChanged(Uri.parse(url).scheme == "https")
        onPageStarted(url)
    }

    override fun onPageFinished(view: WebView, url: String) {
        super.onPageFinished(view, url)
        onPageFinished(url)
    }
}
