/* ************************************
    Written by: Padraic McEvoy
    Last updated 21/12/2023
************************************ */
// Socketio
const socket = io();

// **************************************
// ************ Variables *************** //
// **************************************
const width = screen.availWidth;
const height = screen.availHeight;
//Flag for debug printing
var debugprint = true;
//Room token to allow communication with other devices in the session
var roomToken;
// Determine if master device
var master;
var deviceInArray;
// Tracking number of connected client devices.
var numDevices = 0;
var connectedDeviceIds = [];
var recordingDevices = [];
var readyDevices = [];
var finishedDevices = [];
var stoppedDevices = [];
// Time/Date for recording labels
var timedate;
// Current number of samples in recording
var totSamples = 0;
// AudioWorklet variables
var context;
var audioSource;
var recording = false;
// Variable for global audio stream access
var globalStream;
var recordPermission = false;
var source;
var recorderNode;
// Variables for audio channel synchronisation
var readyToSync = false;
var downloadLinksContainer;
var BufferAudio = Float32Array;
// **************************************
// ************ Interface *************** //
// **************************************
var screenWidth = window.innerWidth;
// Div for control buttons
var createRoomDiv = document.createElement("div");
var createRoomButton = document.createElement("BUTTON");
createRoomButton.innerHTML = "Create Array";
createRoomButton.setAttribute("class","createRoomButton");
createRoomDiv.appendChild(createRoomButton);
createRoomButton.style.width = 0.25*screenWidth+'px';
createRoomButton.style.height = 0.25*screenWidth+'px';
createRoomButton.style.fontSize = 0.05*screenWidth+'px';
createRoomButton.style.margin = 0.01*screenWidth+'px';
createRoomButton.style.display = 'inline-block';
createRoomButton.style.backgroundColor = 'rgb(0, 76, 108)';
createRoomButton.style.color = 'rgb(255,255,255)';
//
createRoomDiv.style.display = 'flex';
createRoomDiv.style.alignItems = 'center';
createRoomDiv.style.justifyContent = 'center';
var joinRoomButton = document.createElement("BUTTON");
joinRoomButton.setAttribute("class","joinRoomButton");
joinRoomButton.innerHTML = "Join Array";
joinRoomButton.style.width = 0.25*screenWidth+'px';
joinRoomButton.style.height = 0.25*screenWidth+'px';
joinRoomButton.style.fontSize = 0.05*screenWidth+'px';
joinRoomButton.style.margin = 0.01*screenWidth+'px';
joinRoomButton.style.display = 'inline-block';
joinRoomButton.style.backgroundColor = 'rgb(0, 76, 108)';
joinRoomButton.style.color = 'rgb(255,255,255)';

// Add all div to main webpage
document.body.appendChild(createRoomDiv);
createRoomDiv.appendChild(joinRoomButton);
createRoomDiv.style.textAlign ='center';

//Get microphone access
navigator.mediaDevices.getUserMedia({ audio: true })
.then(function(stream) {
    //Access to microphone granted
})
.catch(function(error) {
    // Permission denied or error occurred
    console.error('Error accessing microphone:', error);
});

// **************************************
// ************** Controls ************** //
// **************************************

// Controls only for master device
var controlsDiv;
var RunCalibButton = document.createElement("BUTTON");
var StartRecordButton = document.createElement("BUTTON");
var StopRecordButton = document.createElement("BUTTON");
var EndPRBSButton = document.createElement("BUTTON");

