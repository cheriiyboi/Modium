package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

data class NoteColorTheme(
    val cardBackground: Color,
    val textColor: Color,
    val accentColor: Color,
    val labelName: String
)

object NoteColorPalette {
    @Composable
    fun getColorsForIndex(index: Int): NoteColorTheme {
        val isDark = isSystemInDarkTheme()
        return when (index) {
            1 -> { // Coral Peach
                NoteColorTheme(
                    cardBackground = if (isDark) Color(0xFF422E2A) else Color(0xFFFFECE9),
                    textColor = if (isDark) Color(0xFFFFDAD4) else Color(0xFF3F0C05),
                    accentColor = Color(0xFFFFB4A2),
                    labelName = "Peach"
                )
            }
            2 -> { // Honey Yellow
                NoteColorTheme(
                    cardBackground = if (isDark) Color(0xFF3E3523) else Color(0xFFFFF9E4),
                    textColor = if (isDark) Color(0xFFFFE082) else Color(0xFF4E2C00),
                    accentColor = Color(0xFFFFD54F),
                    labelName = "Honey"
                )
            }
            3 -> { // Mint Green
                NoteColorTheme(
                    cardBackground = if (isDark) Color(0xFF23352A) else Color(0xFFEDFBF3),
                    textColor = if (isDark) Color(0xFFB9F6CA) else Color(0xFF003816),
                    accentColor = Color(0xFF69F0AE),
                    labelName = "Mint"
                )
            }
            4 -> { // Ocean Blue
                NoteColorTheme(
                    cardBackground = if (isDark) Color(0xFF233142) else Color(0xFFEEF7FF),
                    textColor = if (isDark) Color(0xFF82B1FF) else Color(0xFF001F4E),
                    accentColor = Color(0xFF448AFF),
                    labelName = "Ocean"
                )
            }
            5 -> { // Lavender Purp
                NoteColorTheme(
                    cardBackground = if (isDark) Color(0xFF332A42) else Color(0xFFFAF2FF),
                    textColor = if (isDark) Color(0xFFEA80FC) else Color(0xFF3B0058),
                    accentColor = Color(0xFFE040FB),
                    labelName = "Lavender"
                )
            }
            else -> { // Default (Standard surface background)
                NoteColorTheme(
                    cardBackground = if (isDark) Color(0xFF23252A) else Color(0xFFF1F3F9),
                    textColor = if (isDark) Color(0xFFE2E2E6) else Color(0xFF1B1B1F),
                    accentColor = if (isDark) Color(0xFF8C939D) else Color(0xFF5A616A),
                    labelName = "Neutral"
                )
            }
        }
    }

    val availableColorIndexes = listOf(0, 1, 2, 3, 4, 5)
}
