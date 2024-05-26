import numpy as numpy
import matplotlib.pyplot as plt
import csv
import sys
from numpy.fft import fft, ifft

## Functions ##
def left_shift(arr, shift_amount):
    pass
    #return arr[shift_amount:] + arr[:shift_amount]
    #arr = arr[shift_amount:] + arr[:shift_amount]


def right_shift(arr, shift_amount):
    pass
    #return arr[-shift_amount:] + arr[:-shift_amount]
    #arr = arr[-shift_amount:] + arr[:-shift_amount]


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
#Delimit data in file
delimiters = [' ','\n','\r']
for delimiter in delimiters:
    content = ' '.join(content.split(delimiter))
segments = content.split()

#Search for the phrase within the 'segments' list
#Find index for number of devices in the array
matching_indices = [index for index, segment in enumerate(segments) if 'startrecord' in segment]
if len(matching_indices) != len(devices):
    print('Error with startrecord data')

#Grab start times for each device.
for i in range(1, len(devices)+1):
    for j in range(1, len(devices)+1):
        if(segments[matching_indices[j-1]+1] == f"{i}:"):
            devices[f"Device{i}"]['startrecord'] = segments[matching_indices[j-1]+2]

# Determine the device local times PRBS1 was played
for index, element in enumerate(segments):
    if(element == 'startprbs'):
        devices[f"Device{segments[index+3][0]}"][f"prbs{segments[index+1]}start"] = segments[index+4]

##    READ AUDIO FROM ARGUMENTS 
audio = {}
recordings = {}
for i in range(1,len(sys.argv)-1):
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r+')
    recordings[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r+')


##      Read template PRBS data     ##
prbs1 = open('./public/prbs1.csv', newline='')
csvdata1 = csv.reader(prbs1)
data1 = []
for row in csvdata1:
    data1.append(float(row[0]))
data1 = numpy.array(data1)

# Preprocessing: Normalize amplitudes
data1 = data1 / (numpy.max(numpy.abs(data1)))
for i in range(1,len(audio)+1):
    audio[f"audio{i}"] = audio[f"audio{i}"] / (numpy.max(numpy.abs(audio[f"audio{i}"])))

# Total with of PRBS in samples
bz = 2295 # Change for time for audio to die down

# Cross-correlation each audio and template PRBS
correlations ={}
for i in range(1,len(audio)+1):
    correlations[f"corr{i}"] = numpy.correlate(a=audio[f"audio{i}"], v=data1)
    correlations[f"corr{i}"] = correlations[f"corr{i}"]/numpy.max(numpy.abs(correlations[f"corr{i}"]))

# Detect peaks of each PRBS in each cross-correlation
for i in range(1,len(correlations)+1):
    correlations[f"cp{i}"] = []
    correlations[f"cp{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
    correlations[f"corr{i}"][correlations[f"cp{i}"][0]-bz:correlations[f"cp{i}"][0]+bz] = 0
    for j in range(1,len(devices)):
        correlations[f"cp{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
        correlations[f"corr{i}"][correlations[f"cp{i}"][j]-bz:correlations[f"cp{i}"][j]+bz] = 0
# Sort correlation peaks
for i in range(1, len(devices)+1):
    correlations[f"cp{i}"] = numpy.sort(correlations[f"cp{i}"])

## Sync mismatch calculations ## ADD: Do this with entire audio tracks.
mismatches = {}
distances = {}
Ts = 1/48000 #Sampling time
c = 343 # Velocity of sound in air.  m/s
for i in range(1,len(devices)+1):
    for j in range(1,len(devices)+1):
        mismatches[f"devices{i}_{j}"] = int(numpy.abs((correlations[f"cp{i}"][i-1]-correlations[f"cp{i}"][j-1])-(correlations[f"cp{j}"][i-1]-correlations[f"cp{j}"][j-1])))

file_path_sync = f"{file_path}_sync"
for i in range(1,len(devices)+1):
    for j in range(1,len(devices)+1):
        for k in range(1,len(devices)+1):
            mismatches[f"diff{i}_{j}_{k}"] = correlations[f"cp{j}"][k-1] - correlations[f"cp{i}"][k-1]
            if(mismatches[f"diff{i}_{j}_{k}"] < 0):
                mismatches[f"mov{i}_{j}_{k}"] = -(abs(mismatches[f"diff{i}_{j}_{k}"]) + int(mismatches[f"devices{i}_{j}"]/2))
                with open(file_path_sync, 'a') as file:
                    file.write(f"mov{i}_{j}_{k}: {mismatches[f'mov{i}_{j}_{k}']}\r")
                    file.write(f"diff{i}_{j}_{k}: {mismatches[f'diff{i}_{j}_{k}']}\r")
            if(mismatches[f"diff{i}_{j}_{k}"] > 0):
                mismatches[f"mov{i}_{j}_{k}"] = abs(mismatches[f"diff{i}_{j}_{k}"]) - int(mismatches[f"devices{i}_{j}"]/2)
                with open(file_path_sync, 'a') as file:
                    file.write(f"mov{i}_{j}_{k}: {mismatches[f'mov{i}_{j}_{k}']}\r")
                    file.write(f"diff{i}_{j}_{k}: {mismatches[f'diff{i}_{j}_{k}']}\r")
            if(i == k):
                distances[f"distance{i}_{j}"] = ((mismatches[f"diff{i}_{j}_{k}"] * Ts)/2) * 343
                with open(file_path_sync, 'a') as file:
                    file.write(f"distance{i}_{j}: {distances[f'distance{i}_{j}']}\r")