// Create room clicked (device assigned as master of that array)
// A random token is created.
// Device joins that session as master.
createRoomButton.onclick = function()
{
    var token = rand();
    if(debugprint) console.log(token);
    createRoomButton.innerHTML = "Array Token:<br>"+token;
    roomToken = token;
    master = true;
    socket.emit('joinRoom',roomToken);
    // Create recording controls buttons for master device
    createAudioControls();
    createRoomButton.disabled = true;
    createRoomButton.style.backgroundColor = 'rgb(50, 50, 50)';
    createRoomButton.style.color = 'rgb(255,255,255)';
    joinRoomButton.disabled = true;
    joinRoomButton.style.backgroundColor = 'rgb(50, 50, 50)';
    joinRoomButton.style.color = 'rgb(50,50,50)';
}
// Join array button pressed, user asked for array token.
// Device joins as client to the session entered.
joinRoomButton.onclick = function()
{
    // Prompt the user for input and store it in a variable
    master = false;
    const sessionToken = prompt('Enter Array Token:');
    createRoomButton.innerHTML = "Array Token:<br>"+sessionToken;
    roomToken = sessionToken;
    socket.emit('joinRoom',roomToken);
    joinRoomButton.disabled = true;
    joinRoomButton.style.backgroundColor = 'rgb(50, 50, 50)';
    joinRoomButton.style.color = 'rgb(50,50,50)';
    createRoomButton.disabled = true;
    createRoomButton.style.backgroundColor = 'rgb(50, 50, 50)';
    createRoomButton.style.color = 'rgb(255,255,255)';
}

// **************************************
// *********** Communications *********** //
// **************************************

// If a device joins the session (array), the master logs it's id.
// The master device assigns it a number. Ascending in order of joining.
socket.on('joinedRoom', function(message)
{
    if(master==true)
    {
        //Poll connected devices to check a device is not reconnecting?
        //numDevices = numDevices + 1;
        if(debugprint) console.log(message.id);
        connectedDeviceIds.push(message.id);
        numDevices = connectedDeviceIds.length;
        console.log(connectedDeviceIds);
        if(debugprint) console.log(numDevices);
        socket.emit('assignDevice', {
            device: numDevices,
            id: message.id,
            room: roomToken
        });
        socket.emit('deviceIds', {
            ids: connectedDeviceIds,
            room: roomToken
        });
    }
});
socket.on('DevNumAssigned', message =>
{
    if(debugprint) console.log(message);
    joinRoomButton.innerHTML = "Device:<br>"+message;
    joinRoomButton.style.color = 'rgb(255,255,255)';
    // Identify the device recording in batch (and room token)
    deviceInArray = message;
    //console.log('Device in array: '+deviceInArray);
    var joinTone = new Audio('../notification_sound.wav');
    joinTone.loop = false;
    joinTone.volume = 1.0;
    joinTone.play();
});
socket.on('Number of Devices', function(message)
{
    if(!master)
    {
        numDevices = message.device;
    }
});
socket.on('deviceIds', ids =>
{
    if(!master)
    {
        connectedDeviceIds = ids;
        console.log(connectedDeviceIds);
    }
});
socket.on('Record', function(message)
{
    if(message.command == 'Start')
    {
        // Get timedate from master device
        timedate = message.timedate;
        // Get medai stream permission
        navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
            // Permission granted, stream is available
            // Function for passing stream to global variable
            recordPermission = true;
            context = new AudioContext({latencyHint: "interactive", sampleRate: 48000});
            source = context.createMediaStreamSource(stream);
            context.audioWorklet.addModule('./js/Record.js').then(() =>
            {
                if(recordPermission)
                {
                    // Start recording on local device
                    recorderNode = new window.AudioWorkletNode(context, 'recorder-worklet');
                    source.connect(recorderNode);
                    recorderNode.port.postMessage({
                        eventType: 'Start'
                    });
                    var pcmBuffer = new Float32Array();
                    //Temporary audio data sent from worklet node.
                    var audioData;
                    recorderNode.port.onmessage = (e) =>
                    {
                        if(recordPermission)
                        {
                            if(e.data.eventType === 'data')
                            {
                                audioData = e.data.audioBuffer;
                                pcmBuffer = Float32Concat(pcmBuffer,audioData);
                            }
                        }   
                        if(e.data.eventType === 'started')
                        {
                            // Visually show that device has started recording
                            document.body.style.backgroundColor = '0x00FF00';
                        }
                        if(e.data.eventType === 'stopped')
                        {
                            recordPermission = false;
                            // Visually show that device has started recording
                            document.body.style.backgroundColor = '0x000000';
                            shareAudio(pcmBuffer, e.data.timedate);
                        }
                    }
                }
            });
        })
        .catch(function(error) {
            // Permission denied or error occurred
            console.error('Error accessing microphone:', error);
        });     
    }
    if(message.command == 'Stop')
    {
        console.log(message.command);
        try {
            //Stop recording on local device
            recorderNode.port.postMessage({
                eventType: 'Stop',
                timedate: message.timedate
            });
        } catch(error){
            console.log("Error sending stop command to AudioWorklet");
        }
    }
});

