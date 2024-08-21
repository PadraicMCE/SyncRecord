package com.mcevoy.syncrecordapp

import android.app.Dialog
import android.os.Bundle
import androidx.fragment.app.DialogFragment
import androidx.appcompat.app.AlertDialog
import android.view.LayoutInflater
import com.google.android.material.textfield.TextInputEditText

class SettingsDialogFragment : DialogFragment() {

    // Interface to communicate with the activity
    interface OnInputListener {
        fun sendInput(input: String)
    }

    private var inputListener: OnInputListener? = null

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val builder = AlertDialog.Builder(requireActivity())

        // Inflate the custom layout for the dialog
        val inflater: LayoutInflater = requireActivity().layoutInflater
        val view = inflater.inflate(R.layout.dialog_settings, null)
        val textSocket: TextInputEditText = view.findViewById(R.id.textSocketAddress)

        // Set the view and other dialog properties
        builder.setView(view)
            .setTitle("Socket Host Settings")
            .setPositiveButton("OK") { dialog, id ->
                // Handle the OK button click
                inputListener?.sendInput(textSocket.text.toString())
                dialog.dismiss()
            }
            .setNegativeButton("Cancel") { dialog, id ->
                // Handle the Cancel button click
                dialog.dismiss()
            }

        return builder.create()
    }

    override fun onAttach(context: android.content.Context) {
        super.onAttach(context)
        try {
            inputListener = context as OnInputListener
        } catch (e: ClassCastException) {
            throw ClassCastException("$context must implement OnInputListener")
        }
    }

    override fun onDetach() {
        super.onDetach()
        inputListener = null
    }
}
