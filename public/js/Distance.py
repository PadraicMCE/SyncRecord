import numpy as numpy
import matplotlib.pyplot as plt
import csv
import sys
from numpy.fft import fft, ifft
#print('python script started')

audio1 = numpy.memmap(sys.argv[1], dtype='float32', mode='r')
audio2 = numpy.memmap(sys.argv[2], dtype='float32', mode='r')
#
#audio3 = numpy.memmap(sys.argv[3], dtype='float32', mode='r')
#print('read audio')
#audio1 = numpy.memmap('audio_1.pcm', dtype='float32', mode='r')
#audio2 = numpy.memmap('audio_2.pcm', dtype='float32', mode='r')

prbs1 = open('./public/js/prbs1.csv', newline='')
#prbs1 = open('prbs1.csv', newline='')
csvdata1 = csv.reader(prbs1)
data1 = []
for row in csvdata1:
    data1.append(float(row[0]))
data1 = numpy.array(data1)

prbs2 = open('./public/js/prbs2.csv', newline='')
#prbs2 = open('prbs2.csv', newline='')
csvdata2 = csv.reader(prbs2)
data2 = []
for row in csvdata2:
    data2.append(float(row[0]))
data2 = numpy.array(data2)

prbs3 = open('./public/js/prbs3.csv', newline='')
#prbs3 = open('prbs3.csv', newline='')
csvdata3 = csv.reader(prbs3)
data3 = []
for row in csvdata3:
    data3.append(float(row[0]))
data3 = numpy.array(data3)

corr11 = numpy.correlate(a=audio1, v=data1)
corr12 = numpy.correlate(a=audio1, v=data2)
corr11 = corr11/numpy.max(corr11)
corr12 = corr12/numpy.max(corr12)
corr21 = numpy.correlate(a=audio2, v=data1)
corr22 = numpy.correlate(a=audio2, v=data2)
corr21 = corr21/numpy.max(corr21)
corr22 = corr22/numpy.max(corr22)
###
'''
corr13 = numpy.correlate(a=audio1,v=data3)
corr13 = corr13/numpy.max(corr13)
corr31 = numpy.correlate(a=audio3,v=data1)
corr31 = corr31/numpy.max(corr31)
corr33 = numpy.correlate(a=audio3,v=data3)
corr33 = corr33/numpy.max(corr33)
corr23 = numpy.correlate(a=audio2,v=data3)
corr23 = corr23/numpy.max(corr23)
corr32 = numpy.correlate(a=audio3,v=data2)
corr32 = corr32/numpy.max(corr32)
'''

''' Very slow
# pre-allocate correlation array
corr = (len(audio1) - len(data) + 1)*[0]

# Go through lag components one-by-one
for l in range(len(corr)):
    corr[l] = sum([audio1[i+l]*data[i] for i in range(len(data))])

print(corr)
'''
bz = 256
# #### Device 1 #### #
# Correlation peaks audio 1 prbs 1
cp11_1 = numpy.nanargmax(corr11)
#print('CP11')
#print(cp11_1)
corr11[cp11_1-bz:cp11_1-1] = 0 #383
corr11[cp11_1+1:cp11_1+bz] = 0
corr11Temp = corr11.copy()
corr11Temp[cp11_1-bz:cp11_1+bz] = 0
cp11_2 = numpy.nanargmax(corr11Temp)
#print(cp11_2)
corr11[cp11_2-bz:cp11_2-1] = 0
corr11[cp11_2+1:cp11_2+bz] = 0
corr11Temp[cp11_2-bz:cp11_2+bz] = 0
cp11_3 = numpy.nanargmax(corr11Temp)
#print(cp11_3)
corr11[cp11_3-bz:cp11_3-1] = 0
corr11[cp11_3+1:cp11_3+bz] = 0

# Remove prbs1 correlation peaks
cp1 = (cp11_1, cp11_2, cp11_3)
cp1 = numpy.sort(cp1)
#print(cp1[2]-cp1[1])
#print(cp1[1]-cp1[0])
#print(cp1)
corr12[cp1[0]-765:cp1[2]+765] = 0

