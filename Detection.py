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
import json

# --------------- Variables --------------------------
# Correlation window size. For interpolation.
window_size = 255
windows = {}
interpolated_windows = {}
local_peaks = {}
major_peaks = {}
lags = {}
distances = {}
valid_peak_positions = {}
# Finding time mismatch
global_peaks = {}
localpeaks = {}
shifts = {}

# --------------- Functions --------------------------

def findLocalMaxima(data):
    """
    Finds local maxima in a 1D data array where a point is a local maximum
    if it's strictly greater than both of its two preceding samples
    AND both of its two succeeding samples.
    Args:
        data (numpy.ndarray or list): The 1D data vector.
    """
    data = np.asarray(data) #NumPy array
    # At least 5 points for data[i-2] and data[i+2] to be valid
    if len(data) < 5:
        return []
    local_maxima_indices = []
    for i in range(2, len(data) - 2):
        if (data[i] > data[i - 1] and
            data[i] > data[i - 2] and
            data[i] > data[i + 1] and
            data[i] > data[i + 2]):
            local_maxima_indices.append(i)
    return local_maxima_indices

def find_first_major_peak_dynamic_threshold(fine_time, spline_fit):
    """
    Finds the first major peak in a signal (spline_fit) using a dynamic threshold.
    A major peak is a local maximum that exceeds a threshold,
    calculated as a rolling median of the signal plus 2 times its standard deviation.
    Args:
        fine_time (np.ndarray): 1D array of x-coordinates.
        spline_fit (np.ndarray): 1D array of y-values.
    """
    fine_time = np.asarray(fine_time)
    spline_fit = np.asarray(spline_fit)
    # Initialise return values for early exit
    first_major_peak = []
    threshold_values = np.array([]) # Default to empty NumPy array if no threshold
    # Find all local maxima
    peak_indices = findLocalMaxima(spline_fit)
    # Check if any local maxima were found or if signal is too short for threshold calculation
    if len(peak_indices) == 0 or len(spline_fit) < 3: 
        return first_major_peak, threshold_values
    # Get the values of the spline_fit at the identified peak_indices
    peak_values_at_maxima = spline_fit[peak_indices]
    # Dynamic threshold calculation
    # Calculate window size, ensuring it's an integer and at least 1.
    # If the window size is even, add 1 to make it odd for median_filter symmetry.
    window_size_raw = len(spline_fit) / 10
    window_size = int(np.round(window_size_raw))
    if window_size == 0:
        window_size = 1
    if window_size % 2 == 0:
        window_size += 1
    # Check if window_size is greater than length of signal
    if window_size > len(spline_fit):
        window_size = len(spline_fit) # Use full signal length as window
    # Calculate baseline using moving median
    baseline = median_filter(abs(spline_fit), size=window_size, mode='nearest')
    # Calculate threshold: baseline + 2 * standard deviation of the whole spline_fit
    global_std = np.std(spline_fit, ddof=1)
    threshold = baseline + 2 * global_std
    # Store the calculated threshold values
    threshold_values = threshold
    # Find the first peak exceeding the dynamic threshold
    # Create a boolean array where True means the peak value at that index
    major_peak_condition = (peak_values_at_maxima > threshold[peak_indices])
    # where the condition is True.
    major_peak_indices_in_peak_indices_array = np.where(major_peak_condition)[0]
    # Check if any major peaks were found
    if len(major_peak_indices_in_peak_indices_array) == 0:
        return first_major_peak, threshold_values # Return empty list
    # Get the index of the first major peak
    first_major_peak_relative_idx = major_peak_indices_in_peak_indices_array[0]
    # Get the actual position of this major peak in the original `spline_fit` and `fine_time` arrays
    first_major_peak_original_index = peak_indices[first_major_peak_relative_idx]
    # Extract the fineTime and splineFit values for this peak
    first_major_peak = [
        fine_time[first_major_peak_original_index],
        spline_fit[first_major_peak_original_index]
    ]
    return first_major_peak, threshold_values

