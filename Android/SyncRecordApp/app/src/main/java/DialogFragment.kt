// DialogFragment.kt
package com.mcevoy.syncrecordapp

import android.app.Dialog
import android.os.Bundle
import androidx.fragment.app.DialogFragment
import androidx.appcompat.app.AlertDialog
import android.view.LayoutInflater
import android.widget.ToggleButton // Import ToggleButton
import com.google.android.material.textfield.TextInputEditText

class SettingsDialogFragment : DialogFragment() {

    interface OnInputListener {
        fun sendInput(inputAddress: String, serverType: ServerType)
    }

    private var inputListener: OnInputListener? = null

    companion object {
        private const val ARG_CURRENT_ADDRESS = "current_address"
        private const val ARG_CURRENT_SERVER_TYPE = "current_server_type"

        // Factory method to create an instance with pre-filled data
        fun newInstance(currentAddress: String, currentServerType: ServerType): SettingsDialogFragment {
            val fragment = SettingsDialogFragment()
            val args = Bundle()
            args.putString(ARG_CURRENT_ADDRESS, currentAddress)
            // CHANGE 1: Pass the enum as its name (String)
            args.putString(ARG_CURRENT_SERVER_TYPE, currentServerType.name)
            fragment.arguments = args
            return fragment
        }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val builder = AlertDialog.Builder(requireActivity())

        val inflater: LayoutInflater = requireActivity().layoutInflater
        val view = inflater.inflate(R.layout.dialog_settings, null)

        val textSocketAddress: TextInputEditText = view.findViewById(R.id.textSocketAddress)
        val toggleButtonServerType: ToggleButton = view.findViewById(R.id.toggleButton)

        // Retrieve initial values from arguments and set them
        arguments?.let {
            val currentAddress = it.getString(ARG_CURRENT_ADDRESS)
            // CHANGE 2: Retrieve the enum's name (String) and convert back to ServerType
            val currentServerTypeString = it.getString(ARG_CURRENT_SERVER_TYPE)
            val currentServerType = currentServerTypeString?.let { name -> ServerType.valueOf(name) }
                ?: ServerType.CLOUD // Provide a default if not found or invalid

            currentAddress?.let { addr -> textSocketAddress.setText(addr) }
            // Set the ToggleButton based on the current server type
            toggleButtonServerType.isChecked = (currentServerType == ServerType.LOCAL)
        }

        toggleButtonServerType.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                textSocketAddress.hint = "e.g., 192.168.1.100:3000"
            } else {
                textSocketAddress.hint = "e.g., syncrecord.eu:3000"
            }
        }
        val initialIsLocal = toggleButtonServerType.isChecked
        if (initialIsLocal) {
            textSocketAddress.hint = "e.g., 192.168.1.100:3000"
        } else {
            textSocketAddress.hint = "e.g., syncrecord.eu:3000"
        }

        builder.setView(view)
            .setTitle("Socket Host Settings")
            .setPositiveButton("OK") { dialog, id ->
                val inputAddress = textSocketAddress.text.toString().trim()
                val selectedServerType = if (toggleButtonServerType.isChecked) {
                    ServerType.LOCAL
                } else {
                    ServerType.CLOUD
                }
                inputListener?.sendInput(inputAddress, selectedServerType)
                dialog.dismiss()
            }
            .setNegativeButton("Cancel") { dialog, id ->
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