# SyncRecord
*Ad hoc synchronised microphone arrays using Android smartphones*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![DOI]()]()

## Overview
**SyncRecord** is an open‑source Android application that turns a group of smartphones into a synchronised microphone array. 
By transforming grouped mobile devices into ad hoc microphone arrays, SyncRecord supports distributed acoustic sensing, sound source localisation, and multi-device audio acquisition.

The system employs audible pseudo-random binary sequences (PRBS) and cross-correlation analysis to estimate inter-device propagation delays and achieve sub-millisecond synchronisation accuracy (approximately four samples at 48 kHz).  
Using only the recorded audio, SyncRecord can also infer the relative positions of participating devices.

Result:*

- Sub‑millisecond audio stream temporal alignment (≈ 5 samples at 48 kHz)
- Estimation of the relative geometric positions of the devices. (purely from audio)
- Transient‑only data handling – no audio is stored permanently on the server

---

## Features
- Multi‑device synchronized audio recording on Android 10+ devices (requires `MediaRecorder.AudioSource.UNPROCESSED`)
- Sub‑millisecond alignment – ≈ 5 samples at 48 kHz (≈ 100 µs).
- Three operating modes: **Regular Recording**, **Localise Array**, **Synchronised Recording**.
- Server can run **locally** (LAN) or on a **cloud** instance (HTTPS + TLS).
- All data are transient – audio is deleted after the session ends.
- Open‑source, MIT‑licensed, fully extensible (Kotlin client, Node.js + Python backend).
- DOI for citation.

Useful for:
- Distributed acoustic sensing. 
- Sound‑source localisation.  
- Multi‑device audio acquisition for research or field work.

---

## System Architecture
SyncRecord consists of two main components:
### 1. Client Applications (Android)
Android app handels audio capture, audible PRBS emission, UI, and websocket communication.

### 2. Server application (NodeJS / Python)
Node.js orchestrates sessions, streams PCM packets, and called Python scripts.

### 3. Python scripts
Detection.py extracts delays via cross-correlation.
SyncAudio.py aligns streams and builds the final archive.

---

## Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/PadraicMCE/SyncRecord.git
cd SyncRecord

```
## Installation

### 1. Server Setup

### 2. Client Setup

## Data Handling

## Example Use

## Citation
if you use this software in your research, please cite:

