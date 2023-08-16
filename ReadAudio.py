import numpy as numpy
import matplotlib.pyplot as plt
import csv
import sys
from numpy.fft import fft, ifft
#from fastdtw import fastdtw
#print('python script started')

#numDevices = 4
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
#print(segments)

# Search for the phrase within the 'segments' list
#Find index for number of devices in the array

matching_indices = [index for index, segment in enumerate(segments) if 'startrecord' in segment]
if len(matching_indices) != len(devices):
    print('Error with startrecord data') #Add extra error handling

#Grab start times for each device. Currently undefined (zero)
for i in range(1, len(devices)+1):
    #print(i)
    for j in range(1, len(devices)+1):
        if(segments[matching_indices[j-1]+1] == f"{i}:"):
            devices[f"Device{i}"]['startrecord'] = segments[matching_indices[j-1]+2]


# Determine the device local times PRBS1 was played
for index, element in enumerate(segments):
    if(element == 'startprbs'):
        devices[f"Device{segments[index+3][0]}"][f"prbs{segments[index+1]}start"] = segments[index+4]
#print(devices)

## STOP PRBS INDICES ##
for index, element in enumerate(segments):
    if(element == 'stoppedprbs'):
        devices[f"Device{segments[index+3][0]}"][f"prbs{segments[index+1]}stop"] = segments[index+4]

#print(devices)

##    READ AUDIO FROM ARGUMENTS ##
audio = {}
for i in range(1,len(sys.argv)-1):
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+1], dtype='float32', mode='r')

#print('read audio')

##      Read template PRBS data     ##
prbs1 = open('prbs1.csv', newline='')
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
bz = 2295 # Change for time for audio to die down 765

# Cross-correlation each audio and template PRBS
correlations ={}
for i in range(1,len(audio)+1):
    correlations[f"corr{i}"] = numpy.correlate(a=audio[f"audio{i}"], v=data1)
    correlations[f"corr{i}"] = correlations[f"corr{i}"]/numpy.max(numpy.abs(correlations[f"corr{i}"]))

## FOR TESTING CORRELATION PEAK CALCULATION ##
correlationsb ={}
for i in range(1,len(audio)+1):
    correlationsb[f"corr{i}"] = numpy.correlate(a=audio[f"audio{i}"], v=data1)
    correlationsb[f"corr{i}"] = correlationsb[f"corr{i}"]/numpy.max(numpy.abs(correlationsb[f"corr{i}"]))

# Detect peaks of each PRBS in each cross-correlation
for i in range(1,len(correlations)+1):
    correlations[f"cp{i}"] = []
    correlations[f"cp{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
    correlations[f"corr{i}"][correlations[f"cp{i}"][0]-bz:correlations[f"cp{i}"][0]+bz] = 0
    for j in range(1,len(devices)):
        correlations[f"cp{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
        correlations[f"corr{i}"][correlations[f"cp{i}"][j]-bz:correlations[f"cp{i}"][j]+bz] = 0

for i in range(1, len(devices)+1):
    correlations[f"cp{i}"] = numpy.sort(correlations[f"cp{i}"])

print(correlations["cp1"])
print(correlations["cp2"])
print(correlations["cp3"])
print(correlations["cp4"])

## Sync mismatch calculations ##
mismatches = {}
for i in range(1,len(devices)+1):
    for j in range(1,len(devices)+1):
        mismatches[f"devices{i}_{j}"] = numpy.abs((correlations[f"cp{i}"][i-1]-correlations[f"cp{i}"][j-1])-(correlations[f"cp{j}"][i-1]-correlations[f"cp{j}"][j-1]))
        #print(f"{i}_{j}")
        #(correlations[f"cp{i}"][i-1] - correlations[f"cp{i}"][j-1])
print(mismatches)




## Plots for illustration ##
#'''
fig, axs = plt.subplots(4, 1)
axs[0].plot(correlationsb["corr1"])
axs[1].plot(correlationsb["corr2"])
axs[2].plot(correlationsb["corr3"])
axs[3].plot(correlationsb["corr4"])
axs[0].stem(correlations["cp1"],numpy.ones(4),'b')
axs[1].stem(correlations["cp2"],numpy.ones(4),'b')
axs[2].stem(correlations["cp3"],numpy.ones(4),'b')
axs[3].stem(correlations["cp4"],numpy.ones(4),'b')

axs[0].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[1].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[2].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[3].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))

plt.tight_layout()
plt.show()
#'''