package com.modium.browser.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.webkit.UserAgentMetadata
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.switchmaterial.SwitchMaterial
import com.modium.browser.R
import com.modium.browser.data.Settings
import com.modium.browser.data.Tab
import com.modium.browser.download.DownloadEngine
import com.modium.browser.download.DownloadFormatsAdapter
import com.modium.browser.download.DownloadService

private const val NEW_TAB_URL = "modium://newtab"
private const val DESKTOP_UA =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36"
private const val DESKTOP_VIEWPORT_JS = """
    (function() {
        var meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', 'width=1280, initial-scale=1');
    })();
"""

class BrowserActivity : AppCompatActivity() {

    private lateinit var urlEditText: android.widget.EditText
    private lateinit var iconSecure: ImageView
    private lateinit var progressBar: ProgressBar
    private lateinit var webViewContainer: FrameLayout
    private lateinit var btnBack: ImageButton
    private lateinit var btnForward: ImageButton
    private lateinit var tabSwitcherOverlay: View
    private lateinit var tabsRecyclerView: RecyclerView
    private lateinit var newTabContainer: FrameLayout
    private lateinit var textSessionBlocked: TextView

    private val tabs = mutableListOf<Tab>()
    private val webViews = HashMap<String, WebView>()
    private var currentTabId: String? = null
    private var sessionBlockedTotal = 0
    private lateinit var tabsAdapter: TabsAdapter

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_browser)

        urlEditText = findViewById(R.id.urlEditText)
        iconSecure = findViewById(R.id.iconSecure)
        progressBar = findViewById(R.id.progressBar)
        webViewContainer = findViewById(R.id.webViewContainer)
        btnBack = findViewById(R.id.btnBack)
        btnForward = findViewById(R.id.btnForward)
        tabSwitcherOverlay = findViewById(R.id.tabSwitcherOverlay)
        tabsRecyclerView = findViewById(R.id.tabsRecyclerView)
        newTabContainer = findViewById(R.id.newTabContainer)

        setupUrlBar()
        setupBottomBar()
        setupTopBarButtons()
        setupTabSwitcher()
        setupNewTabView()

        if (savedInstanceState == null) {
            openNewTab(private = false, url = NEW_TAB_URL)
        }
    }

    private fun setupNewTabView() {
        val view = LayoutInflater.from(this).inflate(R.layout.view_new_tab, newTabContainer, false)
        newTabContainer.addView(view)

        textSessionBlocked = view.findViewById(R.id.textSessionBlocked)

        view.findViewById<View>(R.id.newTabSearchField).setOnClickListener {
            urlEditText.requestFocus()
            val imm = getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
            imm.showSoftInput(urlEditText, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
        }
        view.findViewById<View>(R.id.shortcutBookmarks).setOnClickListener {
            Toast.makeText(this, "Bookmarks", Toast.LENGTH_SHORT).show()
        }
        view.findViewById<View>(R.id.shortcutHistory).setOnClickListener {
            Toast.makeText(this, "History", Toast.LENGTH_SHORT).show()
        }
        view.findViewById<View>(R.id.shortcutPrivate).setOnClickListener {
            openNewTab(private = true, url = NEW_TAB_URL)
        }
        view.findViewById<View>(R.id.shortcutSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun setupUrlBar() {
        urlEditText.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                loadInput(urlEditText.text.toString())
                true
            } else false
        }

        findViewById<ImageButton>(R.id.btnReload).setOnClickListener {
            currentWebView()?.reload()
        }
    }

    private fun setupBottomBar() {
        btnBack.setOnClickListener { currentWebView()?.let { if (it.canGoBack()) it.goBack() } }
        btnForward.setOnClickListener { currentWebView()?.let { if (it.canGoForward()) it.goForward() } }

        findViewById<ImageButton>(R.id.btnNewTab).setOnClickListener {
            openNewTab(private = false, url = NEW_TAB_URL)
        }

        findViewById<ImageButton>(R.id.btnBookmark).setOnClickListener {
            Toast.makeText(this, "Bookmarked", Toast.LENGTH_SHORT).show()
        }

        findViewById<ImageButton>(R.id.btnShare).setOnClickListener {
            val url = currentWebView()?.url ?: return@setOnClickListener
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, url)
            }
            startActivity(Intent.createChooser(intent, null))
        }
    }

    private fun setupTopBarButtons() {
        findViewById<ImageButton>(R.id.btnShields).setOnClickListener { showShieldsDialog() }
        findViewById<ImageButton>(R.id.btnTabs).setOnClickListener { showTabSwitcher() }
        findViewById<ImageButton>(R.id.btnMenu).setOnClickListener { showOverflowMenu(it) }
    }

    private fun setupTabSwitcher() {
        tabsAdapter = TabsAdapter(
            tabs = mutableListOf(),
            onTabClick = { tab -> switchToTab(tab.id); hideTabSwitcher() },
            onTabClose = { tab -> closeTab(tab.id) }
        )
        tabsRecyclerView.layoutManager = LinearLayoutManager(this)
        tabsRecyclerView.adapter = tabsAdapter

        findViewById<ImageButton>(R.id.btnNewTabFromSwitcher).setOnClickListener {
            openNewTab(private = false, url = NEW_TAB_URL)
            hideTabSwitcher()
        }
        findViewById<ImageButton>(R.id.btnNewPrivateTab).setOnClickListener {
            openNewTab(private = true, url = NEW_TAB_URL)
            hideTabSwitcher()
        }
        findViewById<ImageButton>(R.id.btnCloseSwitcher).setOnClickListener { hideTabSwitcher() }
    }

    private fun showTabSwitcher() {
        tabsAdapter.updateTabs(tabs)
        tabSwitcherOverlay.visibility = View.VISIBLE
        tabSwitcherOverlay.alpha = 0f
        tabSwitcherOverlay.translationY = 40f
        tabSwitcherOverlay.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(220)
            .start()
    }

    private fun hideTabSwitcher() {
        tabSwitcherOverlay.animate()
            .alpha(0f)
            .translationY(40f)
            .setDuration(160)
            .withEndAction { tabSwitcherOverlay.visibility = View.GONE }
            .start()
    }

    // ---------- Tab management ----------

    private fun openNewTab(private: Boolean, url: String) {
        val tab = Tab(isPrivate = private, url = url, title = "New tab")
        tabs.add(tab)
        val webView = createWebView(tab)
        webViews[tab.id] = webView
        switchToTab(tab.id)
        if (url != NEW_TAB_URL) webView.loadUrl(url)
    }

    private fun switchToTab(tabId: String) {
        currentTabId = tabId
        webViewContainer.removeAllViews()
        val webView = webViews[tabId] ?: return
        (webView.parent as? FrameLayout)?.removeView(webView)
        webViewContainer.addView(webView)
        val tab = tabs.find { it.id == tabId } ?: return
        urlEditText.setText(if (tab.url == NEW_TAB_URL) "" else tab.url)
        showNewTabView(tab.url == NEW_TAB_URL)
        updateNavButtons()
    }

    private fun showNewTabView(show: Boolean) {
        if (show) {
            textSessionBlocked.text = if (sessionBlockedTotal > 0) {
                getString(R.string.new_tab_blocked_count, sessionBlockedTotal)
            } else {
                getString(R.string.new_tab_blocked_zero)
            }
        }
        if (show && newTabContainer.visibility != View.VISIBLE) {
            newTabContainer.visibility = View.VISIBLE
            newTabContainer.alpha = 0f
            newTabContainer.animate().alpha(1f).setDuration(200).start()
            webViewContainer.visibility = View.GONE
        } else if (!show && newTabContainer.visibility == View.VISIBLE) {
            newTabContainer.animate().alpha(0f).setDuration(150)
                .withEndAction { newTabContainer.visibility = View.GONE }
                .start()
            webViewContainer.visibility = View.VISIBLE
            webViewContainer.alpha = 0f
            webViewContainer.animate().alpha(1f).setDuration(200).start()
        } else if (!show) {
            webViewContainer.visibility = View.VISIBLE
        }
    }

    private fun closeTab(tabId: String) {
        val index = tabs.indexOfFirst { it.id == tabId }
        if (index == -1) return
        webViews[tabId]?.destroy()
        webViews.remove(tabId)
        tabs.removeAt(index)

        if (tabs.isEmpty()) {
            openNewTab(private = false, url = NEW_TAB_URL)
        } else if (currentTabId == tabId) {
            val nextIndex = if (index >= tabs.size) tabs.size - 1 else index
            switchToTab(tabs[nextIndex].id)
        }
        tabsAdapter.updateTabs(tabs)
    }

    private fun currentTab(): Tab? = tabs.find { it.id == currentTabId }
    private fun currentWebView(): WebView? = webViews[currentTabId]

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(tab: Tab): WebView {
        val webView = WebView(this)
        webView.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = !tab.isPrivate
        settings.databaseEnabled = !tab.isPrivate
        settings.cacheMode = if (tab.isPrivate) WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.mediaPlaybackRequiresUserGesture = true
        settings.savePassword = false
        tab.isDesktopMode = Settings.desktopDefault(this)
        applyDesktopMode(webView, tab.isDesktopMode)

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        val allowThirdParty = !Settings.blockThirdPartyCookies(this) && !tab.isPrivate
        cookieManager.setAcceptThirdPartyCookies(webView, allowThirdParty)

        webView.webViewClient = ModiumWebViewClient(
            context = this,
            onPageStarted = { url -> onTabPageStarted(tab.id, url) },
            onPageFinished = { url -> onTabPageFinished(tab.id, url) },
            onBlockedRequest = { onTabBlockedRequest(tab.id) },
            onSecurityStateChanged = { secure -> onSecurityStateChanged(tab.id, secure) }
        )

        webView.webChromeClient = ModiumWebChromeClient(
            context = this,
            onProgressChanged = { progress -> onTabProgressChanged(tab.id, progress) },
            onTitleChanged = { title -> onTabTitleChanged(tab.id, title) },
            onCreateWindow = {
                val newTab = Tab(isPrivate = tab.isPrivate, title = "New tab")
                tabs.add(newTab)
                val newWebView = createWebView(newTab)
                webViews[newTab.id] = newWebView
                switchToTab(newTab.id)
                newWebView
            }
        )

        return webView
    }

    // ---------- WebView callbacks ----------

    private fun onTabPageStarted(tabId: String, url: String) {
        val tab = tabs.find { it.id == tabId } ?: return
        tab.url = url
        tab.blockedCount = 0
        if (tabId == currentTabId) {
            runOnUiThread {
                urlEditText.setText(url)
                progressBar.visibility = View.VISIBLE
                showNewTabView(false)
            }
        }
    }

    private fun onTabPageFinished(tabId: String, url: String) {
        val tab = tabs.find { it.id == tabId } ?: return
        tab.url = url
        if (tab.isDesktopMode) {
            webViews[tabId]?.evaluateJavascript(DESKTOP_VIEWPORT_JS, null)
        }
        if (tabId == currentTabId) {
            runOnUiThread {
                progressBar.visibility = View.GONE
                updateNavButtons()
            }
        }
    }

    private fun onTabBlockedRequest(tabId: String) {
        val tab = tabs.find { it.id == tabId } ?: return
        tab.blockedCount++
        sessionBlockedTotal++
        if (newTabContainer.visibility == View.VISIBLE) {
            runOnUiThread {
                textSessionBlocked.text = getString(R.string.new_tab_blocked_count, sessionBlockedTotal)
            }
        }
    }

    private fun onTabProgressChanged(tabId: String, progress: Int) {
        if (tabId != currentTabId) return
        runOnUiThread {
            progressBar.progress = progress
            progressBar.visibility = if (progress in 1..99) View.VISIBLE else View.GONE
        }
    }

    private fun onTabTitleChanged(tabId: String, title: String) {
        val tab = tabs.find { it.id == tabId } ?: return
        tab.title = title
    }

    private fun onSecurityStateChanged(tabId: String, secure: Boolean) {
        if (tabId != currentTabId) return
        runOnUiThread {
            iconSecure.setImageResource(if (secure) R.drawable.ic_lock else R.drawable.ic_search)
        }
    }

    private fun updateNavButtons() {
        val webView = currentWebView()
        btnBack.alpha = if (webView?.canGoBack() == true) 1f else 0.4f
        btnForward.alpha = if (webView?.canGoForward() == true) 1f else 0.4f
    }

    // ---------- Navigation input ----------

    private fun loadInput(input: String) {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return

        val url = when {
            Patterns.WEB_URL.matcher(trimmed).matches() && !trimmed.contains(" ") -> {
                if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed
                else "https://$trimmed"
            }
            trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
            else -> Settings.searchUrlFor(this, trimmed)
        }

        currentWebView()?.loadUrl(url)
        currentWebView()?.requestFocus()
        urlEditText.clearFocus()
        hideKeyboard()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
        imm.hideSoftInputFromWindow(urlEditText.windowToken, 0)
    }

    // ---------- Shields dialog ----------

    private fun showShieldsDialog() {
        val dialog = BottomSheetDialog(this)
        dialog.setContentView(R.layout.dialog_shields)

        val tab = currentTab()
        val blockedCountText = dialog.findViewById<android.widget.TextView>(R.id.textBlockedCount)!!
        blockedCountText.text = getString(R.string.shields_status_up, tab?.blockedCount ?: 0)

        val switchGlobal = dialog.findViewById<SwitchMaterial>(R.id.switchShieldsGlobal)!!
        val switchAds = dialog.findViewById<SwitchMaterial>(R.id.switchAdsTrackers)!!
        val switchHttps = dialog.findViewById<SwitchMaterial>(R.id.switchHttpsUpgrade)!!
        val switchPopups = dialog.findViewById<SwitchMaterial>(R.id.switchPopups)!!
        val switchFingerprint = dialog.findViewById<SwitchMaterial>(R.id.switchFingerprint)!!

        switchGlobal.isChecked = Settings.shieldsGloballyEnabled(this)
        switchAds.isChecked = Settings.blockAds(this)
        switchHttps.isChecked = Settings.httpsUpgrade(this)
        switchPopups.isChecked = Settings.blockPopups(this)
        switchFingerprint.isChecked = Settings.blockFingerprinting(this)

        switchGlobal.setOnCheckedChangeListener { _, checked ->
            Settings.setShieldsGloballyEnabled(this, checked)
        }
        switchAds.setOnCheckedChangeListener { _, checked ->
            Settings.setBlockAds(this, checked)
        }
        switchHttps.setOnCheckedChangeListener { _, checked ->
            Settings.setHttpsUpgrade(this, checked)
        }
        switchPopups.setOnCheckedChangeListener { _, checked ->
            Settings.setBlockPopups(this, checked)
        }
        switchFingerprint.setOnCheckedChangeListener { _, checked ->
            Settings.setBlockFingerprinting(this, checked)
        }

        dialog.show()
    }

    // ---------- Download (yt-dlp via Chaquopy) ----------

    private fun showDownloadSheet() {
        val tab = currentTab() ?: return
        if (tab.url == NEW_TAB_URL) return
        val pageUrl = tab.url

        val dialog = BottomSheetDialog(this)
        dialog.setContentView(R.layout.dialog_download)
        dialog.show()

        val titleText = dialog.findViewById<TextView>(R.id.textDownloadTitle)!!
        val loadingState = dialog.findViewById<View>(R.id.downloadLoadingState)!!
        val recycler = dialog.findViewById<RecyclerView>(R.id.recyclerDownloadFormats)!!
        recycler.layoutManager = LinearLayoutManager(this)

        Thread {
            DownloadEngine.ensureStarted(applicationContext)
            val info = try {
                DownloadEngine.fetchInfo(pageUrl)
            } catch (e: Exception) {
                null
            }

            runOnUiThread {
                if (dialog.isShowing) {
                    loadingState.visibility = View.GONE
                    if (info == null || info.formats.isEmpty()) {
                        titleText.text = getString(R.string.download_no_formats)
                    } else {
                        titleText.text = info.title
                        recycler.visibility = View.VISIBLE
                        recycler.adapter = DownloadFormatsAdapter(info.formats) { format ->
                            DownloadService.start(
                                context = applicationContext,
                                url = pageUrl,
                                formatId = format.formatId,
                                title = info.title
                            )
                            Toast.makeText(this, R.string.download_started, Toast.LENGTH_SHORT).show()
                            dialog.dismiss()
                        }
                    }
                }
            }
        }.start()
    }

    private fun showOverflowMenu(anchor: View) {
        val popup = PopupMenu(this, anchor)
        popup.menuInflater.inflate(R.menu.menu_browser, popup.menu)
        popup.menu.findItem(R.id.menu_desktop_site)?.isChecked = currentTab()?.isDesktopMode ?: false

        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.menu_new_tab -> openNewTab(private = false, url = NEW_TAB_URL)
                R.id.menu_new_private_tab -> openNewTab(private = true, url = NEW_TAB_URL)
                R.id.menu_settings -> startActivity(Intent(this, SettingsActivity::class.java))
                R.id.menu_share -> {
                    val url = currentWebView()?.url ?: ""
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, url)
                    }
                    startActivity(Intent.createChooser(intent, null))
                }
                R.id.menu_desktop_site -> toggleDesktopSite()
                R.id.menu_download -> showDownloadSheet()
                R.id.menu_find_in_page -> Toast.makeText(this, "Find in page", Toast.LENGTH_SHORT).show()
                R.id.menu_bookmarks -> Toast.makeText(this, "Bookmarks", Toast.LENGTH_SHORT).show()
                R.id.menu_history -> Toast.makeText(this, "History", Toast.LENGTH_SHORT).show()
                R.id.menu_downloads -> Toast.makeText(this, "Downloads", Toast.LENGTH_SHORT).show()
            }
            true
        }
        popup.show()
    }

    private fun toggleDesktopSite() {
        val tab = currentTab() ?: return
        val webView = currentWebView() ?: return
        tab.isDesktopMode = !tab.isDesktopMode
        applyDesktopMode(webView, tab.isDesktopMode)
        webView.reload()
    }

    /**
     * Switches between mobile and desktop rendering. Just stripping "Mobile" from the
     * legacy User-Agent string isn't enough on modern (Chromium) WebView: it also sends
     * Sec-CH-UA-Mobile Client Hints, which most big sites (Google, YouTube, Reddit...)
     * check instead of the UA string. We have to flip both, plus force a desktop-width
     * viewport since some pages set their own narrow one via JS after load.
     */
    private fun applyDesktopMode(webView: WebView, desktop: Boolean) {
        val settings = webView.settings
        settings.userAgentString = if (desktop) DESKTOP_UA else null
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        if (WebViewFeature.isFeatureSupported(WebViewFeature.USER_AGENT_METADATA)) {
            val current = WebSettingsCompat.getUserAgentMetadata(settings)
            val updated = UserAgentMetadata.Builder(current)
                .setMobile(!desktop)
                .setPlatform(if (desktop) "Linux x86_64" else current.platform)
                .build()
            WebSettingsCompat.setUserAgentMetadata(settings, updated)
        }

        if (desktop) {
            webView.evaluateJavascript(DESKTOP_VIEWPORT_JS, null)
        }
    }

    // ---------- Back press ----------

    override fun onBackPressed() {
        if (tabSwitcherOverlay.visibility == View.VISIBLE) {
            hideTabSwitcher()
            return
        }
        val webView = currentWebView()
        if (webView != null && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webViews.values.forEach { it.destroy() }
        super.onDestroy()
    }
}
