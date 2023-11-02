import numpy as numpy
import sys
#Pattern matching
import re
#Wav saving
import scipy.io.wavfile

## Just for test plots ##
import matplotlib.pyplot as plt
#######

## Reads full audio streams
'''
Reads the .txt file for each recording session and uses the synchronisation
mismatch to shift the audio recordings then creates a multichannel audio file
for download.
TODO: Everything
'''
#Create dictionary filled with a dictionary for each device
devices = {}
for i in range(1,len(sys.argv) - 1):
    var_name = f"Device{i}"
    devices[var_name] = {}

#Read .txt file associated with the recordings
file_path = sys.argv[1]
# Open the file for reading
with open(file_path, 'r') as file:
    content = file.read()
delimiters = [' ','\n','\r']
for delimiter in delimiters:
    content = ' '.join(content.split(delimiter))
segments  = content.split()

#print(segments)

# Check data in segments for mov{i}_{j}_{i}
# Create an array of mismatches between devices
mismatches = {}
for i in range(0, len(segments),2):
    entry = segments[i]
    match = re.match(r'mov(\d+)_(\d+)_(\d+)', entry)
    #print(match)
    if match:
        ##Add: Create array of all mismatches between devices
        a = int(match.group(1))
        b = int(match.group(2))
        c = int(match.group(3))
        if i + 1 < len(segments):
            number = segments[i + 1]
        if(a == c):
            ## Add to array of mismatches
            #print(f"{segments[i]}: {number}")
            if(b > a):
                # Check if the list exists and is not None
                if f"{a}_{b}" not in mismatches:
                    #create
                    mismatches[f"{a}_{b}"] = [int(number)]
                else:
                    #append
                    mismatches[f"{a}_{b}"].append(int(number))
                #print(f"mismatches[{a}_{b}]")
            elif(a > b):
                # Check if the list exists and is not None
                if f"{b}_{a}" not in mismatches:
                    #create
                    mismatches[f"{b}_{a}"] = [int(number)]
                else:
                    # append 
                    mismatches[f"{b}_{a}"].append(int(number))
                #print(f"mismatches[{b}_{a}]")

#print(mismatches)
#Use the mismatch values to get mean mismatch for each pair of devices.
            
# Read audio from arguments
audio = {}
recordings = {}
for i in range(1,len(sys.argv)-1):
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r+')
    #recordings[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r+')
meanmismatches = {}
for key in mismatches.keys():
    mean = numpy.mean(numpy.abs(mismatches[key]))
    if(mismatches[key][0] < 0):
        mean = - mean
    meanmismatches[f"{key}"] = round(mean)


# Synchronise audio channels
syncAudio = {}
syncAudio[f'audio{1}'] = audio[f'audio{1}']
max_length = len(syncAudio[f"audio{int(1)}"])
for key in meanmismatches.keys():
    if(key[0] == "1" and meanmismatches[key] < 0):
        new_array = numpy.concatenate((numpy.zeros(int(numpy.abs(meanmismatches[f"{key}"])),dtype=numpy.float32),audio[f"audio{key[2]}"]),axis=0)
        syncAudio[f"audio{key[2]}"] = new_array
        if(len(new_array) > max_length):
            max_length = len(new_array)
    elif(key[0] == "1" and meanmismatches[key] > 0):
        new_array = audio[f"audio{key[2]}"][abs(meanmismatches[f"{key}"]):]
        syncAudio[f"audio{key[2]}"] = new_array
        if(len(new_array) > max_length):
            max_length = len(new_array)

# Create multichannel audio
channels = []
# Pad shorter audio channels
for i in range(1,len(syncAudio)+1):
    syncAudio[f"audio{i}"] = numpy.pad(syncAudio[f"audio{i}"], (0, max_length - len(syncAudio[f"audio{i}"])), mode='constant')
    channels.append(syncAudio[f"audio{i}"])
# Combine the padded audio arrays into a multi-channel array
multichannel_data = numpy.column_stack(channels)
#print(multichannel_data.shape)

#Save audio channels into wav file
sample_rate = 48000
#print(f"Saving {sys.argv[1]}.wav a {multichannel_data.shape[1]} channel audio file")
scipy.io.wavfile.write(f"{sys.argv[1]}.wav", sample_rate, multichannel_data)



### Visualisation for testing ###
'''
print(meanmismatches)
## Visual testing plots
fig, axs = plt.subplots(len(devices),1)
maxx = 0
for i in range(0,len(audio),1):
    print(f"Plotting audio{i+1}")
    axs[i].plot(audio[f"audio{i+1}"])
    if(len(audio[f"audio{i+1}"]) > maxx):
        maxx = len(audio[f"audio{i+1}"])
i = 1
for key in meanmismatches.keys():
    print(key[0])
    if(key[0] == "1" and meanmismatches[key] < 0):
        print(f"Concatenating {int(numpy.abs(meanmismatches[f'{key}']))} to audio{key[2]}")
        new_array = numpy.concatenate((numpy.zeros(int(numpy.abs(meanmismatches[f"{key}"])),dtype=numpy.float32),audio[f"audio{key[2]}"]),axis=0)
        axs[int(f"{key[2]}")-1].plot(new_array)
        if(len(new_array) > maxx):
            maxx = len(new_array)
    elif(key[0] == "1" and meanmismatches[key] > 0):
        new_array = audio[f"audio{key[2]}"][abs(meanmismatches[f"{key}"]):]
        axs[int(f"{key[2]}")-1].plot(new_array)
        if(len(new_array) > maxx):
            maxx = len(new_array)

    i  = i+1

for ax in axs:
    ax.set_xlim(0, maxx)  # Set the x-axis limits
plt.show()
'''
### ################## ###