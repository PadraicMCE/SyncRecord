import numpy as numpy
import matplotlib.pyplot as plt
import csv
import sys
from numpy.fft import fft, ifft
from itertools import combinations
import numpy as np
from scipy.signal import argrelextrema
from scipy import interpolate
from scipy.ndimage import median_filter                   
import pandas as pd
import json
import os
# --------------- Functions --------------------------
'''
def findLocalMaxima(arr):
    """
    Finds local maxima in a 1D array.
    Equivalent to Matlab's islocalmax or a simple peak finding algorithm.
    """
    # argrelextrema returns indices of local maxima
    # order=1 ensures it finds peaks where the immediate neighbors are smaller
    return argrelextrema(arr, np.greater, order=1)[0]
'''

def findLocalMaxima(data):
    """
    Finds local maxima in a 1D data array where a point is a local maximum
    if it's strictly greater than both of its two preceding samples
    AND both of its two succeeding samples.

    Args:
        data (numpy.ndarray or list): The 1D data vector.

    Returns:
        list: A list of 0-indexed positions (indices) of the local maxima.
              Returns an empty list if there are fewer than 5 data points
              or no local maxima are found.
    """
    data = np.asarray(data) # Ensure it's a NumPy array

    # We need at least 5 points for data[i-2] and data[i+2] to be valid
    # (i.e., i=2 must have i-2=0, i=len(data)-3 must have i+2=len(data)-1)
    if len(data) < 5:
        return []

    local_maxima_indices = []

    # Loop from the 3rd element (index 2) to the 3rd-to-last element (index len(data)-3).
    # This ensures data[i-2], data[i-1], data[i+1], and data[i+2] are always valid indices.
    for i in range(2, len(data) - 2): # Python range stops BEFORE the end value
        # Check if the current point is strictly greater than all four neighbors
        if (data[i] > data[i - 1] and
            data[i] > data[i - 2] and
            data[i] > data[i + 1] and
            data[i] > data[i + 2]):
            local_maxima_indices.append(i) # Append the 0-indexed position

    return local_maxima_indices