socket.on('audioData', function(message)
{
    // UI for each audio received
    const soundClips = document.createElement('section');
    const clipContainer = document.createElement('article');
    const clipLabel = document.createElement('p');
    const audio = document.createElement('audio');
    const deleteButton = document.createElement('button');
    const downloadButton = document.createElement('button');
    
    var filename = message.timedate+"_"+message.device+".pcm";
    clipContainer.classList.add('clip');
    audio.setAttribute('controls', '');
    deleteButton.innerHTML = "Delete";
    downloadButton.innerHTML = "Download";
    clipLabel.innerHTML = filename;
    clipLabel.style.color = 'white';
    
    clipContainer.appendChild(audio);
    clipContainer.appendChild(clipLabel);
    clipContainer.appendChild(deleteButton);
    clipContainer.appendChild(downloadButton);
    soundClips.appendChild(clipContainer);
    document.body.appendChild(soundClips);
    
    audio.controls = true;

    console.log('Filename: '+filename);
    var blob = new Blob([message.audioData],{type: 'audio/wav'});

    const audioURL = window.URL.createObjectURL(blob);
    audio.src = audioURL;
    var element = document.createElement('a');
    element.setAttribute('href',audioURL);
    element.setAttribute('download',filename);
    
    deleteButton.onclick = function(e)
    {
        let evtTgt = e.target;
        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
    }
    
    downloadButton.onclick = function(e)
    {
        download(filename,audioURL);
    }
    
    clipLabel.onclick = function() 
    {
        const existingName = clipLabel.textContent;
        const newClipName = prompt('Enter a new name for sound clip?');
        if (newClipName === null)
        {
            clipLabel.textContent = existingName;
        }else{
            clipLabel.textContent = newClipName;
        }
    }
});

