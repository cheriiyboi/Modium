package com.modium.browser.ui

import android.content.Context
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebStorage
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.DrawableCompat
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.PreferenceGroup
import androidx.recyclerview.widget.RecyclerView
import com.modium.browser.R

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val toolbar = findViewById<androidx.appcompat.widget.Toolbar>(R.id.settingsToolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.settingsContainer, SettingsFragment())
                .commit()
        }
    }

    class SettingsFragment : PreferenceFragmentCompat() {
        override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
            setPreferencesFromResource(R.xml.preferences, rootKey)
            tintIconsRecursively(preferenceScreen)

            findPreference<Preference>("pref_clear_data")?.setOnPreferenceClickListener {
                clearBrowsingData(requireContext())
                android.widget.Toast.makeText(
                    requireContext(),
                    getString(R.string.settings_data_cleared),
                    android.widget.Toast.LENGTH_SHORT
                ).show()
                true
            }
        }

        override fun onCreateRecyclerView(
            inflater: android.view.LayoutInflater,
            parent: android.view.ViewGroup,
            savedInstanceState: Bundle?
        ): RecyclerView {
            val recyclerView = super.onCreateRecyclerView(inflater, parent, savedInstanceState)
            recyclerView.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.m3_background))
            recyclerView.setPadding(0, 12, 0, 24)
            recyclerView.clipToPadding = false
            return recyclerView
        }

        /** Preference XML has no `app:iconTint`, so bake the M3 muted color into every icon here. */
        private fun tintIconsRecursively(group: PreferenceGroup) {
            val tintColor = ContextCompat.getColor(requireContext(), R.color.m3_on_surface_variant)
            for (i in 0 until group.preferenceCount) {
                val pref = group.getPreference(i)
                pref.icon?.let { icon ->
                    val wrapped = DrawableCompat.wrap(icon.mutate())
                    DrawableCompat.setTint(wrapped, tintColor)
                    pref.icon = wrapped
                }
                if (pref is PreferenceGroup) tintIconsRecursively(pref)
            }
        }

        private fun clearBrowsingData(context: Context) {
            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()
            WebStorage.getInstance().deleteAllData()
            context.deleteDatabase("webview.db")
            context.deleteDatabase("webviewCache.db")
        }
    }
}
