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

# Search for the phrase within the 'segments' list
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

## Read STOP PRBS INDICES ##
lastprbs = {}
for index, element in enumerate(segments):
    if(element == 'stoppedprbs'):
        devices[f"Device{segments[index+3][0]}"][f"prbs{segments[index+1]}stop"] = segments[index+4]


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
# Sort correlation peaks
for i in range(1, len(devices)+1):
    correlations[f"cp{i}"] = numpy.sort(correlations[f"cp{i}"])

## Sync mismatch calculations ## ADD: Do this with entire audio tracks.
mismatches = {}
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
                    file.write(f"mov{i}_{j}_{k}: {mismatches[f"mov{i}_{j}_{k}"]}\r")
            if(mismatches[f"diff{i}_{j}_{k}"] > 0):
                mismatches[f"mov{i}_{j}_{k}"] = abs(mismatches[f"diff{i}_{j}_{k}"]) - int(mismatches[f"devices{i}_{j}"]/2)
                with open(file_path_sync, 'a') as file:
                    file.write(f"mov{i}_{j}_{k}: {mismatches[f"mov{i}_{j}_{k}"]}\r")

# Shift recordings ADD: Shift Entire recordings from PRBS Sections.
#print(mismatches)

'''
fig, axs = plt.subplots(len(devices), 1)
for i in range(1,len(devices)+1):
    if(mismatches[f"diff1_{i}_1"] < 0):
        new_array = numpy.concatenate((numpy.zeros((int(numpy.abs(mismatches[f"mov1_{i}_1"])),),dtype=numpy.float32), audio[f"audio{i}"][:len(audio[f"audio{i}"])-abs(mismatches[f"mov1_{i}_1"])]),dtype=numpy.float32)
        axs[i-1].plot(new_array,label=f"Alignment1_{i}")
        axs[i-1].text(correlations[f"cp{i}"][0]+abs(mismatches[f"mov1_{i}_1"]), -0.9, correlations[f"cp{i}"][0]+abs(mismatches[f"mov1_{i}_1"]), fontsize=12, color='red')
        axs[i-1].stem(correlations[f"cp{i}"][0]+abs(mismatches[f"mov1_{i}_1"]),-0.9,'r')
        axs[i-1].text(correlations[f"cp{i}"][1]+abs(mismatches[f"mov1_{i}_1"]), -0.9, correlations[f"cp{i}"][1]+abs(mismatches[f"mov1_{i}_1"]), fontsize=12, color='red')
        axs[i-1].stem(correlations[f"cp{i}"][1]+abs(mismatches[f"mov1_{i}_1"]),-0.9,'r')
        axs[0].axvline(x=correlations[f"cp{i}"][0]+abs(mismatches[f"mov1_{i}_1"]), color='red', linestyle='--')
    if(mismatches[f"diff1_{i}_1"] > 0):
        new_array = audio[f"audio{i}"][abs(mismatches[f"mov1_{i}_1"]):]
        axs[i-1].plot(new_array,label=f"Alignment1_{i}")
        axs[i-1].text(correlations[f"cp{i}"][0]-abs(mismatches[f"mov1_{i}_1"]), -0.9, correlations[f"cp{i}"][0]-abs(mismatches[f"mov1_{i}_1"]), fontsize=12, color='red')
        axs[i-1].stem(correlations[f"cp{i}"][0]-abs(mismatches[f"mov1_{i}_1"]),-0.9,'r')
        axs[i-1].text(correlations[f"cp{i}"][1]-abs(mismatches[f"mov1_{i}_1"]), -0.9, correlations[f"cp{i}"][1]-abs(mismatches[f"mov1_{i}_1"]), fontsize=12, color='red')
        axs[i-1].stem(correlations[f"cp{i}"][1]-abs(mismatches[f"mov1_{i}_1"]),-0.9,'r')
        axs[0].axvline(x=correlations[f"cp{i}"][0]-abs(mismatches[f"mov1_{i}_1"]), color='red', linestyle='--')
    axs[i-1].legend()
plt.show()
'''