def find_all_groups(corr_data, spacing=765, tolerance=10):
    """
    Finds all sets of three peaks spaced by 'spacing' samples.
    """
    # Find all local maxima
    all_peaks = findLocalMaxima(corr_data)
    # Dynamic threshold
    baseline = median_filter(corr_data, size=int((len(corr_data)/10)+1), mode='nearest')
    global_std = np.std(corr_data, ddof=1)
    threshold = baseline + 3.5 * global_std
    # Filter by a threshold
    discovered_peak_condition = (corr_data > threshold)
    major_peaks = np.where(discovered_peak_condition)[0]
    groups = []
    # Pattern match for the 3-peak sequence (p1, p2, p3)
    for p1 in major_peaks:
        # Target for second peak
        p2_target = p1 + spacing
        p2_matches = [p for p in major_peaks if abs(p - p2_target) <= tolerance]
        if p2_matches:
            for p2 in p2_matches:
                # Target for third peak
                p3_target = p2 + spacing
                p3_matches = [p for p in major_peaks if abs(p - p3_target) <= tolerance]
                if p3_matches:
                    for p3 in p3_matches:
                        # Triplet found and added to list.
                        groups.append((p1, p2, p3))
    return groups

def validate_and_correct_peak_groups(peak_indices, amplitudes, expected_spacing=765, tolerance=10, max_group_size=3):
    """
    Identifies chains of peaks and selects the subgroup of 3 with the highest 
    combined amplitude.
    """
    # Map each peak index to its corresponding amplitude
    amp_lookup = {idx: amp for idx, amp in zip(peak_indices, amplitudes)}
    # Sort the unique indices to ensure they get processed in order
    sorted_peaks = sorted(list(set(peak_indices)))
    valid_grps = []
    used_indices = set()
    i = 0
    while i < len(sorted_peaks):
        if sorted_peaks[i] in used_indices:
            i += 1
            continue   
        # Start a new potential group
        current_group = [sorted_peaks[i]]
        # Build the chain based on spacing
        for j in range(i + 1, len(sorted_peaks)):
            last_peak = current_group[-1]
            next_peak = sorted_peaks[j]
            if abs(next_peak - last_peak - expected_spacing) <= tolerance:
                current_group.append(next_peak)
            elif next_peak - last_peak > expected_spacing + tolerance:
                break
        # If the chain is long enough, find the best subgroup of 3
        if len(current_group) >= max_group_size:
            best_subgroup = []
            max_sum = -1.0 # Assuming amplitudes are positive
            # Slide the window (size 3) across the found chain
            for start in range(len(current_group) - max_group_size + 1):
                subgroup = current_group[start : start + max_group_size]
                # Sum the amplitudes using the lookup dictionary
                current_sum = sum(amp_lookup[p] for p in subgroup) 
                if current_sum > max_sum:
                    max_sum = current_sum
                    best_subgroup = subgroup
            valid_grps.append(tuple(best_subgroup))
            # Mark the entire chain as used to avoid overlapping groups
            used_indices.update(current_group)
        i += 1
    # Identify problematic peaks
    flattened_valid = [p for grp in valid_grps for p in grp]
    problematic_peaks = [p for p in sorted_peaks if p not in flattened_valid]
    return valid_grps, problematic_peaks

def revalidate_problematic_peaks(problematic_peaks, corr_data, valid_groups, window_size=500, spacing=765, tolerance=10):
    """
    Revalidates problematic peaks by checking windows around them for valid groups.
    """
    # Flatten valid groups to avoid duplicates
    valid_peak_positions_temp = [peak for group in valid_groups for peak in group]
    new_peaks = []
    for peak in problematic_peaks:
        # Extract window around the problematic peak
        start = (peak - int(window_size / 2))
        end = (peak + int(window_size / 2))
        window = corr_data[start:end]
        window = window / np.max(np.abs(window))
        # Interpolate the window
        x_coordinates = np.arange(len(window))
        num_points = (len(window) - 1) * 10 + 1
        fineSamples = np.linspace(0, len(window) - 1, num_points)
        f_cubic = interpolate.interp1d(x_coordinates, window, kind='cubic')
        interpolated_window = f_cubic(fineSamples)
        # Find the first major peak in the interpolated window
        first_major_peak = find_first_major_peak_dynamic_threshold(fineSamples, interpolated_window)
        if not first_major_peak:
            continue  # Skip if no major peak is found
        if(first_major_peak[0]):
            major_peak_pos = int(start + first_major_peak[0][0])  # Convert back to window index
        new_peaks.append(major_peak_pos)
    new_amplitudes = corr_data[new_peaks]
    valid_peaks, problem_peaks = validate_and_correct_peak_groups(
        new_peaks, new_amplitudes, expected_spacing=765, tolerance=peak_tolerance, max_group_size=3
    )
    return valid_peaks

