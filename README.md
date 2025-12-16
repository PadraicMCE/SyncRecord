# SyncRecord
*Ad hoc synchronised microphone arrays using Android smartphones*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![DOI]()]()

## Overview
**SyncRecord** is an open‑source Android application that turns a group of smartphones into a synchronised microphone array. 
By transforming grouped mobile devices into ad hoc microphone arrays, SyncRecord supports distributed acoustic sensing, sound source localisation, and multi-device audio acquisition.

The system employs audible pseudo-random binary sequences (PRBS) and cross-correlation analysis to estimate inter-device propagation delays and achieve sub-millisecond synchronisation accuracy (approximately four samples at 48 kHz).  
Using only the recorded audio, SyncRecord can also infer the relative positions of participating devices.

Result:

- Sub‑millisecond audio stream temporal alignment (≈ 5 samples at 48 kHz)
- Estimation of the relative geometric positions of the devices. (purely from audio)
- Transient‑only data handling – no audio is stored permanently on the server

---

## Features
- Multi‑device synchronized audio recording on Android 10+ devices (requires `MediaRecorder.AudioSource.UNPROCESSED`)
- Three operating modes
1. **Regular Recording** - Continuous streams, no localisation.
2. **Localise Array** - Used to only compute distances between devices.
3. **Synchronised Reocrding** - Combines localisation and continuous recording to synchronise auto streams.
- Sub‑millisecond alignment – ≈ 5 samples at 48 kHz (≈ 100 µs).
- Server can run **locally** (LAN) or on a **cloud** instance (HTTPS + TLS).
- All data are transient – audio is deleted after the session ends.
- Open‑source, MIT‑licensed, fully extensible (Kotlin client, Node.js + Python backend).
- MIT Licence - free for academic and commercial reuse.
- DOI for citation.

Useful for:
- Distributed acoustic sensing. 
- Sound‑source localisation.  
- Multi‑device audio acquisition for research or field work.

---

## System Architecture
SyncRecord consists of two main components:
### 1. Client Applications (Android)
Android app handles audio capture, audible PRBS emission, UI, and websocket communication.

### 2. Server application (NodeJS / Python)
Node.js orchestrates sessions, streams PCM packets, and called Python scripts.

### 3. Python scripts
Detection.py extracts pair-wisse delays and distances via cross-correlation.
SyncAudio.py aligns streams and builds the final archive.

---

## Quick Start

### *Prerequisites*
- *Android SDK 31 (Android 10) - Device must support* `MediaRecorder.AudioSource.UNPROCESSED` *audio source*.
- *Kotlin 1.8, Gradle 8.13 (wrapper included)*.
- *Node.js (v18.19.1 used during development), npm - bundled with Node (9.2.0 used during development)*
- *Python 3.12.3*

### 1. Clone the repository
```bash
git clone https://github.com/PadraicMCE/SyncRecord.git
cd SyncRecord
```
### 2. Install dependencies
```bash
pip install -r requirements.txt
npm ci
```
### 3. Run the server
```bash
node server.js
```
### 4. Install the SycnRecord
Install the SyncRecord Android .apk on to the Android smartphones being used in the microphone array.

### 5. First-time configuration (client side)
1. Launch the **SyncRecord** app on the device.
2. Open the **Settings** (gear icon) -> **Socket Address**
3. Enter the server address:
    *For a local server:* `http://<your-PC_IP>:3000`
	*FOr a cloud server:* `https://<your-domain>:3000`
4. Choose **Connection type** (`Local` or `Cloud`) to match the server you started.
The client will now be able to join sessions hosted by that server.

### 6. Running a recording session
Steps:
1. On master device press `Create Array`. An array 4-character UID appears.
2. On slave device(s) press `Join Array` and enter the UID shown on the master device, then press `Join`.
3. On master, Choose one of three modes: `Regular Recording`, `Localise Array`, or `Synchronised Recording`.
4. The master can `Stop` the session when finished.
5. After recording has stopped, the master receives a zip file containing audio streams and metadata.

## Installation

### Repository Layout


### 1. Server Setup

### 2. Client Setup

## Data Handling and Privacy
- **No persistent storage** - After the master downloads the zip archive, the server discards all raw audio data.
- **Encryption** - The uses TLS certificates, and the websocket is encrypted end-to-end.
- **No user accounts** - Arrays and sessions are identified only by the short UID; there is no login or personal data collected.

## Example Use

## Citation
if you use this software in your research, please cite:

## License
The **source code** in this repository is released under the **MIT License** - see the `License` file for full text.

The **paper** that describes SyncRecord is licensed under **Creative Commons Attribution 4.0 International (CC-BY 4.0)** as required by the *Journal of Open Research Software*.