socket.on('distanceRecord', function(message)
{
    console.log('Received "distanceRecord" with command: '+message.command+' from: '+message.devinarray);
    timedate = message.timedate;
    if(message.command == 'Start')
    {
        //Reset all recording and ready flags
        recordingDevices = Array(connectedDeviceIds.length).fill(0);
        readyDevices = Array(connectedDeviceIds.length).fill(0);
        finishedDevices = Array(connectedDeviceIds.length).fill(0);
        console.log(recordingDevices);
        navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
            // Permission granted, stream is available
            // Function for passing stream to global variable
            recordPermission = true;
            context = new AudioContext({latencyHint: "interactive", sampleRate: 48000}); // Select sample rate?
            source = context.createMediaStreamSource(stream);
            context.audioWorklet.addModule('./js/Record.js').then(() =>
            {
                if(recordPermission)
                {
                    // Start recording on local device
                    recorderNode = new window.AudioWorkletNode(context, 'recorder-worklet');
                    source.connect(recorderNode);
                    recorderNode.port.postMessage({
                        eventType: 'Start'
                    });
                    var pcmBuffer = [];
                    //var pcmBuffer = new Float32Array();
                    //Temporary audio data sent from worklet node.
                    var audioData;
                    recorderNode.port.onmessage = (e) =>
                    {
                        if(recordPermission)
                        {
                            if(e.data.eventType === 'data')
                            {
                                //console.log(e.data.audioData);
                                //audioData = e.data.audioBuffer;
                                socket.emit('audioData',{ 
                                    audioData: e.data.audioBuffer,
                                    timedate: timedate,
                                    room: roomToken,
                                    device: deviceInArray,
                                    samples: e.data.samples,
                                    totsamples: e.data.totalSamples},
                                    { binary: true });
                                //pcmBuffer.length = 0;
                                //totSamples = e.data.totalSamples;
                                //console.log("Total audio samples: "+e.data.totalSamples)
                                //console.log("Samples: "+e.data.samples)
                                // testing audio saved directly on device.
                                //const inputData = e.data.audioBuffer;
                                //const buffer = new Float32Array(inputData.length);
                                //Float32Concat(BufferAudio,buffer);
                                //console.log(BufferAudio.length);
                            }
                        }  
                        if(e.data.eventType === 'started')
                        {
                            var localtime = Date.now().toString();
                            console.log("Received started command from audio worklet");
                            // Visually show that device has started recording
                            joinRoomButton.style.backgroundColor = 'rgb(0, 255, 0)';
                            socket.emit('distanceRecord',{
                                numDevices: connectedDeviceIds.length,
                                timedate: message.timedate,
                                command: 'Started',
                                device: socket.id,
                                devinarray: deviceInArray,
                                localtime: totSamples,
                                room: roomToken,
                                master: message.master
                            });
                        }
                        if(e.data.eventType === 'stopped')
                        {
                            console.log("Received stopped command from audio worklet, with timedate: "+e.data.timedate);
                            recordPermission = false;
                            // Visually show that device has stopped recording
                            joinRoomButton.style.backgroundColor = 'rgb(50, 50, 50)';
                            // Distance measurement script
                            source.disconnect(recorderNode);
                            socket.emit('distanceRecord',{
                                numDevices: connectedDeviceIds.length,
                                timedate: message.timedate,
                                command: 'Stopped',
                                device: socket.id,
                                devinarray: deviceInArray,
                                localtime: totSamples,
                                room: roomToken,
                                master: message.master
                            });
                            // Testing saving audio locally on device
                            //saveAudioBuffer(BufferAudio);
                            //BufferAudio = new Float32Array(0);

                        }
                    }
                }
            });
        })
        .catch(function(error) {
            // Permission denied or error occurred
            console.error('Error accessing microphone:', error);
        });    
    }
    if(message.command == 'Stop')
    {
        console.log("Received stop command from server");
        console.log(message.command);
        try {
            //Stop recording on local device
            recorderNode.port.postMessage({
                eventType: 'Stop',
                timedate: message.timedate
            });
        } catch(error){
            console.log("Error sending stop command to AudioWorklet");
        }
    }
    if(message.command == 'Started')
    {
        //Check through devices in current section and note if recording
        recordingDevices[message.devinarray-1] = 1;
        var allRecording = recordingDevices.every(value => value === 1);
        console.log(allRecording);
        if(recordingDevices.length == connectedDeviceIds.length && allRecording)
        {
            console.log(recordingDevices);
            console.log('All devices are recording');
            socket.emit('distanceRecord',{
                timedate: message.timedate,
                command: 'PRBSPlay',
                device: connectedDeviceIds[0],
                room: message.room,
                master: message.master
            });
        }
    }
    if(message.command == 'Stopped')
    {
        //Check through devices in current section and note if stopped
        stoppedDevices[message.devinarray-1] = 1;
        var allStopped = stoppedDevices.every(value => value === 1);
        console.log(allStopped);
        if(stoppedDevices.length == connectedDeviceIds.length && allStopped)
        {
            console.log(stoppedDevices);
            console.log('All devices Stopped Recording');
            if(readyToSync == true)
            {
                socket.emit('distanceRecord',{
                    timedate: message.timedate,
                    command: 'SyncAudio',
                    devices: connectedDeviceIds.length,
                    room: message.room,
                    master: message.master
                });
            }
        }
    }
    if(message.command == 'PRBSPlay')
    {
        // #### What arrays for?
        readyDevices = Array(connectedDeviceIds.length).fill(0);
        finishedDevices = Array(connectedDeviceIds.length).fill(0);
        stoppedDevices = Array(connectedDeviceIds.length).fill(0);
        console.log('Recieved command to ready PRBS');
        socket.emit('distanceRecord',{
            timedate: message.timedate,
            command: 'PRBSReady',
            device: message.device,
            deviceNo: deviceInArray,
            room: message.room,
            master: message.master
        })
    }
    if(message.command == 'PRBSReady')
    {
        console.log('Recieved PRBSReady');
        socket.emit('distanceRecord',{
            timedate: message.timedate,
            command: 'Ready',
            device: message.device,
            devinarray: deviceInArray,
            deviceNo: message.deviceNo,
            localtime: totSamples,
            room: roomToken,
            master: message.master
        });
    }
    if(message.command == 'Ready')
    {
        console.log('Received command to play PRBS from device: '+message.devinarray);
        //Check through devices in current section and note if recording
        readyDevices[message.devinarray-1] = 1;
        console.log(readyDevices);
        var allReady = readyDevices.every(value => value === 1);
        console.log(allReady);
        if(readyDevices.length == connectedDeviceIds.length && allReady)
        {
            //
            console.log('Device playing PRBS');
            var distanceprbs1 = new Audio('../prbs1.wav');
            distanceprbs1.loop = false;
            distanceprbs1.volume = 1.0;
            distanceprbs1.play(); // Attach to onplay event. log.
            // Flush the event queue to check that an onended already exists.
            distanceprbs1.onended = function()
            {
                finishedDevices = Array(connectedDeviceIds.length).fill(0);
                console.log('PRBS finished');
                //Log time and continue recording.
                socket.emit('distanceRecord',{
                    timedate: message.timedate,
                    command: 'PRBSFinished',
                    device: message.device,
                    devinarray: deviceInArray,
                    deviceNo: message.deviceNo,
                    localtime: totSamples,
                    room: message.room,
                    master: message.master
                });
                //If finished PRBS for the last device.
                if(message.deviceNo == connectedDeviceIds.length)
                {

                    
                }
            };
        }
    }
    if(message.command == 'PRBSFinished')
    {
        console.log("Received PRBSFinished from "+message.devinarray);
        socket.emit('distanceRecord',{
            timedate: message.timedate,
            command: 'Finished',
            device: message.device,
            devinarray: deviceInArray,
            deviceNo: message.deviceNo,
            localtime: totSamples,
            room: message.room,
            master: message.master
        });
    }
    if(message.command == 'Finished')
    {
        console.log("Received finished from: "+message.devinarray);
        finishedDevices[message.devinarray-1] = 1;
        var allReady = finishedDevices.every(value => value === 1);
        
        if(message.deviceNo == connectedDeviceIds.length && allReady)
        {
            console.log("Will run python script to determine sync");
            setTimeout(function() {
                socket.emit('distanceRecord',{
                    timedate: message.timedate,
                    command: 'Sync',
                    devinarray: deviceInArray,
                    room: roomToken,
                    master: message.master
                });
              }, 1000); // Run the function after 1 second       
        } 
        if(finishedDevices.length == connectedDeviceIds.length && allReady)
        {
            socket.emit('distanceRecord',{
                timedate: message.timedate,
                command: 'PRBSPlay',
                device: connectedDeviceIds[message.deviceNo],
                room: message.room,
                master: message.master
            });
        }
    }
    if(message.command == 'EndPRBS')
    {
        console.log(deviceInArray);
        console.log(connectedDeviceIds.length);
        if(deviceInArray === connectedDeviceIds.length)
        {
            socket.emit('distanceRecord',{
                timedate: message.timedate,
                command: 'PRBSended',
                devinarray: deviceInArray,
                localtime: totSamples,
                room: message.room,
                master: message.master
            });
        }
    }
    if(message.command == 'LastPRBSCheck')
    {  
        DevicesPRBSEnded[message.devinarray-1] = 1;
        var allDone = DevicesPRBSEnded.every(value => value === 1);
        if(DevicesPRBSEnded.length == connectedDeviceIds.length && allDone)
            socket.emit('distanceRecord',
            {
                timedate: message.timedate,
                command: 'Sync',
                devinarray: deviceInArray,
                localtime: totSamples,
                room: message.room,
                master: message.master
            });
    }
    if(message.command == 'ReadyForSync')
    {
        readyToSync = true;
        console.log(message.command);
    }
    if(message.command == 'ReadyForDownload')
    {
        const downloadLink = document.createElement('a');
        downloadLink.href = message.file;
        downloadLink.download = 'multi_channel_audio.zip';
        downloadLink.textContent = message.timedate;
        downloadLink.style.display = 'inline-block';
        downloadLink.style.padding = '10px 20px';
        downloadLink.style.backgroundColor = 'rgb(0, 76, 108)';
        downloadLink.style.color = '#fff';
        downloadLink.style.textDecoration = 'none';
        downloadLink.style.borderRadius = '5px';
        downloadLink.style.fontWeight = 'bold';
        downloadLinksContainer.appendChild(downloadLink);
        
    }
});

