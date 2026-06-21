package com.modium.browser.ui

import android.content.Context
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.modium.browser.data.Settings

class ModiumWebChromeClient(
    private val context: Context,
    private val onProgressChanged: (Int) -> Unit,
    private val onTitleChanged: (String) -> Unit,
    private val onCreateWindow: () -> WebView?
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        onProgressChanged(newProgress)
    }

    override fun onReceivedTitle(view: WebView, title: String?) {
        super.onReceivedTitle(view, title)
        onTitleChanged(title ?: view.url ?: "")
    }

    override fun onCreateWindow(
        view: WebView,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: android.os.Message
    ): Boolean {
        if (Settings.blockPopups(context) && !isUserGesture) {
            return false
        }
        val newWebView = onCreateWindow() ?: return false
        val transport = resultMsg.obj as WebView.WebViewTransport
        transport.webView = newWebView
        resultMsg.sendToTarget()
        return true
    }
}