# Correlation peaks audio 1 prbs 2
cp12_1 = numpy.nanargmax(corr12)
#print('CP12')
#print(cp12_1)
corr12[cp12_1-bz:cp12_1-1] = 0
corr12[cp12_1+1:cp12_1+bz] = 0
corr12Temp = corr12.copy()
corr12Temp[cp12_1-bz:cp12_1+bz] = 0
cp12_2 = numpy.nanargmax(corr12Temp)
#print(cp12_2)
corr12[cp12_2-bz:cp12_2-1] = 0
corr12[cp12_2+1:cp12_2+bz] = 0
corr12Temp[cp12_2-bz:cp12_2+bz] = 0
cp12_3 = numpy.nanargmax(corr12Temp)
#print(cp12_3)
corr12[cp12_3-bz:cp12_3-1] = 0
corr12[cp12_3+1:cp12_3+bz] = 0
# Remove prbs1 correlation peaks
cp12 = (cp12_1, cp12_2, cp12_3)
cp12 = numpy.sort(cp12)
#print(cp12[2]-cp12[1])
#print(cp12[1]-cp12[0])
#print(cp12)

# #### Device 2 #### #
# Correlation peaks audio 2 prbs 2
cp22_1 = numpy.nanargmax(corr22)
#print('CP22')
#print(cp22_1)
corr22[cp22_1-bz:cp22_1-1] = 0
corr22[cp22_1+1:cp22_1+bz] = 0
corr22Temp = corr22.copy()
corr22Temp[cp22_1-bz:cp22_1+bz] = 0
cp22_2 = numpy.nanargmax(corr22Temp)
#print(cp22_2)
corr22[cp22_2-bz:cp22_2-1] = 0
corr22[cp22_2+1:cp22_2+bz] = 0
corr22Temp[cp22_2-bz:cp22_2+bz] = 0
cp22_3 = numpy.nanargmax(corr22Temp)
#print(cp22_3)
corr22[cp22_3-bz:cp22_3-1] = 0
corr22[cp22_3+1:cp22_3+bz] = 0

# Remove prbs2 correlation peaks
cp2 = (cp22_1, cp22_2, cp22_3)
cp2 = numpy.sort(cp2)
#print(cp2[2]-cp2[1])
#print(cp2[1]-cp2[0])
#print(cp2)
corr21[cp2[0]-765:cp2[2]+765] = 0
corr21[cp2[0]-765:len(corr21)] = 0

# Correlation peaks audio 2 prbs 1
cp21_1 = numpy.nanargmax(corr21)
#print('CP21')
#print(cp21_1)
corr21[cp21_1-bz:cp21_1-1] = 0
corr21[cp21_1+1:cp21_1+bz] = 0
corr21Temp = corr21.copy()
corr21Temp[cp21_1-bz:cp21_1+bz] = 0
cp21_2 = numpy.nanargmax(corr21Temp)
#print(cp21_2)
corr21[cp21_2-bz:cp21_2-1] = 0
corr21[cp21_2+1:cp21_2+bz] = 0
corr21Temp[cp21_2-bz:cp21_2+bz] = 0
cp21_3 = numpy.nanargmax(corr21Temp)
#print(cp21_3)
corr21[cp21_3-bz:cp21_3-1] = 0
corr21[cp21_3+1:cp21_3+bz] = 0
# Remove prbs1 correlation peaks
cp21 = (cp21_1, cp21_2, cp21_3)
cp21 = numpy.sort(cp21)
#print(cp21[2]-cp21[1])
#print(cp21[1]-cp21[0])
#print(cp21)