socket.on('devDisconnected', function(message)
{   
    //console.log(message.id);
    var dev_part_of_array = connectedDeviceIds.indexOf(message.id);
    if (dev_part_of_array !== -1)
    {
        //console.log(`${message.id} is present in the array.`);
        refreshConnectedDevices(message.id,dev_part_of_array);
        //Run reconfigure array?
    } else {
        //console.log(`${message.id} is not present in the array.`);
    }
});

// **************************************
// ************* Functions ************** //
// **************************************

// Generate random token for socket rooms.
// Used by master device when creating the room, then entered by client devices to join the room.
const rand = () => {
    const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters.charAt(randomIndex);
    }
    return token;
  };
// Function called to create controls on master device.
function createAudioControls()
{
    // Controls for controlling recording from master device
    controlsDiv = document.createElement("div");
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.justifyContent = 'center';
    RunCalibButton = document.createElement("BUTTON");
    StopRecordButton = document.createElement("BUTTON");
    RunCalibButton.innerHTML = "Start Synced Recording";
    RunCalibButton.setAttribute("class","RunCalibButton");
    RunCalibButton.style.width = 0.25*screenWidth+'px';
    RunCalibButton.style.height = 0.25*screenWidth+'px';
    RunCalibButton.style.fontSize = 0.05*screenWidth+'px';
    RunCalibButton.style.margin = 0.01*screenWidth+'px';
    RunCalibButton.style.display = 'inline-block';
    RunCalibButton.style.backgroundColor = 'rgb(0, 76, 108)';
    RunCalibButton.style.color = 'rgb(255,255,255)';
    StopRecordButton.innerHTML = "Stop Recording";
    StopRecordButton.id = "StopRecordButton";
    StopRecordButton.style.width = 0.25*screenWidth+'px';
    StopRecordButton.style.height = 0.25*screenWidth+'px';
    StopRecordButton.style.fontSize = 0.05*screenWidth+'px';
    StopRecordButton.style.margin = 0.01*screenWidth+'px';
    StopRecordButton.disabled = true;
    StopRecordButton.style.display = 'inline-block';
    StopRecordButton.style.backgroundColor = 'rgb(0, 76, 108)';
    StopRecordButton.style.color = 'rgb(255,255,255)';

    /* ************************************************************ */
    /* ***    Container for audio file downloading              *** */
    downloadLinksContainer = document.createElement("div");
    downloadLinksContainer.id = "downloadsDiv";
    // Functions for buttons
    StopRecordButton.onclick = function()
    {
        StopRecording();
        StopRecordButton.disabled = true;
        StartRecordButton.disabled = false;
    }
    RunCalibButton.onclick = function()
    {
        console.log('Start distance calibration button pressed');
        distanceMeasurement();
        StopRecordButton.disabled = false;
        readyToSync = false;
    }
    // Add controls to document
    controlsDiv.appendChild(RunCalibButton);
    controlsDiv.appendChild(StopRecordButton);
    document.body.appendChild(controlsDiv);
    document.body.appendChild(downloadLinksContainer);
    
}

