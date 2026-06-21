package com.example.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "notes")
data class Note(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val title: String,
    val content: String,
    val createdAt: Long = System.currentTimeMillis(),
    val isPinned: Boolean = false,
    val colorIndex: Int = 0, // 0 = Default, 1 = Red/Orange, 2 = Yellow, 3 = Green, 4 = Blue, 5 = Purple
    val category: String = "Uncategorized"
)