# ###### Device 3 added ###### #
'''
# #### Device 3 #### #
# Correlation peaks audio 3 prbs 3
cp33_1 = numpy.nanargmax(corr33)
#print('CP33')
#print(cp33_1)
corr33[cp33_1-bz:cp33_1-1] = 0
corr33[cp33_1+1:cp33_1+bz] = 0
corr33Temp = corr33.copy()
corr33Temp[cp33_1-bz:cp33_1+bz] = 0
cp33_2 = numpy.nanargmax(corr33Temp)
#print(cp33_2)
corr33[cp33_2-bz:cp33_2-1] = 0
corr33[cp33_2+1:cp33_2+bz] = 0
corr33Temp[cp33_2-bz:cp33_2+bz] = 0
cp33_3 = numpy.nanargmax(corr33Temp)
#print(cp33_3)
corr33[cp33_3-bz:cp33_3-1] = 0
corr33[cp33_3+1:cp33_3+bz] = 0

# Remove prbs3 correlation peaks
cp3 = (cp33_1, cp33_2, cp33_3)
cp3 = numpy.sort(cp3)
#print(cp3[2]-cp3[1])
#print(cp3[1]-cp3[0])
#print(cp3)
corr31[cp3[0]-765:cp3[2]+765] = 0
corr31[cp3[0]-765:len(corr31)] = 0

# Correlation peaks audio 3 prbs 1
cp31_1 = numpy.nanargmax(corr31)
#print('CP31')
#print(cp31_1)
corr31[cp31_1-bz:cp31_1-1] = 0
corr31[cp31_1+1:cp31_1+bz] = 0
corr31Temp = corr31.copy()
corr31Temp[cp31_1-bz:cp31_1+bz] = 0
cp31_2 = numpy.nanargmax(corr31Temp)
#print(cp31_2)
corr31[cp31_2-bz:cp31_2-1] = 0
corr31[cp31_2+1:cp31_2+bz] = 0
corr31Temp[cp31_2-bz:cp31_2+bz] = 0
cp31_3 = numpy.nanargmax(corr31Temp)
#print(cp31_3)
corr31[cp31_3-bz:cp31_3-1] = 0
corr31[cp31_3+1:cp31_3+bz] = 0
# Remove prbs3 correlation peaks
cp31 = (cp31_1, cp31_2, cp31_3)
cp31 = numpy.sort(cp31)
#print(cp31[2]-cp31[1])
#print(cp31[1]-cp31[0])
#print(cp31)

corr13[cp1[0]-765:cp1[2]+765] = 0
corr13[cp12[0]-765:cp12[2]+765] = 0
# Correlation peaks audio 1 prbs 2
cp13_1 = numpy.nanargmax(corr13)
#print('CP13')
#print(cp13_1)
corr13[cp13_1-bz:cp13_1-1] = 0
corr13[cp13_1+1:cp13_1+bz] = 0
corr13Temp = corr13.copy()
corr13Temp[cp13_1-bz:cp13_1+bz] = 0
cp13_2 = numpy.nanargmax(corr13Temp)
#print(cp13_2)
corr13[cp13_2-bz:cp13_2-1] = 0
corr13[cp13_2+1:cp13_2+bz] = 0
corr13Temp[cp13_2-bz:cp13_2+bz] = 0
cp13_3 = numpy.nanargmax(corr13Temp)
#print(cp13_3)
corr13[cp13_3-bz:cp13_3-1] = 0
corr13[cp13_3+1:cp13_3+bz] = 0
# Remove prbs1 correlation peaks
cp13 = (cp13_1, cp13_2, cp13_3)
cp13 = numpy.sort(cp13)
#print(cp12[2]-cp12[1])
#print(cp12[1]-cp12[0])
#print(cp12)

corr23[cp3[0]-765:cp3[2]+765] = 0
# Correlation peaks audio 2 prbs 3
cp23_1 = numpy.nanargmax(corr23)
#print('CP23')
#print(cp23_1)
corr23[cp23_1-bz:cp23_1-1] = 0
corr23[cp23_1+1:cp23_1+bz] = 0
corr23Temp = corr23.copy()
corr23Temp[cp23_1-bz:cp23_1+bz] = 0
cp23_2 = numpy.nanargmax(corr23Temp)
#print(cp23_2)
corr23[cp23_2-bz:cp23_2-1] = 0
corr23[cp23_2+1:cp23_2+bz] = 0
corr23Temp[cp23_2-bz:cp23_2+bz] = 0
cp23_3 = numpy.nanargmax(corr23Temp)
#print(cp23_3)
corr23[cp23_3-bz:cp23_3-1] = 0
corr23[cp23_3+1:cp23_3+bz] = 0
# Remove prbs1 correlation peaks
cp23 = (cp23_1, cp23_2, cp23_3)
cp23 = numpy.sort(cp23)
#print(cp2[2]-cp23[1])
#print(cp3[1]-cp32[0])
#print(cp23)

corr32[cp3[0]-765:cp3[2]+765] = 0
# Correlation peaks audio 3 prbs 2
cp32_1 = numpy.nanargmax(corr32)
#print('CP32')
#print(cp32_1)
corr32[cp32_1-bz:cp32_1-1] = 0
corr32[cp32_1+1:cp32_1+bz] = 0
corr32Temp = corr32.copy()
corr32Temp[cp32_1-bz:cp32_1+bz] = 0
cp32_2 = numpy.nanargmax(corr32Temp)
#print(cp32_2)
corr32[cp32_2-bz:cp32_2-1] = 0
corr32[cp32_2+1:cp32_2+bz] = 0
corr32Temp[cp32_2-bz:cp32_2+bz] = 0
cp32_3 = numpy.nanargmax(corr32Temp)
#print(cp32_3)
corr32[cp32_3-bz:cp32_3-1] = 0
corr32[cp32_3+1:cp32_3+bz] = 0
# Remove prbs3 correlation peaks
cp32 = (cp32_1, cp32_2, cp32_3)
cp32 = numpy.sort(cp32)
#print(cp32[2]-cp32[1])
#print(cp32[1]-cp32[0])
#print(cp32)

'''

