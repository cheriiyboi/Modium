package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.data.NoteDatabase
import com.example.data.NoteRepository
import com.example.ui.NoteViewModel
import com.example.ui.NoteViewModelFactory
import com.example.ui.screens.EditScreen
import com.example.ui.screens.ListScreen
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // 1. Initializing database and repository
        val database = NoteDatabase.getDatabase(this)
        val repository = NoteRepository(database.noteDao())
        
        // 2. Initializing our viewModel using our ViewModelFactory
        val viewModelFactory = NoteViewModelFactory(repository)
        val viewModel = ViewModelProvider(this, viewModelFactory)[NoteViewModel::class.java]

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()

                    NavHost(
                        navController = navController,
                        startDestination = "list_screen"
                    ) {
                        composable("list_screen") {
                            ListScreen(
                                viewModel = viewModel,
                                onNavigateToEdit = { noteId ->
                                    navController.navigate("edit_screen/$noteId")
                                }
                            )
                        }

                        composable(
                            route = "edit_screen/{noteId}",
                            arguments = listOf(
                                navArgument("noteId") {
                                    type = NavType.IntType
                                }
                            )
                        ) { backStackEntry ->
                            val noteId = backStackEntry.arguments?.getInt("noteId") ?: -1
                            EditScreen(
                                noteId = noteId,
                                viewModel = viewModel,
                                onNavigateBack = {
                                    navController.popBackStack()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