def find_first_major_peak_dynamic_threshold(fine_time, spline_fit):
    """
    Finds the first major peak in a signal (spline_fit) using a dynamic threshold.
    A major peak is defined as a local maximum that exceeds a threshold,
    calculated as a rolling median of the signal plus 3 times its standard deviation.

    Args:
        fine_time (np.ndarray): 1D array of x-coordinates (e.g., time values)
                                corresponding to spline_fit.
        spline_fit (np.ndarray): 1D array of y-values (the interpolated signal).

    Returns:
        tuple:
            - first_major_peak (list): A list [x_coordinate, y_value] of the
              first major peak found. Returns an empty list `[]` if no major
              peak is found or if there's insufficient data.
            - threshold_values (np.ndarray): The calculated dynamic threshold
              array, or an empty NumPy array `np.array([])` if there's
              insufficient data for threshold calculation or local maxima.
    """
    fine_time = np.asarray(fine_time)
    spline_fit = np.asarray(spline_fit)

    # Initialize return values for early exit
    first_major_peak = []
    threshold_values = np.array([]) # Default to empty NumPy array if no threshold

    # 1. Find all local maxima
    # Using order=1 to match the basic definition of local maxima (greater than immediate neighbors).
    # If your findLocalMaxima MATLAB function used a different "order" (e.g., checking 2 neighbors),
    # change `order` here accordingly (e.g., `order=2`).
    peak_indices = findLocalMaxima(spline_fit)

    # Check if any local maxima were found or if signal is too short for threshold calculation
    if len(peak_indices) == 0 or len(spline_fit) < 3: # Need at least 3 for argrelmax(order=1) and movmedian
        return first_major_peak, threshold_values

    # Get the values of the spline_fit at the identified peak_indices
    peak_values_at_maxima = spline_fit[peak_indices]

    # 2. Dynamic threshold calculation (rolling median)
    # Calculate window size, ensuring it's an integer and at least 1.
    # If the window size is even, add 1 to make it odd for median_filter symmetry.
    window_size_raw = len(spline_fit) / 10
    window_size = int(np.round(window_size_raw))
    if window_size == 0: # Handle cases where length is very small leading to 0
        window_size = 1
    if window_size % 2 == 0: # Ensure window_size is odd for median_filter
        window_size += 1
    
    # Check if window_size is greater than length of signal - this could happen if signal is very short
    if window_size > len(spline_fit):
        window_size = len(spline_fit) # Use full signal length as window, will result in single median

    # Calculate baseline using moving median
    # `mode='nearest'` handles boundary conditions by extending the nearest value.
    baseline = median_filter(spline_fit, size=window_size, mode='nearest')

    # Calculate threshold: baseline + 3 * standard deviation of the whole spline_fit
    # `ddof=1` matches MATLAB's default sample standard deviation (divides by N-1).
    global_std = np.std(spline_fit, ddof=1)
    threshold = baseline + 3 * global_std

    # Store the calculated threshold values
    threshold_values = threshold

    # 3. Find the first peak exceeding the dynamic threshold
    # Create a boolean array where True means the peak value at that index
    # (within `peak_values_at_maxima`) is greater than its corresponding threshold value.
    major_peak_condition = (peak_values_at_maxima > threshold[peak_indices])

    # `np.where(condition)[0]` gives the 0-indexed positions within the `peak_indices` array
    # where the condition is True.
    major_peak_indices_in_peak_indices_array = np.where(major_peak_condition)[0]

    # Check if any major peaks were found
    if len(major_peak_indices_in_peak_indices_array) == 0:
        return first_major_peak, threshold_values # Return empty list

    # Get the index of the first major peak (this index refers to the `peak_indices` array)
    first_major_peak_relative_idx = major_peak_indices_in_peak_indices_array[0]

    # Get the actual 0-indexed position of this major peak in the original `spline_fit` and `fine_time` arrays
    first_major_peak_original_index = peak_indices[first_major_peak_relative_idx]

    # Extract the fineTime and splineFit values for this peak
    first_major_peak = [
        fine_time[first_major_peak_original_index],
        spline_fit[first_major_peak_original_index]
    ]

    return first_major_peak, threshold_values

# -------------- Main Script -------------
devices = {}
for i in range(1,len(sys.argv)-2):
    var_name = f"Device{i}"
    devices[var_name] = {}

array_token = sys.argv[1]
file_path = sys.argv[2]

sm_distance = 32 # Distance between device speaker and microphone [mm]
sm_lag = sm_distance / ((1/48)*343)
'''
# Not required
# Read the .txt file associated with group of recordings
file_path = sys.argv[1]
# Open file and read it
with open(file_path, 'r') as file:
    content = file.read()
# Delimit data
delimiters = [' ','\n','\r']
for delimiter in delimiters:
    content = ' '.join(content.split(delimiter))
segments = content.split()
'''

## Read Audio from arguments
audio = {}
recordings = {}
for i in range(1,len(sys.argv)-2):
    audio[f"audio{i}"] = numpy.memmap(sys.argv[i+2],dtype='int16', mode='r+')
    recordings[f"audio{i}"] = numpy.memmap(sys.argv[i+2],dtype='int16', mode='r+')

## Read PRBS template
prbs1 = open('./prbs1_template_delta.csv',newline='')
csvdata1 = csv.reader(prbs1)
data1 = []
for row in csvdata1:
    data1.append(float(row[0]))
data1 = numpy.array(data1)

## Normalise amplitudes
data1 = data1 + data1 + data1
data1 = data1/(numpy.max(numpy.abs(data1)))
for i in range(1,len(audio)+1):
    audio[f"audio{i}"] = audio[f"audio{i}"] / (numpy.max(numpy.abs(audio[f"audio{1}"])))

