package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.Note
import com.example.ui.NoteViewModel
import com.example.ui.theme.NoteColorPalette

@Composable
fun EditScreen(
    noteId: Int,
    viewModel: NoteViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Personal") }
    var selectedColorIndex by remember { mutableStateOf(0) }
    var isPinned by remember { mutableStateOf(false) }
    var originalCreatedAt by remember { mutableStateOf(System.currentTimeMillis()) }

    var isLoaded by remember { mutableStateOf(false) }

    // Retrieve note if editing
    if (noteId != -1 && !isLoaded) {
        val noteFlow = remember(noteId) { viewModel.getNoteById(noteId) }
        val existingNote by noteFlow.collectAsState(initial = null)

        LaunchedEffect(existingNote) {
            existingNote?.let {
                title = it.title
                content = it.content
                selectedCategory = it.category
                selectedColorIndex = it.colorIndex
                isPinned = it.isPinned
                originalCreatedAt = it.createdAt
                isLoaded = true
            }
        }
    } else {
        isLoaded = true
    }

    val noteColorTheme = NoteColorPalette.getColorsForIndex(selectedColorIndex)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(noteColorTheme.cardBackground)
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            containerColor = Color.Transparent, // Let parent Box background shine through
            topBar = {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = onNavigateBack,
                        modifier = Modifier.testTag("back_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Navigate back",
                            tint = noteColorTheme.textColor
                        )
                    }

                    Text(
                        text = if (noteId == -1) "New Note" else "Edit Note",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = noteColorTheme.textColor
                    )

                    Row {
                        // Pin Toggle
                        IconButton(
                            onClick = { isPinned = !isPinned },
                            modifier = Modifier.testTag("edit_pin_toggle")
                        ) {
                            Icon(
                                imageVector = if (isPinned) Icons.Filled.PushPin else Icons.Outlined.PushPin,
                                contentDescription = "Toggle Pin Note",
                                tint = if (isPinned) noteColorTheme.textColor else noteColorTheme.textColor.copy(alpha = 0.4f)
                            )
                        }

                        // Save Check Button
                        IconButton(
                            onClick = {
                                viewModel.saveNote(
                                    Note(
                                        id = if (noteId == -1) 0 else noteId,
                                        title = title,
                                        content = content,
                                        createdAt = if (noteId == -1) System.currentTimeMillis() else originalCreatedAt,
                                        isPinned = isPinned,
                                        colorIndex = selectedColorIndex,
                                        category = selectedCategory
                                    )
                                )
                                onNavigateBack()
                            },
                            modifier = Modifier.testTag("save_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Save and complete",
                                tint = noteColorTheme.textColor
                            )
                        }

                        // Delete button (Only show for existing notes)
                        if (noteId != -1) {
                            IconButton(
                                onClick = {
                                    viewModel.deleteNoteById(noteId)
                                    onNavigateBack()
                                },
                                modifier = Modifier.testTag("delete_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = "Delete note",
                                    tint = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .imePadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Category Tag Selector
                Text(
                    text = "Category",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = noteColorTheme.textColor.copy(alpha = 0.8f)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val editCategories = viewModel.categories.filter { it != "All" }
                    editCategories.forEach { cat ->
                        val isSel = selectedCategory == cat
                        FilterChip(
                            selected = isSel,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = noteColorTheme.textColor.copy(alpha = 0.2f),
                                selectedLabelColor = noteColorTheme.textColor,
                                containerColor = noteColorTheme.cardBackground.copy(alpha = 0.5f),
                                labelColor = noteColorTheme.textColor.copy(alpha = 0.5f)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.testTag("edit_category_chip_$cat")
                        )
                    }
                }

                // Color index palette selector
                Text(
                    text = "Select Palette Color",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = noteColorTheme.textColor.copy(alpha = 0.8f)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    NoteColorPalette.availableColorIndexes.forEach { colorIndex ->
                        val itemTheme = NoteColorPalette.getColorsForIndex(colorIndex)
                        val isSelected = selectedColorIndex == colorIndex

                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(itemTheme.cardBackground)
                                .border(
                                    width = if (isSelected) 3.dp else 1.dp,
                                    color = if (isSelected) noteColorTheme.textColor else itemTheme.textColor.copy(alpha = 0.2f),
                                    shape = CircleShape
                                )
                                .clickable { selectedColorIndex = colorIndex }
                                .testTag("color_ring_$colorIndex"),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = noteColorTheme.textColor,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }

                // Note Title Box
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    placeholder = {
                        Text(
                            "Title",
                            style = TextStyle(
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                color = noteColorTheme.textColor.copy(alpha = 0.4f)
                            )
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("note_title_input"),
                    textStyle = TextStyle(
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = noteColorTheme.textColor
                    ),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedBorderColor = noteColorTheme.textColor.copy(alpha = 0.15f),
                        unfocusedBorderColor = Color.Transparent
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Note Content Box
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    placeholder = {
                        Text(
                            "Note details...",
                            style = TextStyle(
                                fontSize = 16.sp,
                                color = noteColorTheme.textColor.copy(alpha = 0.4f)
                            )
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .defaultMinSize(minHeight = 260.dp)
                        .testTag("note_content_input"),
                    textStyle = TextStyle(
                        fontSize = 16.sp,
                        color = noteColorTheme.textColor
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        focusedBorderColor = noteColorTheme.textColor.copy(alpha = 0.12f),
                        unfocusedBorderColor = Color.Transparent
                    )
                )
            }
        }
    }
}