'''
fig, axs = plt.subplots(len(devices), 1)
for i in range(1,len(devices)+1):
    axs[i-1].plot(audiobackup[f"audio{i}"],label=f"audio{i}")
    axs[i-1].legend()
for i in range(1,len(devices)+1):
    for j in range(1,len(devices)+1):
        if(mismatches[f"mov{i}_{j}_{1}"] < 0):
            new_array = numpy.concatenate((numpy.zeros((int(numpy.abs(mismatches[f"mov{i}_{j}_{1}"]-1)),),dtype=numpy.float32), audio[f"audio{j}"][:len(audio[f"audio{j}"])-abs(mismatches[f"mov{i}_{j}_{1}"]-1)]),dtype=numpy.float32)
            axs[j-1].plot(new_array,label=f"Alignment{i}_{j}")
        if(mismatches[f"mov{i}_{j}_{1}"] > 0):
            new_array = audio[f"audio{j}"][mismatches[f"mov{i}_{j}_{1}"]-1:]
            axs[j-1].plot(new_array,label=f"Alignment{i}_{j}")
        axs[i-1].legend()
plt.show()
'''

## Need to dynamically fix syncronisation mismatch
'''
diff1_2 = correlations["cp2"][0] - correlations["cp1"][0]
#print(diff1_2)
mov1_2 = diff1_2 - int(mismatches["devices1_2"]/2)
#print(mov1_2)
shift_amount1_2 = mov1_2 % len(audio["audio2"])
#print(shift_amount1_2)
#print(len(audio["audio2"]))
# Perform circular shift
new_array = numpy.concatenate((audio["audio2"][shift_amount1_2:], audio["audio2"][:shift_amount1_2]))
#new_array = numpy.concatenate((numpy.zeros((int(numpy.abs(mov1_2-1)),),dtype=numpy.float32), audio["audio2"][:len(audio["audio2"])-abs(mov1_2-1)]),dtype=numpy.float32)
#new_array = audio["audio2"][abs(mov1_2):]
# Update the memmap array with the shifted data
audio["audio2"] = new_array

diff1_3 = correlations["cp3"][0] - correlations["cp1"][0]
mov1_3 = diff1_3 - mismatches["devices1_3"]
shift_amount1_3 = mov1_3 % len(audio["audio3"])
# Perform circular shift
#new_array = numpy.concatenate((audio["audio3"][mov1_3:], audio["audio3"][:mov1_3]))
new_array = numpy.concatenate((audio["audio3"][shift_amount1_3:], audio["audio3"][:shift_amount1_3]))
# Update the memmap array with the shifted data
audio["audio3"][:] = new_array

diff1_4 = correlations["cp4"][0] - correlations["cp1"][0]
mov1_4 = diff1_4 - mismatches["devices1_4"]
shift_amount1_4 = mov1_4 % len(audio["audio4"])
# Perform circular shift
new_array1 = numpy.concatenate((audio["audio4"][mov1_4:], audio["audio4"][:mov1_4]))
# Update the memmap array with the shifted data
audio["audio4"][:] = new_array1

## New cross-correlation with shifted audio3 ## FOR TESTING
peaks = []
corr3new = numpy.correlate(a=new_array, v=data1)
cp3new = numpy.nanargmax(corr3new)
peaks.append(cp3new)
corr3new[cp3new-2295:cp3new+2295] = 0
cp3new = numpy.nanargmax(corr3new)
peaks.append(cp3new)
corr3new[cp3new-2295:cp3new+2295] = 0
cp3new = numpy.nanargmax(corr3new)
peaks.append(cp3new)
corr3new[cp3new-2295:cp3new+2295] = 0
cp3new = numpy.nanargmax(corr3new)
peaks.append(cp3new)
corr3new[cp3new-2295:cp3new+2295] = 0
peaks = numpy.sort(peaks)

Testdiff2_3 = correlations["cp2"][0] - peaks[0] 
mov2_3 = Testdiff2_3 - mismatches["devices2_3"]
shift_amount = mov2_3 % len(audio["audio2"])

# Perform circular shift
new_array = numpy.concatenate((audiobackup["audio2"][shift_amount:], audiobackup["audio2"][:shift_amount]))
# Update the memmap array with the shifted data
#audio["audio3"][:] = new_array
#new_length = len(audio["audio2"]) + abs(shift_amount)
# Create a new array with padding on the left
#new_array = numpy.pad(audio["audio2"], (shift_amount, 0), mode='constant')


Testdiff4_3 = correlations["cp4"][0] - peaks[0] 
mov4_3 = Testdiff4_3 - mismatches["devices4_3"]
shift_amount = mov4_3 % len(audio["audio4"])

# Perform circular shift
new_array1 = numpy.concatenate((audiobackup["audio4"][shift_amount:], audiobackup["audio4"][:shift_amount]))


## Plots for illustration ##

fig, axs = plt.subplots(4, 1)
axs[0].plot(audiobackup["audio1"])
axs[1].plot(audiobackup["audio2"])
axs[2].plot(audiobackup["audio3"])
axs[3].plot(audiobackup["audio4"])

axs[1].plot(audio["audio2"],linestyle='dashed')
axs[1].plot(new_array,linestyle='dashed')
axs[2].plot(audio["audio3"],linestyle='dashed')
axs[3].plot(audio["audio4"],linestyle='dashed')
axs[3].plot(new_array1,linestyle='dashed')

#axs[0].plot(correlationsb["corr1"])
#axs[1].plot(correlationsb["corr2"])
#axs[2].plot(correlationsb["corr3"])
#axs[3].plot(correlationsb["corr4"])
axs[0].stem(correlations["cp1"],numpy.ones(4),'r')
axs[0].text(correlations["cp1"][0], 0.9, correlations["cp1"][0], fontsize=12, color='red')
axs[0].text(correlations["cp1"][1], 0.9, correlations["cp1"][1], fontsize=12, color='red')
#axs[0].stem(correlations["cp1"]+765,numpy.ones(4),'b')
axs[1].stem(correlations["cp2"],numpy.ones(4),'r')
axs[1].text(correlations["cp2"][0], 0.9, correlations["cp2"][0], fontsize=12, color='red')
axs[1].stem(correlations["cp2"][0]-mov1_2,-0.9,'r')
axs[1].text(correlations["cp2"][0]-mov1_2, -0.9, correlations["cp2"][0]-mov1_2, fontsize=12, color='red')
axs[1].text(correlations["cp2"][1], 0.9, correlations["cp2"][1], fontsize=12, color='red')
axs[1].stem(correlations["cp2"][1]-mov1_2, -0.9,'r')
axs[1].text(correlations["cp2"][1]-mov1_2, -0.9, correlations["cp2"][1]-mov1_2, fontsize=12, color='red')
axs[2].stem(correlations["cp3"],numpy.ones(4),'r')
#axs[2].stem(correlations["cp3"]+765,numpy.ones(4),'b')
axs[3].stem(correlations["cp4"],numpy.ones(4),'r')
#axs[3].stem(correlations["cp4"]+765,numpy.ones(4),'b')


axs[0].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[1].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[2].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[3].set_xlim(0, max([len(audio["audio1"]),len(audio["audio2"]),len(audio["audio3"]),len(audio["audio4"])]))
axs[0].set_ylabel('Device 1 Captured Audio')
#axs[0].set_xlabel('Local Discrete Time [Samples]')
axs[1].set_ylabel('Device 2 Captured Audio')
#axs[1].set_xlabel('Local Discrete Time [Samples]')
axs[2].set_ylabel('Device 3 Captured Audio')
#axs[2].set_xlabel('Local Discrete Time [Samples]')
axs[3].set_ylabel('Device 4 Captured Audio')
axs[3].set_xlabel('Local Discrete Time [Samples]')

#plt.tight_layout()
#plt.legend()

plt.show()
'''