# Length of PRBS die down
bz = 755

# Cross-correlation each audio and template PRBS
correlations ={}
correlation_peaks = {}
correlations_copy = {}
for i in range(1,len(audio)+1):
    correlations[f"corr{i}"] = numpy.correlate(a=audio[f"audio{i}"], v=data1)
    correlations[f"corr{i}"] = correlations[f"corr{i}"]/numpy.max(numpy.abs(correlations[f"corr{i}"]))
    correlations_copy[f"corr{i}"] = numpy.copy(correlations[f"corr{i}"])
#print(f"Correlations: {len(correlations)}")
# Detect peaks of each PRBS in each cross-correlation
for i in range(1,len(correlations)+1):
    correlation_peaks[f"corr{i}"] = []
    correlation_peaks[f"corr{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
    correlations[f"corr{i}"][correlation_peaks[f"corr{i}"][0]-bz:correlation_peaks[f"corr{i}"][0]+bz] = 0
    for j in range(1,len(devices)*3):
        correlation_peaks[f"corr{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
        correlations[f"corr{i}"][correlation_peaks[f"corr{i}"][j]-bz:correlation_peaks[f"corr{i}"][j]+bz] = 0

# Create file to save distance / sync information
file_path_sync = f"{file_path}_sync"


# Sort correlation peaks
for i in range(1, len(devices)+1):
    correlation_peaks[f"corr{i}"] = numpy.sort(correlation_peaks[f"corr{i}"])
    #with open(file_path_sync, 'a') as file:
        #file.write(f"Recording {i} correlation peaks: {correlation_peaks[f'cp{i}']} \n")

#Round robin pairs
devices_list = list(range(1,len(devices)+1))
recordings = list(range(1,len(devices)+1))
device_pairs = list(combinations(devices_list,2))
recording_pairs = list(combinations(recordings,2))

# Correlation window size. For interpolation.
window = 255
windows = {}
interpolated_windows = {}
local_peaks = {}
major_peaks = {}
lags = {}
distances = {}

# Get sample differences across all pairs of devices
for (r1, r2) in recording_pairs:
    # Device 1 PRBS 1
    window = numpy.copy(correlations_copy[f"corr{r1}"])
    window = window[correlation_peaks[f"corr{r1}"][(r1*3)-2]-255:correlation_peaks[f"corr{r1}"][(r1*3)-2]+255]
    window = window / numpy.max(numpy.abs(window))
    windows[f"corr{r1}_{r1}"] =  numpy.copy(window)
    ## Interpolated Spline
    min_val = np.min(windows[f"corr{r1}_{r1}"])
    max_val = np.max(windows[f"corr{r1}_{r1}"])
    # Get the number of elements in samples
    original_length = len(windows[f"corr{r1}_{r1}"])
    x_coordinates = np.arange(len(window))
    # Calculate the desired number of points for the new array
    num_points = (original_length -1) * 10 + 1
    # Create the new array using np.linspace
    fineSamples = np.linspace(0, len(window)-1, num_points)
    # Interpolate the window
    f_cubic = interpolate.interp1d(x_coordinates, window, kind='cubic')
    interpolated_windows[f"corr{r1}_{r1}"] = f_cubic(fineSamples)
    peaks = findLocalMaxima(interpolated_windows[f"corr{r1}_{r1}"])
    local_peaks[f"corr{r1}_{r1}"] = peaks
    major_peak = find_first_major_peak_dynamic_threshold(fineSamples,interpolated_windows[f"corr{r1}_{r1}"])
    major_peaks[f"corr{r1}_{r1}"] = major_peak[0][0]

    # For testing
    #fig, axes = plt.subplots(nrows=2, ncols=2, figsize=(12, 10))
    #axes[0, 0].plot(interpolated_windows[f"corr{r1}_{r1}"])
    #axes[0, 0].stem(peaks,interpolated_windows[f"corr{r1}_{r1}"][peaks],linefmt='r--',markerfmt='ro')
    #axes[0, 0].stem((major_peak[0][0]-1)*10+1,major_peak[0][1],linefmt='g--',markerfmt='go')
    #axes[0, 0].plot(major_peak[1])

    # Device 1 PRBS 2
    window = numpy.copy(correlations_copy[f"corr{r1}"])
    window = window[correlation_peaks[f"corr{r1}"][(r2*3)-1]-255:correlation_peaks[f"corr{r1}"][(r2*3)-1]+255]
    window = window / numpy.max(numpy.abs(window))
    windows[f"corr{r1}_{r2}"] =  numpy.copy(window)
    ## Interpolated Spline
    min_val = np.min(windows[f"corr{r1}_{r2}"])
    max_val = np.max(windows[f"corr{r1}_{r2}"])
    # Get the number of elements in samples
    original_length = len(windows[f"corr{r1}_{r2}"])
    x_coordinates = np.arange(len(window))
    # Calculate the desired number of points for the new array
    num_points = original_length * 10
    # Create the new array using np.linspace
    fineSamples = np.linspace(0, len(window)-1, num_points)
    # Interpolate the window
    f_cubic = interpolate.interp1d(x_coordinates, window, kind='cubic')
    interpolated_windows[f"corr{r1}_{r2}"] = f_cubic(fineSamples)
    peaks = findLocalMaxima(interpolated_windows[f"corr{r1}_{r2}"])
    local_peaks[f"corr{r1}_{r2}"] = peaks
    major_peak = find_first_major_peak_dynamic_threshold(fineSamples,interpolated_windows[f"corr{r1}_{r2}"])
    major_peaks[f"corr{r1}_{r2}"] = major_peak[0][0]

    # For testing
    #axes[0, 1].plot(interpolated_windows[f"corr{r1}_{r2}"])
    #axes[0, 1].stem(peaks,interpolated_windows[f"corr{r1}_{r2}"][peaks],linefmt='r--',markerfmt='ro')
    #axes[0, 1].stem((major_peak[0][0]-1)*10+1,major_peak[0][1],linefmt='g--',markerfmt='go')
    #axes[0, 1].plot(major_peak[1])

    # Device 2 PRBS 2
    window = numpy.copy(correlations_copy[f"corr{r2}"])
    window = window[correlation_peaks[f"corr{r2}"][(r2*3)-1]-255:correlation_peaks[f"corr{r2}"][(r2*3)-1]+255]
    window = window / numpy.max(numpy.abs(window))
    windows[f"corr{r2}_{r2}"] =  numpy.copy(window)
    ## Interpolated Spline
    min_val = np.min(windows[f"corr{r2}_{r2}"])
    max_val = np.max(windows[f"corr{r2}_{r2}"])
    # Get the number of elements in samples
    original_length = len(windows[f"corr{r2}_{r2}"])
    x_coordinates = np.arange(len(window))
    # Calculate the desired number of points for the new array
    num_points = (original_length -1) * 10 + 1
    # Create the new array using np.linspace
    fineSamples = np.linspace(0, len(window)-1, num_points)
    # Interpolate the window
    f_cubic = interpolate.interp1d(x_coordinates, window, kind='cubic')
    interpolated_windows[f"corr{r2}_{r2}"] = f_cubic(fineSamples)
    peaks = findLocalMaxima(interpolated_windows[f"corr{r2}_{r2}"])
    local_peaks[f"corr{r2}_{r2}"] = peaks
    major_peak = find_first_major_peak_dynamic_threshold(fineSamples,interpolated_windows[f"corr{r2}_{r2}"])
    major_peaks[f"corr{r2}_{r2}"] = major_peak[0][0]

    ## For testing
    #axes[1, 1].plot(interpolated_windows[f"corr{r2}_{r2}"])
    #axes[1, 1].stem(peaks,interpolated_windows[f"corr{r2}_{r2}"][peaks],linefmt='r--',markerfmt='ro')
    #axes[1, 1].stem((major_peak[0][0]-1)*10+1,major_peak[0][1],linefmt='g--',markerfmt='go')
    #axes[1, 1].plot(major_peak[1])

    #Device 2 PRBS 1
    window = numpy.copy(correlations_copy[f"corr{r2}"])
    window = window[correlation_peaks[f"corr{r2}"][(r1*3)-1]-255:correlation_peaks[f"corr{r2}"][(r1*3)-1]+255]
    window = window / numpy.max(numpy.abs(window))
    windows[f"corr{r2}_{r1}"] =  numpy.copy(window)
    ## Interpolated Spline
    min_val = np.min(windows[f"corr{r2}_{r1}"])
    max_val = np.max(windows[f"corr{r2}_{r1}"])
    # Get the number of elements in samples
    original_length = len(windows[f"corr{r2}_{r1}"])
    x_coordinates = np.arange(len(window))
    # Calculate the desired number of points for the new array
    num_points = original_length * 10
    # Create the new array using np.linspace
    fineSamples = np.linspace(0, len(window)-1, num_points)
    # Interpolate the window
    f_cubic = interpolate.interp1d(x_coordinates, window, kind='cubic')
    interpolated_windows[f"corr{r2}_{r1}"] = f_cubic(fineSamples)
    peaks = findLocalMaxima(interpolated_windows[f"corr{r2}_{r1}"])
    local_peaks[f"corr{r2}_{r1}"] = peaks
    major_peak = find_first_major_peak_dynamic_threshold(fineSamples,interpolated_windows[f"corr{r2}_{r1}"])
    major_peaks[f"corr{r2}_{r1}"] = major_peak[0][0]

    # For testing
    #axes[1, 0].plot(interpolated_windows[f"corr{r2}_{r1}"])
    #axes[1, 0].stem(peaks,interpolated_windows[f"corr{r2}_{r1}"][peaks],linefmt='r--',markerfmt='ro')
    #axes[1, 0].stem((major_peak[0][0]-1)*10+1,major_peak[0][1],linefmt='g--',markerfmt='go')
    #axes[1, 0].plot(major_peak[1])

    delta1 = numpy.abs((major_peaks[f"corr{r1}_{r1}"]+correlation_peaks[f"corr{r1}"][(r1*3)-2]-255-sm_lag)-(major_peaks[f"corr{r1}_{r2}"]+correlation_peaks[f"corr{r1}"][(r2*3)-2]-255))
    delta2 = numpy.abs((major_peaks[f"corr{r2}_{r1}"]+correlation_peaks[f"corr{r2}"][(r1*3)-2]-255)-(major_peaks[f"corr{r2}_{r2}"]+correlation_peaks[f"corr{r2}"][(r2*3)-2]-255-sm_lag))
    lags[f"lag_{r1}_{r2}"] = numpy.abs(delta1 - delta2)
    distances[f"distance_{r1}_{r2}"] = (lags[f"lag_{r1}_{r2}"]/2)*(1/48)*343

    # For testing
    #print(f"Distance {r1} {r2} = {distances[f'distance_{r1}_{r2}']}")
    #plt.show()

## Save information to file
# Writing to txt type file
'''
try:
    with open(array_token,'w') as f:
        for key, value in distances.items():
            f.write(f"{key}: {value}\n")
except IOError as e:
    print(f"Error writing sync information to file: {e}")
'''
# Writing to file in JSON format
'''
try:
    with open(array_token, 'w') as f:
        json.dump(distances,f,indent=4)
except IOError as e:
    print(f"Error writing sync information to file: {e}")
'''

for key, value in distances.items():
    print(f"{key}: {value}")
print(f"-"*30)

#print("End of script")
### ----- Testing plots ------

