import numpy as numpy
import sys
import os
import json
#Pattern matching
import re
#Wav saving
import scipy.io.wavfile
#Zip folder creating
import zipfile

## Reads full audio streams
'''
Packages the audio streams for download without any synchronisation
'''
#Create dictionary filled with a dictionary for each device
devices = {}
for i in range(1, len(sys.argv) - 2):
    var_name = f"Device{i}"
    devices[var_name] = {}

max_length = 0
# Read audio from arguments
audio = {}
for i in range(1, len(sys.argv) - 2):
    #print(sys.argv[i+2])
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+2], dtype='int16', mode='r+')
    if(len(audio[f"audio{i}"]) > max_length):
        max_length = len(audio[f"audio{i}"])

# Pad all audio streams so they are the same length
for device in audio:
    if len(audio[device]) < max_length:
        padding = max_length - len(audio[device])
        audio[device] = numpy.pad(audio[device], (0, padding), mode='constant')

#Save audio channels seperately and in zip file
sample_rate = 48000
for i in range(1,len(sys.argv)-2):
    #parse file extension
    base = os.path.basename(sys.argv[i+2])
    base, ext = os.path.splitext(base)
    directory = os.path.dirname(sys.argv[i+2])
    #Change directory where wav files are created
    scipy.io.wavfile.write(f"{directory}/{base}.wav", sample_rate, audio[f"audio{i}"])

with zipfile.ZipFile(f"{sys.argv[2]}.zip", 'w') as zipf:
    #Add audio channel files
    for i in range(1,len(sys.argv)-2):#
        base = os.path.basename(sys.argv[i+2])
        base, ext = os.path.splitext(base)
        zipf.write(f"{directory}/{base}.wav",f"{base}.wav")
        zipf.write(sys.argv[i+2],f"{base}.pcm")