def find_additional_groups_near_valid_groups(corr_data, valid_groups, window_size=500, spacing=765, tolerance=1):
    """
    Searches for additional groups of peaks near valid groups.

    Args:
        corr_data (np.ndarray): The correlation data.
        valid_groups (list): List of valid peak groups (each group is a tuple of 3 peak indices).
        window_size (int): Size of the region to search around each valid group.
        spacing (int): Expected spacing between peaks in a group.
        tolerance (int): Allowed deviation from the expected spacing.

    Returns:
        list: List of additional groups found near valid groups.
    """
    valid_peak_groups = np.concatenate(valid_groups)
    #print(f"Valid groups in check: {valid_peak_groups}")
    additional_groups = []
    for i in valid_peak_groups:
        corr_data[i-64:i+64] = 0

    for group in valid_groups:
        # Find the start and end of the window around the group
        start = max(0, group[0] - window_size)
        end = min(len(corr_data), group[-1] + window_size)

        # Extract the correlation data in the window
        window_data = corr_data[start:end]

        # Find all groups in the window
        all_groups_in_window = find_all_groups(window_data, spacing=spacing, tolerance=tolerance)
        #print(f"found groups: {all_groups_in_window}")
        # Convert group indices back to original correlation indices
        for group_in_window in all_groups_in_window:
            adjusted_group = tuple(idx + start for idx in group_in_window)
            # Only add if not already in valid_groups
            if adjusted_group not in valid_groups:
                additional_groups.append(adjusted_group)

    return additional_groups

# -------------- Main Script -------------
devices = {}
for i in range(1,len(sys.argv)-2):
    var_name = f"Device{i}"
    devices[var_name] = {}

array_token = sys.argv[1]
file_path = sys.argv[2]

sm_distance = 32 # Distance between device speaker and microphone [mm]
sm_lag = sm_distance / ((1/48)*343)

# Tolerance for sample gap between peaks in a group (should be 765)
peak_tolerance = 2

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
data1 = data1/(numpy.max(numpy.abs(data1)))
for i in range(1,len(audio)+1):
    audio[f"audio{i}"] = audio[f"audio{i}"] / (numpy.max(numpy.abs(audio[f"audio{1}"])))

# Length of PRBS die down
bz = 755

# Cross-correlation each audio and template PRBS
correlations ={}
correlation_peaks = {}
correlations_copy = {}
valid_groups = {}
problematic_peaks = {}

for i in range(1,len(audio)+1):
    correlations[f"corr{i}"] = numpy.correlate(a=audio[f"audio{i}"], v=data1)
    correlations[f"corr{i}"] = correlations[f"corr{i}"]/numpy.max(numpy.abs(correlations[f"corr{i}"]))
    correlations_copy[f"corr{i}"] = numpy.copy(correlations[f"corr{i}"])