// Function that converts a string to hex
const stringToHex = (str) => 
{
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      const hexValue = charCode.toString(16);
        
      // Pad with zeros to ensure two-digit representation
      hex += hexValue.padStart(2, '0');
    }
    return hex;
};
function StartRecording()
{
    // Get current time/date
    timedate = Date.now().toString();
    // Send command to room devices to start recording. Use token as name identifier.
    socket.emit('Record',{
        room: roomToken,
        command: 'Start',
        timedate: timedate
    });
}
function StopRecording()
{
    socket.emit('distanceRecord',{
        room: roomToken,
        command: 'Stop',
        timedate: timedate
    });

}
// Adding to the PCM buffer
function Float32Concat(first, second)
{
	var result = new Float32Array(first.length + second.length);
	result.set(first);
	result.set(second, first.length);
	return result;
}
// Function to send the captured Audio to all devices in the room, through the server.
function shareAudio(audioData, timedate)
{
    socket.emit('audioData',{ 
        audioData: audioData,
        timedate: timedate,
        room: roomToken,
        device: deviceInArray},
        { binary: true });
}
// Function to download an audio track
function download(filename, data)
{
    var element = document.createElement('a');
    element.setAttribute('href',data);
    element.setAttribute('download',filename);
    element.click();
}
function distanceMeasurement()
{
    const ed = Date.now().toString();
    socket.emit('distanceRecord',{
        timedate: ed,
        command: 'Start',
        room: roomToken,
        master: socket.id,
        numDevices: connectedDeviceIds.length
    });
}
function generateRoundRobinPairs(numbers) // No longer used.
{
    var n = numbers.length;
    console.log('n: '+n);
    const pairs = []; 
    if (n % 2 !== 0) {
      // If the number of elements is odd, add a dummy element
      numbers.push(null);
      n++;
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n / 2; j++) {
        const first = numbers[j];
        const second = numbers[n - 1 - j];
  
        if (first !== null && second !== null) {
          pairs.push([first, second]);
        }
      }
      numbers.splice(1, 0, numbers.pop());
    }
    return pairs;
}
function refreshConnectedDevices(socketid,index)
{
    //Refresh list of devices connected to the array by removing the disconnected device
    moveEntriesBack(index);
    reAssignNumbers();
}

function moveEntriesBack(startIndex)
{
    // Check if startIndex is valid
    if (startIndex < 0 || startIndex >= connectedDeviceIds.length) {
        console.log('Invalid startIndex');
        return;
    }
    connectedDeviceIds.splice(startIndex, 1);
    numDevices = connectedDeviceIds.length;
    console.log(connectedDeviceIds);
    console.log("Number of connected devices: "+numDevices);
}

function reAssignNumbers()
{
    connectedDeviceIds.forEach((value, index) => {
        console.log(`Index ${index}: ${value}`);
        socket.emit('assignDevice', {
            device: index+1,
            id: value,
            room: roomToken
        });
    });
}

function saveAudioBuffer(buffer) {
    const pcmBuffer = new Float32Array(buffer);
    const blob = new Blob([pcmBuffer.buffer], { type: 'audio/pcm' });
    const url = URL.createObjectURL(blob);
    console.log(buffer.length)
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recording'+deviceInArray+'.pcm';
    link.click();
  }