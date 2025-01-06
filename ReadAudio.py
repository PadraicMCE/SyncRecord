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
    '''WebApp AudioWorklet saves float32 pcm audio
       Android older versions save int16 pcm audio'''
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='int16', mode='r+')
    recordings[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='int16', mode='r+')
    #audio[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r+')
    #recordings[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r+')
print(f"Audio: {len(audio)}")
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
bz = 760 # Change for time for audio to die down

# Cross-correlation each audio and template PRBS
correlations ={}
correlation_peaks = {}
for i in range(1,len(audio)+1):
    correlations[f"corr{i}"] = numpy.correlate(a=audio[f"audio{i}"], v=data1)
    correlations[f"corr{i}"] = correlations[f"corr{i}"]/numpy.max(numpy.abs(correlations[f"corr{i}"]))
print(f"Correlations: {len(correlations)}")
# Detect peaks of each PRBS in each cross-correlation
for i in range(1,len(correlations)+1):
    correlation_peaks[f"cp{i}"] = []
    correlation_peaks[f"cp{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
    correlations[f"corr{i}"][correlation_peaks[f"cp{i}"][0]-bz:correlation_peaks[f"cp{i}"][0]+bz] = 0
    for j in range(1,len(devices)*3):
        correlation_peaks[f"cp{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
        correlations[f"corr{i}"][correlation_peaks[f"cp{i}"][j]-bz:correlation_peaks[f"cp{i}"][j]+bz] = 0

print(f"Correlations: {len(correlations)}")
print(f"Correlation peaks sequences: {len(correlation_peaks)}")

# Sort correlation peaks
for i in range(1, len(devices)+1):
    correlation_peaks[f"cp{i}"] = numpy.sort(correlation_peaks[f"cp{i}"])
#Check number of samples between peaks
#Number of samples between each peak
sample_distance = 765
#How many PRBS in sequence
num_peaks = 3
# Verify groups of peaks
''' Not correct number of iterations'''
print(f"Number of Devices: {len(devices)}")
for i in range(1, len(correlation_peaks)):
    peaks = correlation_peaks[f"cp{i}"]  # Sorted list of peak indices for correlation set `cp{i}`
    
    # Check for groups of three peaks
    for start in range(0, len(peaks), num_peaks):  # Iterate over groups of 3 peaks
        group = peaks[start:start + num_peaks]  # Extract group
        
        if len(group) == num_peaks:  # Ensure group has exactly 3 peaks
            # Calculate differences between consecutive peaks
            differences = [group[j+1] - group[j] for j in range(len(group) - 1)]
            
            file_path_sync = f"{file_path}_sync"
            # Check if all differences are equal to the expected distance
            if all(diff == sample_distance for diff in differences):
                print(f"Valid group in cp{i}: {group}")
                with open(file_path_sync, 'a') as file:
                    file.write(f"Correlation peaks expected distance: cp{i} {group}\n")
            else:
                print(f"Invalid group in cp{i}: {group} (differences: {differences})")
                with open(file_path_sync, 'a') as file:
                    file.write(f"Correlation peaks not expected distance: cp{i} {group}\\n")
            #Error handling or integrity check.
            '''
            Integrity check for number of samples between correlation peaks
            '''

group_differences = {}
for i in range(1, len(correlations)):
    peaks = correlation_peaks[f"cp{i}"]
    # Calculate group start averages (3 correlation peaks per group)
    group_averages = []
    for group_start in range(0, len(peaks), num_peaks):
        group = peaks[group_start:group_start + num_peaks]
        if len(group) == num_peaks:  # Ensure a full group exists
            group_averages.append(sum(group) / len(group))

    # Calculate differences between consecutive groups
    differences = []
    for j in range(len(group_averages)-1):
        differences.append(group_averages[j+1] - group_averages[j])
    
        # Store results for this recording
        group_differences[f"recording{i}"] = differences
    print(f"group_differences: {group_differences}")

# Compare group differences between recordings
for r1 in range(1, len(group_differences)):  # Iterate over pairs of recordings
    for r2 in range(r1 + 1, len(group_differences) + 1):
        print(f"Comparison between recording{r1} and recording{r2}:")
        
        # Extract differences between groups in the two recordings
        diffs_1 = group_differences[f"recording{r1}"]
        diffs_2 = group_differences[f"recording{r2}"]

        print(f"differences r1: {diffs_1}")
        print(f"differences r2: {diffs_2}")
        
        # Compare specific pairs of groups (e.g., 1st and 2nd, 1st and 3rd, etc.)
        for g1 in range(len(diffs_1)):
            if g1 < len(diffs_2):  # Ensure both recordings have the same group
                diff_between_recordings = abs(diffs_1[g1] - diffs_2[g1])
                print(f"  Groups {g1+1} and {g1+2}: Difference = {diff_between_recordings} samples")

'''ADD Error Handling'''

## Sync mismatch calculations ## ADD: Do this with entire audio tracks.
mismatches = {}
distances = {}
Ts = 1/48000 #Sampling time
c = 343 # Velocity of sound in air.  m/s

'''
for i in range(1,len(devices)+1):
    #Sorted list of correlation peaks for the device
    peaks = correlations[f"cp{i}"]
''' 

'''
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
                    file.write(f"mov{i}_{j}_{k}: {mismatches[f'mov{i}_{j}_{k}']}\n")
                    file.write(f"diff{i}_{j}_{k}: {mismatches[f'diff{i}_{j}_{k}']}\n")
            if(mismatches[f"diff{i}_{j}_{k}"] > 0):
                mismatches[f"mov{i}_{j}_{k}"] = abs(mismatches[f"diff{i}_{j}_{k}"]) - int(mismatches[f"devices{i}_{j}"]/2)
                with open(file_path_sync, 'a') as file:
                    file.write(f"mov{i}_{j}_{k}: {mismatches[f'mov{i}_{j}_{k}']}\n")
                    file.write(f"diff{i}_{j}_{k}: {mismatches[f'diff{i}_{j}_{k}']}\n")
            if(i == k):
                distances[f"distance{i}_{j}"] = ((mismatches[f"diff{i}_{j}_{k}"] * Ts)/2) * 343
                with open(file_path_sync, 'a') as file:
                    file.write(f"distance{i}_{j}: {distances[f'distance{i}_{j}']}\n")
'''