# ##### ####### #

diff1 = cp12[1] - cp1[1]
diff2 = cp2[1] - cp21[1]
diff = numpy.abs(diff1 - diff2)
#print(diff) #TO DO: Add into js server file to accept the diff value.

'''
## ### ### ## 
diff1_3 = numpy.abs(cp13[1] - cp1[1])
diff3 = numpy.abs(cp3[1] - cp31[1])
diff13 = numpy.abs(diff1_3 - diff3)

diff2_3 = numpy.abs(cp23[1] - cp3[1])
diff3_2 = numpy.abs(cp3[1] - cp32[1])
diff23 = numpy.abs(diff2_3 - diff3_2)
'''

dist12 = ((diff*(1/48000))/2)*343
print(dist12)

'''
dist23 = ((diff*(1/48000))/2)*343
#dist23 = ((diff23*(1/48000))/2)*343
print(dist23)
dist13 = ((diff*(1/48000))/2)*343
#dist13 = ((diff13*(1/48000))/2)*343
print(dist12)
'''

'''
# Position of device 3
a = ((dist13*dist13) - (dist23*dist23) + (dist12*dist12))/(2*dist12)
print(a)
h = numpy.sqrt((dist13*dist13) - (a*a))
print(h)
'''

'''
plt.plot(audio1)
plt.plot(corr1, color='r')
plt.plot(cp1_1,numpy.max(corr1),'x',color='k')
plt.plot(cp1_2,numpy.max(corr1),'x',color='k')
plt.plot(cp1_3,numpy.max(corr1),'x',color='k')
'''
#plt.plot(corr2, color='g')

#figure, axis = plt.subplots(3,1)

'''
axis[0].plot(audio1)
axis[0].plot(corr1, color='r')
axis[0].plot(corr2, color='g')
axis[0].set_title('Audio')

axis[1].plot(corr1)
axis[1].set_title('Cross correlation 1')

axis[2].plot(corr2)
axis[2].set_title('Cross correlation 2')
'''
#plt.show()
