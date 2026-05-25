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
Reads the JSON file for each recording session and uses the synchronisation
mismatch to shift the audio recordings then creates a multichannel audio file
for download.
'''
#Create dictionary filled with a dictionary for each device
devices = {}
for i in range(1, len(sys.argv) - 2):
    var_name = f"Device{i}"
    devices[var_name] = {}

#Read .txt file associated with the recordings
file_path = sys.argv[2]
# Open the file for reading
with open(file_path, 'r') as file:
    content = file.read().strip()

try:
    data = json.loads(content)
    #print("Valid JSON detected")
except json.JSONDecodeError:
    # Multiple concatenated JSON objects - parse each separately
    #print("Multiple JSON objects detected - parsing individually")
    all_data = {}
    # Find all JSON objects using regex
    json_objects = re.findall(r'\{[^{}]+\}', content)
    for obj_str in json_objects:
        try:
            obj = json.loads(obj_str)
            all_data.update(obj)
        except json.JSONDecodeError:
            continue
    data = all_data

# Audio time shift information
shifts = {}

# Track all devices and peak types found
all_devices = set()
all_peak_types = set()

for key, value in data.items():
    if not isinstance(value, (int, float)):
        continue

    # ---- shift_i_j (directional!) ----
    m = re.match(r'^shift_(\d+)_(\d+)$', key)
    if m:
        i, j = int(m.group(1)), int(m.group(2))
        shifts.setdefault(i, {})[j] = value
        all_devices.update([i, j])
        continue

# Read audio from arguments
audio = {}
for i in range(1, len(sys.argv) - 2):
    print(sys.argv[i+2])
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+2], dtype='int16', mode='r+')

device_list = sorted(all_devices)
peak_types = sorted(all_peak_types)
num_devices = len(device_list)

# Device used as the global reference
reference_device = 1

# Synchronised audio streams   
syncAudio = {}
max_length = 0
for device_id in device_list:
    if device_id == reference_device:
        syncAudio[device_id]=audio[f"audio{device_id}"]
        continue
    shift_val = shifts[reference_device][device_id]
    # If audio needs to be delayed in time (zero padded at beginning)
    if(shift_val > 0):
        # Delay: prepend zeros
        num_zeros = int(numpy.abs(shift_val))
        zeros = numpy.zeros(num_zeros, dtype=numpy.float32)
        new_array = numpy.concatenate((zeros, audio[f"audio{device_id}"]), axis=0)
    if(shift_val < 0):
        # Advance: truncate start
        num_skip = int(abs(shift_val))
        if num_skip >= len(audio[f"audio{device_id}"]):
            new_array = numpy.array([], dtype=numpy.float32)
        else:
            new_array = audio[f"audio{device_id}"][num_skip:]
    # assign new synchronised audio stream
    syncAudio[device_id]=new_array
    # Find longest audio stream
    if len(new_array) > max_length:
        max_length = len(new_array)

# Pad all audio streams so they are the same length
for device in syncAudio:
    if len(syncAudio[device]) < max_length:
        padding = max_length - len(syncAudio[device])
        syncAudio[device] = numpy.pad(syncAudio[device], (0, padding), mode='constant')

#Save audio channels seperately and in zip file
sample_rate = 48000
for i in range(1,len(sys.argv)-2):
    #parse file extension
    base = os.path.basename(sys.argv[i+2])
    base, ext = os.path.splitext(base)
    directory = os.path.dirname(sys.argv[i+2])
    #Change directory where wav files are created
    scipy.io.wavfile.write(f"{directory}/{base}_sync.wav", sample_rate, syncAudio[i])
    # If the data is currently float32/64 convert to int16
    if numpy.issubdtype(audio[f"audio{i}"].dtype, numpy.floating):
        # Clip values to [-1.0, 1.0]
        audio[f"audio{i}"] = numpy.clip(audio[f"audio{i}"], -1.0, 1.0)
        # Scale to int16
        audio_int16 = (audio[f"audio{i}"] * 32767).astype(numpy.int16)
    elif audio[f"audio{i}"].dtype == numpy.int16:
        # Already int16
        audio_int16 = numpy.asarray(audio[f"audio{i}"])
    else:
        # Fallback
        audio_int16 = audio[f"audio{i}"].astype(numpy.int16)
    # Output filename
    output_filename = f"{directory}/{base}_sync.pcm"
    # Write binary data
    with open(output_filename, 'wb') as f:
        f.write(audio_int16.tobytes())

with zipfile.ZipFile(f"{sys.argv[2]}.zip", 'w') as zipf:
    #Add audio channel files
    for i in range(1,len(sys.argv)-2):#
        base = os.path.basename(sys.argv[i+2])
        base, ext = os.path.splitext(base)
        zipf.write(f"{directory}/{base}_sync.wav",f"{base}_sync.wav")
        zipf.write(sys.argv[i+2],f"{base}.pcm")
        zipf.write(f"{directory}/{base}_sync.pcm",f"{base}_sync.pcm")
    zipf.write(sys.argv[2],f"data.txt")