# Find initial peaks in correlations. Top amplitude peaks 3* number of devices.
for i in range(1,len(correlations)+1):
    correlation_peaks[f"corr{i}"] = []
    correlation_peaks[f"corr{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
    correlations[f"corr{i}"][correlation_peaks[f"corr{i}"][0]-bz:correlation_peaks[f"corr{i}"][0]+bz] = 0
    for j in range(1,len(devices)*3):
        correlation_peaks[f"corr{i}"].append(numpy.nanargmax(correlations[f"corr{i}"]))
        correlations[f"corr{i}"][correlation_peaks[f"corr{i}"][j]-bz:correlation_peaks[f"corr{i}"][j]+bz] = 0
    correlation_peaks[f"corr{i}"] = np.sort(correlation_peaks[f"corr{i}"])

# Validate and correct peaks for each device dynamically
for i in range(1, len(correlations) + 1):
    # Check valid groups in the peaks
    valid_groups[f"corr{i}"], problematic_peaks[f"corr{i}"] = validate_and_correct_peak_groups(
        correlation_peaks[f"corr{i}"], correlations_copy[f"corr{i}"][correlation_peaks[f"corr{i}"]], expected_spacing=765, tolerance=peak_tolerance, max_group_size=3
    )
    valid_peak_positions_temp = [peak for group in valid_groups[f"corr{i}"] for peak in group]
    if len(valid_groups[f"corr{i}"]) < len(devices):
        # Preprocess: Remove problematic peaks that are already in valid groups
        valid_peak_positions_temp = [peak for group in valid_groups[f"corr{i}"] for peak in group]
        problematic_peaks[f"corr{i}"] = [peak for peak in problematic_peaks[f"corr{i}"] if peak not in valid_peak_positions_temp]
        # Copy of correlation stream to zero out valid groups.
        corr = np.copy(correlations_copy[f"corr{i}"])
        for peak in valid_peak_positions_temp:
            corr[peak-bz:peak+bz] = 0
        # Cycle through peaks again
        corr_peaks = []
        corr_peaks.append(numpy.nanargmax(corr))
        corr[corr_peaks[0]-bz:corr_peaks[0]+bz] = 0
        for j in range(1,len(devices)*3):
            corr_peaks.append(numpy.nanargmax(corr))
            corr[corr_peaks[j]-bz:corr_peaks[j]+bz] = 0
        valid_groups_temp, problematic_peaks_temp = validate_and_correct_peak_groups(
            corr_peaks, correlations_copy[f"corr{i}"][corr_peaks], expected_spacing=765, tolerance=3, max_group_size=3
        )
        if(valid_groups_temp):
            valid_groups[f"corr{i}"].extend(valid_groups_temp)
        if(len(valid_groups[f"corr{i}"]) < len(devices)):
            valid_peak_positions_temp = [peak for group in valid_groups[f"corr{i}"] for peak in group]
            problematic_peaks[f"corr{i}"] = [peak for peak in problematic_peaks[f"corr{i}"] if peak not in valid_peak_positions_temp]
            completed_groups = revalidate_problematic_peaks(
                problematic_peaks_temp, numpy.copy(correlations_copy[f"corr{i}"]), valid_groups[f"corr{i}"],
                window_size=window_size, spacing=765, tolerance=peak_tolerance
            )
            if(completed_groups):
                valid_groups[f"corr{i}"].extend(completed_groups)
        valid_peak_positions_temp = [peak for group in valid_groups[f"corr{i}"] for peak in group]
        correlation_peaks[f"corr{i}"] = [x for x in correlation_peaks[f"corr{i}"] if x in valid_peak_positions_temp]
    elif (len(valid_groups[f"corr{i}"]) < len(devices)):
        print(f"Too many valid groups in correlation {i}")
    # Sort by the first peak in each group    
    valid_groups[f"corr{i}"] = sorted(valid_groups[f"corr{i}"], key=lambda x: x[0])
    potential_reflections = find_additional_groups_near_valid_groups(correlations_copy[f"corr{i}"].copy(), valid_groups[f"corr{i}"], window_size=1000, spacing=765, tolerance=2)
    if(potential_reflections):
        most_likely_reflection = min(potential_reflections, key=lambda x: x[0])
        closest_group = min(valid_groups[f"corr{i}"], key=lambda x: abs(x[1] - most_likely_reflection[1]))
        potential_reflections = None
        if(most_likely_reflection[1] < closest_group[1]):
            # Reconstruct the list: if it's the match, swap it; otherwise, keep it.
            valid_groups[f"corr{i}"] = [most_likely_reflection if x == closest_group else x for x in valid_groups[f"corr{i}"]]
    # Flatten valid groups into a list of peak positions
    valid_peak_positions_temp = [peak for group in valid_groups[f"corr{i}"] for peak in group]
    problematic_peak_positions = problematic_peaks[f"corr{i}"]

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

# Get sample differences across all pairs of devices
for (r1, r2) in recording_pairs:
    
    valid_peak_positions[f"corr{r1}"] = [peak for group in valid_groups[f"corr{r1}"] for peak in group]
    valid_peak_positions[f"corr{r2}"] = [peak for group in valid_groups[f"corr{r2}"] for peak in group]

    # Device 1 PRBS 1
    window = numpy.copy(correlations_copy[f"corr{r1}"])
    window = window[valid_peak_positions[f"corr{r1}"][(r1*3)-2]-int(window_size/2):valid_peak_positions[f"corr{r1}"][(r1*3)-2]+int(window_size/2)]
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

    # Device 1 PRBS 2
    window = numpy.copy(correlations_copy[f"corr{r1}"])
    window = window[valid_peak_positions[f"corr{r1}"][(r2*3)-2]-int(window_size/2):valid_peak_positions[f"corr{r1}"][(r2*3)-2]+int(window_size/2)]
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

    # Device 2 PRBS 2
    window = numpy.copy(correlations_copy[f"corr{r2}"])
    window = window[valid_peak_positions[f"corr{r2}"][(r2*3)-2]-int(window_size/2):valid_peak_positions[f"corr{r2}"][(r2*3)-2]+int(window_size/2)]
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

    #Device 2 PRBS 1
    window = numpy.copy(correlations_copy[f"corr{r2}"])
    window = window[valid_peak_positions[f"corr{r2}"][(r1*3)-2]-int(window_size/2):valid_peak_positions[f"corr{r2}"][(r1*3)-2]+int(window_size/2)]
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

    delta1 = numpy.abs((major_peaks[f"corr{r1}_{r1}"]+valid_peak_positions[f"corr{r1}"][(r1*3)-2]-int(window_size/2)-sm_lag)-(major_peaks[f"corr{r1}_{r2}"]+valid_peak_positions[f"corr{r1}"][(r2*3)-2]-int(window_size/2)))
    delta2 = numpy.abs((major_peaks[f"corr{r2}_{r1}"]+valid_peak_positions[f"corr{r2}"][(r1*3)-2]-int(window_size/2))-(major_peaks[f"corr{r2}_{r2}"]+valid_peak_positions[f"corr{r2}"][(r2*3)-2]-int(window_size/2)-sm_lag))
    lags[f"lag_{r1}_{r2}"] = numpy.abs(delta1 - delta2)
    distances[f"distance_{r1}_{r2}"] = (lags[f"lag_{r1}_{r2}"]/2)*(1/48)*343
    localpeaks[f"peak_{r1}_{r1}"]=(major_peaks[f"corr{r1}_{r1}"]+valid_peak_positions[f"corr{r1}"][(r1*3)-2]-int(window_size/2)-sm_lag)
    localpeaks[f"peak_{r1}_{r2}"]=(major_peaks[f"corr{r1}_{r2}"]+valid_peak_positions[f"corr{r1}"][(r2*3)-2]-int(window_size/2))
    localpeaks[f"peak_{r2}_{r1}"]=(major_peaks[f"corr{r2}_{r1}"]+valid_peak_positions[f"corr{r2}"][(r1*3)-2]-int(window_size/2))
    localpeaks[f"peak_{r2}_{r2}"]=(major_peaks[f"corr{r2}_{r2}"]+valid_peak_positions[f"corr{r2}"][(r2*3)-2]-int(window_size/2)-sm_lag)
    
    global_peaks[f"g_peak_{r1}_{r1}"]=localpeaks[f"peak_{r1}_{r1}"]
    global_peaks[f"g_peak_{r2}_{r1}"]=localpeaks[f"peak_{r1}_{r1}"]+(lags[f"lag_{r1}_{r2}"]/2)
    global_peaks[f"g_peak_{r1}_{r2}"]=localpeaks[f"peak_{r2}_{r2}"]+(lags[f"lag_{r1}_{r2}"]/2)
    global_peaks[f"g_peak_{r2}_{r2}"]=localpeaks[f"peak_{r2}_{r2}"]

    shifts[f"shift_{r1}_{r2}"]=global_peaks[f"g_peak_{r1}_{r2}"]-localpeaks[f"peak_{r1}_{r2}"]
    shifts[f"shift_{r2}_{r1}"]=global_peaks[f"g_peak_{r2}_{r1}"]-localpeaks[f"peak_{r2}_{r1}"]


## Save information to file
# Writing to txt type file
'''
try:
    with open(array_token,'w') as f:
        for key, value in distances.items():
            f.write(f"{key}: {value}\n")
except IOError as e:
    print(f"Error writing sync information to file: {e}")

# Writing to file in JSON format
'''

try:
    combined_data = {}
    combined_data.update(distances)
    combined_data.update(lags)
    combined_data.update(global_peaks)
    combined_data.update(localpeaks)
    combined_data.update(shifts)
    
    with open(file_path_sync, 'w') as f:
        json.dump(combined_data, f, indent=4)
except IOError as e:
    print(f"Error writing sync information to file: {e}")

'''
for key, value in distances.items():
    print(f"{key}: {value}")
print(f"-"*30)
'''
#print("End of script")
### ----- Testing plots ------
