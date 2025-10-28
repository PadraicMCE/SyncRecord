import numpy as numpy
import matplotlib.pyplot as plt
import csv
import sys
from numpy.fft import fft, ifft
from itertools import combinations, groupby
import numpy as np
from scipy.signal import argrelextrema
from scipy import interpolate
from scipy.ndimage import median_filter                   
import pandas as pd
import matplotlib.pyplot as plt
import os
# --------------- Functions --------------------------

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

def find_major_peaks(signal, num_peaks, min_distance, plot=False, threshold_multiplier=5):
    """
    Finds a specified number of major peaks in a signal using a dynamic threshold
    and enforcing a minimum distance between peaks.

    Args:
        signal (numpy.ndarray): The 1D signal to analyze
        num_peaks (int): The number of major peaks to find.
        min_distance (int): The minimum number of samples between peaks.
        plot (bool): If True, displays a plot of the signal and detected peaks.
        threshold_multiplier (int): Multiplier for the rolling standard deviation.

    Returns:
        list: A sorted list of indices of the found major peaks.
    """
    if len(signal) < 5:
        return []
    
    # 1. Calculate dynamic threshold
    # Use a window size that is a fraction of the signal length, e.g., 1/10th
    window_size = max(1, int(np.round(len(signal) / 10)))
    if window_size % 2 == 0:
        window_size += 1
    
    baseline = median_filter(signal, size=window_size, mode='nearest')

    # Calculate a rolling standard deviation for a more adaptive threshold
    signal_series = pd.Series(signal)
    local_std = signal_series.rolling(window=window_size, center=True, min_periods=1).std().to_numpy()

    # The new threshold is the baseline plus a multiple of the local standard deviation
    threshold = baseline + (threshold_multiplier * local_std)


    # 2. Find all local maxima
    all_peak_indices = findLocalMaxima(signal)
    if not all_peak_indices:
        return []

    # 3. Filter peaks that are above the dynamic threshold
    major_peak_indices = [p for p in all_peak_indices if signal[p] > threshold[p]]

    if not major_peak_indices:
        return []

    # 4. Sort peaks by their amplitude in descending order
    sorted_peaks = sorted(major_peak_indices, key=lambda p: signal[p], reverse=True)

    # 5. Select the top peaks, ensuring minimum distance
    final_peaks = []
    for peak_idx in sorted_peaks:
        if all(abs(peak_idx - fp) >= min_distance for fp in final_peaks):
            final_peaks.append(peak_idx)
    final_peaks = sorted(final_peaks)

    # Return the sorted indices of the top 'num_peaks'
    if plot:
        plt.figure(figsize=(12, 6))
        plt.plot(signal, label='Correlation Signal')
        plt.plot(threshold, label='Dynamic Threshold', color='red')
        plt.scatter(sorted(final_peaks), signal[sorted(final_peaks)], color='green', label='Detected Peaks', zorder=5)
        plt.xlabel('Sample Index')
        plt.ylabel('Amplitude')
        plt.legend()
        plt.title('Correlation Signal with Dynamic Threshold and Peaks')
        plt.show()

    bad_peaks = []
    for peak_idx in range(0,len(final_peaks)-1):
        #print(f"Current index {peak_idx}: {final_peaks[peak_idx]}")
        if(peak_idx == 0):
            if(abs(final_peaks[peak_idx]-final_peaks[peak_idx+1])>770):
                print(f"Distance between peaks {peak_idx}and{peak_idx+1}: {abs(final_peaks[peak_idx]-final_peaks[peak_idx+1])}")
                bad_peaks.append(peak_idx)
        if(peak_idx > 0):
            if(abs(final_peaks[peak_idx]-final_peaks[peak_idx+1])>770 and abs(final_peaks[peak_idx]-final_peaks[peak_idx-1])>770):
                bad_peaks.append(peak_idx)
        if(peak_idx == len(final_peaks)-1):
            if(abs(final_peaks[peak_idx]-final_peaks[peak_idx-1])>770):
                bad_peaks.append(peak_idx)
    
    # Create a new list that excludes the bad peak indices
    if bad_peaks:
        bad_peaks_set = set(bad_peaks)
        final_peaks = [peak for i, peak in enumerate(final_peaks) if i not in bad_peaks_set]

    # Print the final peak indices for debugging
    #print(f"Final detected peak indices: {sorted(final_peaks)}")
    return sorted(final_peaks)[:num_peaks]

# -------------- Main Script -------------
devices = {}
for i in range(1,len(sys.argv)-2):
    var_name = f"Device{i}"
    devices[var_name] = {}

array_token = sys.argv[1]
file_path = sys.argv[2]

sm_distance = 32 # Distance between device speaker and microphone [mm]
sm_lag = sm_distance / ((1/48)*343)

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

# Detect peaks of each PRBS in each cross-correlation
for i in range(1,len(correlations)+1):
    num_expected_peaks = len(devices) * 3
    correlation_peaks[f"corr{i}"] = find_major_peaks(correlations[f"corr{i}"], num_expected_peaks, bz, plot=False, threshold_multiplier=5)

# Create file to save distance / sync information
file_path_sync = f"{file_path}_sync"

# Sort correlation peaks
for i in range(1, len(devices)+1):
    correlation_peaks[f"corr{i}"] = numpy.sort(correlation_peaks[f"corr{i}"])

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
