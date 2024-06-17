package com.mcevoy.syncrecordapp

import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat


class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        // Interface
        val btnJoin: Button = findViewById(R.id.joinButton)
        val inputID: EditText = findViewById(R.id.IDInput)

        inputID.setOnEditorActionListener{v, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_DONE){
                btnJoin.performClick()
                true
            }
            else {
                false
            }
        }

        btnJoin.setOnClickListener {
            // Check Array ID is valid
            //inputID.setText("Button Clicked")
            // Join array through sockets.
        }

    }
}
