// TODO: Add recordings saved from each recording session. Naming?? DateTime and array token?
//       Socket id static for each user.
// NOTE: Recording PCM for positioning  - use AudioWorklet.
//       Recording final audio to .wav - use MediaRecorder. Possibly convert from AudioWorklet raw data.

//import * as THREE from 'three';
/*
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';
*/
//import Stats from 'three/examples/jsm/libs/stats.module'
//import { GUI } from 'three/examples/jsm/libs/dat.gui.module'
//import { https }from 'https';

//Font for text in scene
//const fontLoader = new FontLoader();
//Lines
var points = [];
// Socketio
const socket = io();

// **************************************
// ************ Variables *************** //
// **************************************
const width = screen.availWidth;
const height = screen.availHeight;
//Flag for debug printing
var debugprint = false;
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
// Buffer to hold recorded audio data before sending to server / devices
//var pcmBuffer;
var recording = false;
// Variable for global audio stream access
var globalStream;
var recordPermission = false;
var source;
var recorderNode;
// Variables for audio channel synchronisation
var readyToSync = false;
var downloadLinksContainer;
// **************************************
// ************ Interface *************** //
// **************************************
// Banner at top
// Create the necessary HTML elements
/*
const body = document.body;
const bannerContainer = document.createElement("div");
const objectElement = document.createElement("object");
// Set IDs for styling and manipulation
bannerContainer.id = "bannerContainer";
objectElement.type = "image/svg+xml";
objectElement.data = "./banner.svg";
objectElement.textContent = "Your browser does not support SVG";
// Append elements to the body
bannerContainer.appendChild(objectElement);
body.appendChild(bannerContainer);
// Apply styles to the body for centering
body.style.margin = "0";
body.style.justifyContent = "center";
body.style.alignItems = "center";
//body.style.minHeight = "100vh";
body.style.backgroundColor = "#000000";
// Apply styles to the banner container
bannerContainer.style.width = "100%";
*/

// User interface
//var noticeDiv = document.getElementById('div');

//noticeDiv.innerHTML = `<object type="image/svg+xml" data="your-image.svg" width="100%" height="auto"></object>`;
//noticeDiv.innerHTML += '<p style="color:white;font-size:40px;">Ad Hoc Microphone Array</p>';
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
//var joinRoomDiv = document.createElement("div");
var joinRoomButton = document.createElement("BUTTON");
joinRoomButton.setAttribute("class","joinRoomButton");
joinRoomButton.innerHTML = "Join Array";
//joinRoomDiv.appendChild(joinRoomButton);
joinRoomButton.style.width = 0.25*screenWidth+'px';
joinRoomButton.style.height = 0.25*screenWidth+'px';
joinRoomButton.style.fontSize = 0.05*screenWidth+'px';
joinRoomButton.style.margin = 0.01*screenWidth+'px';
joinRoomButton.style.display = 'inline-block';
joinRoomButton.style.backgroundColor = 'rgb(0, 76, 108)';
joinRoomButton.style.color = 'rgb(255,255,255)';
//Session ID (Socket.io room)
//var createSessionTokenDiv = document.createElement("div");
//var DeviceInArrayDiv = document.createElement("div");

//createSessionTokenDiv.style.fontSize = '50px';
//createSessionTokenDiv.style.color = 'white';
//createSessionTokenDiv.style.display = 'inline-block';

//DeviceInArrayDiv.style.fontSize = '50px';
//DeviceInArrayDiv.style.color = 'white';
//DeviceInArrayDiv.style.display = 'inline-block';
//DeviceInArrayDiv.style.textAlign = 'center';

// Add all div to main webpage
document.body.appendChild(createRoomDiv);
//createRoomDiv.appendChild(createSessionTokenDiv);
createRoomDiv.appendChild(joinRoomButton);
createRoomDiv.style.textAlign ='center';
//document.body.appendChild(joinRoomDiv);
//document.body.appendChild(DeviceInArrayDiv);

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
// ************** WEBGL ***************** //
// **************************************
// 3D Scene
/*
const scene = new THREE.Scene();
// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth*0.75 / window.innerHeight*0.75, 0.1, 1000);
camera.position.set(0.5, 0.5, 0.5);
camera.lookAt(0, 0, 0);
// Renderer
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setClearColor("#233143");
renderer.setSize(window.innerWidth*0.75, window.innerHeight*0.75);
document.body.appendChild(renderer.domElement);
*/
// Responsive to window size changes
/*
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth*0.75, window.innerHeight*0.75);
    renderer.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
*/
// Create Box
/*
const phoneGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.0025);
var phoneMaterial1 = new THREE.MeshLambertMaterial({color: 0x000000});
var phoneMaterial2 = new THREE.MeshLambertMaterial({color: 0x000000});
var phoneMaterial3 = new THREE.MeshLambertMaterial({color: 0x000000});
var phoneMaterial4 = new THREE.MeshLambertMaterial({color: 0x000000});
const phoneMesh1 = new THREE.Mesh(phoneGeometry, phoneMaterial1);
const phoneMesh2 = new THREE.Mesh(phoneGeometry, phoneMaterial2);
const phoneMesh3 = new THREE.Mesh(phoneGeometry, phoneMaterial3);
const phoneMesh4 = new THREE.Mesh(phoneGeometry, phoneMaterial4);
*/
/*
scene.add(phoneMesh1);
scene.add(phoneMesh2);
scene.add(phoneMesh3);
phoneMesh1.position.set(0, 0, 0); // Optional, 0,0,0 is the default
phoneMesh2.position.set(0.5, 0, 0); // Optional, 0,0,0 is the default
phoneMesh3.position.set(1, 0, 0); // Optional, 0,0,0 is the default
*/
// Light
/*
const light = new THREE.PointLight(0xFFFFFF, 1, 100);
light.position.set(5, 5, 5);
scene.add(light);
// Set up ambient lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight)
//Trackball Controls for Camera 
//const controls = new OrbitControls( camera, renderer.domElement );
const controls = new TrackballControls(camera, renderer.domElement); 
controls.rotateSpeed = 4;
controls.dynamicDampingFactor = 0.15;
// function
const rendering = function() {
    requestAnimationFrame(rendering);    // Constantly rotate box
    //scene.rotation.z -= 0.005;
    //scene.rotation.x -= 0.01;    
    renderer.render(scene, camera);
    // Update trackball controls
    controls.update();
}
rendering();
*/
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
        numDevices = numDevices + 1;
        if(debugprint) console.log(message.id);
        connectedDeviceIds.push(message.id);
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
    //DeviceInArrayDiv.innerHTML = "Device number assigned: "+message;
    // Identify the device recording in batch (and room token)
    deviceInArray = message;
    console.log('Device in array: '+deviceInArray);
});
socket.on('Number of Devices', function(message)
{
    if(!master)
    {
        numDevices = message.device;
    }
    //checkDeviceRender();
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
        //console.log("Received Record Start command from server");
        //console.log(message.command);
        // Get timedate from master device
        timedate = message.timedate;
        // Get medai stream permission
        navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
            // Permission granted, stream is available
            // Function for passing stream to global variable
            recordPermission = true;
            context = new AudioContext({latencyHint: "interactive", sampleRate: 48000});
            //context.samplerate = 48000;
            source = context.createMediaStreamSource(stream);
            context.audioWorklet.addModule('./js/Record.js').then(() =>
            {
                // Additional function?
                //console.log("audioWorklet has been set up");
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
                            //console.log("Received started command from audio worklet");
                            // Visually show that device has started recording
                            document.body.style.backgroundColor = '0x00FF00';
                        }
                        if(e.data.eventType === 'stopped')
                        {
                            //console.log("Received stopped command from audio worklet, with timedate: "+e.data.timedate);
                            recordPermission = false;
                            // Visually show that device has started recording
                            document.body.style.backgroundColor = '0x000000';
                            //pcmBuffer = e.data.audio;
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
        //console.log("Received stop command from server");
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
    //console.log("Received audio data from other device");
    // Create download link for audio from each device
    /*
    var blob = new Blob([message.audioData]);
    var link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    var filename = message.timedate+"_"+message.device+".pcm";
    console.log(filename);
    link.download = filename; */
    //console.log("download link created");
    //link.click(); //Automatically download the audiofile

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
        //console.log("Delete button pressed");
        let evtTgt = e.target;
        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
    }
    
    downloadButton.onclick = function(e)
    {
        //console.log("Download button pressed");
        download(filename,audioURL);
    }
    
    clipLabel.onclick = function() 
    {
        //console.log("Clip name clicked");
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
            //context.samplerate = 48000;
            source = context.createMediaStreamSource(stream);
            context.audioWorklet.addModule('./js/Record.js').then(() =>
            {
                // Additional function?
                //console.log("audioWorklet has been set up");
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
                                //pcmBuffer = Float32Concat(pcmBuffer,audioData);
                                socket.emit('audioData',{ 
                                    audioData: audioData,
                                    timedate: timedate,
                                    room: roomToken,
                                    device: deviceInArray},
                                    { binary: true });
                                totSamples = e.data.totalSamples;
                            }
                        }  
                        if(e.data.eventType === 'started')
                        {
                            var localtime = Date.now().toString();
                            console.log("Received started command from audio worklet");
                            // Visually show that device has started recording
                            document.body.style.backgroundColor = '0x00FF00'; //FIX
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
                            // Visually show that device has started recording
                            document.body.style.backgroundColor = '0x000000';
                            //pcmBuffer = e.data.audio;
                            // Distance measurement script
                            //shareAudio(pcmBuffer, e.data.timedate);
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
            // Add additional error handling
        }
    }
    if(message.command == 'Started')
    {
        /*
        console.log('Started command received: '+message.device+' at: '+deviceInArray);
        if(message.device == pairs[message.pair-1][0]) 
        {
            console.log('Device 1 started recording');
            dev1Rec = true;
        }
        if(message.device == pairs[message.pair-1][1])
        {
            console.log('Device 2 started recording');
            dev2Rec = true;
        }
        //if(message.pair < pairs)
        if(dev1Rec == true && dev2Rec == true)
        {
            console.log('Both devices in pair are recording');
            socket.emit('distanceRecord',{
                timedate: message.timedate,
                device1: message.device1,
                device2: message.device2,
                command: 'EmitPRBS',
                device: 1,
                pair: message.pair,
                room: message.room
            });
        }
        */
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
                    master: message.master,
                    devices: connectedDeviceIds.length
                });
            }
        }
    }
    if(message.command == 'PRBSPlay')
    {
        //Add additional check to be ready?
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
        /*
        for(let i = 0; i < connectedDeviceIds.length; i++)
        {
            if(message.device == connectedDeviceIds[i])
            {
                readyDevices[i] = 1;
            }
        }
        */
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
            distanceprbs1.play();
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
                    console.log('Last device finished');
                    //Possibly send audio snippets to python script.
                }
                /*
                else
                {
                    setTimeout(function()
					{
						socket.emit('distanceRecord',{
                            timedate: message.timedate,
                            command: 'PRBSPlay',
                            device: connectedDeviceIds[message.deviceNo],
                            room: message.room,
                            master: message.master
                        });
					},100);
                }
                */
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
        //.log(finishedDevices);
        var allReady = finishedDevices.every(value => value === 1);
        //console.log(allReady);
        //console.log(message.deviceinarray);
        //console.log(connectedDeviceIds.length);
        
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
              }, 1000); // Run the function after 3 seconds
              
            /*
            socket.emit('distanceRecord',{
                timedate: message.timedate,
                command: 'EndPRBS',
                devinarray: deviceInArray,
                room: roomToken,
                master: message.master
            });
            */
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
        //console.log(DevicesPRBSEnded);
        var allDone = DevicesPRBSEnded.every(value => value === 1);
        //console.log(allDone);
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
        /*
        const filename = message.audioFile;
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
        });
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `https://192.168.11.239/download/${filename}`, true, null, httpsAgent);
        xhr.responseType = 'blob';
        xhr.onload = function() {
            if (xhr.status === 200) {
              const blob = xhr.response;
              // Create a download link for the file.
              const downloadLink = document.createElement('a');
              downloadLink.href = URL.createObjectURL(blob);
              downloadLink.download = filename;
          
              // Append the download link to the DOM.
              //document.body.appendChild(downloadLink);
              downloadLinksContainer.appendChild(downloadLink);
              // Click the download link to start downloading the file.
              //downloadLink.click();
            }
          };
        xhr.send();
        */
        
        const downloadLink = document.createElement('a');
        downloadLink.href = message.file;
        downloadLink.download = 'multi_channel_audio.wav';
        downloadLink.textContent = message.timedate;
        downloadLinksContainer.appendChild(downloadLink);
        
    }
    /*
    if(message.command == 'EmitPRBS')
    {
        
        console.log('Device received PRBS command');
        var distanceprbs1 = new Audio('../prbs1.wav');
        distanceprbs1.loop = false;
        distanceprbs1.volume = 1.0;
        distanceprbs1.play();
        distanceprbs1.onended = function()
        {
            console.log('PRBS 1 finished');
            socket.emit('distanceRecord',{
                timedate: message.timedate,
                device1: message.device1,
                device2: message.device2,
                command: 'EmitPRBS',
                device: 2,
                pair: message.pair,
                room: message.room
            });
        };
        
    }*/
    /*
    if(message.command == 'Finished')
    {
        //Stop recording -> send to python script
        socket.emit('distanceRecord' ,{
            command: 'Stop',
            room: message.room,
            device1: message.device1,
            device2: message.device2,
            pair: message.pair,
            room: message.room
        });
    }*/
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
    //StartRecordButton = document.createElement("BUTTON");
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
    // Disable until calibration complete
    /*
    StartRecordButton.innerHTML = "Start Recording";
    //StartRecordButton.setAttribute("class","StartRecordButton");
    StartRecordButton.id = "StartRecordButton";
    StartRecordButton.style.width = '400px';
    StartRecordButton.style.height = '200px';
    StartRecordButton.style.fontSize = '50px';
    */
    StopRecordButton.innerHTML = "Stop Recording";
    //StopRecordButton.setAttribute("class","StopRecordButton");
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
    /*
    StartRecordButton.onclick = function()
    {
        StartRecording();
        StartRecordButton.disabled = true;
        StopRecordButton.disabled = false;
    }*/
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
    //controlsDiv.appendChild(StartRecordButton);
    controlsDiv.appendChild(StopRecordButton);
    //controlsDiv.appendChild(EndPRBSButton); // ********************************
    document.body.appendChild(controlsDiv);
    document.body.appendChild(downloadLinksContainer);
    
}
// Function called to create the recording status of local device.
// Add master sees recording status of all devices?
function createRecordingStatus()
{

}
 // Renderer window resizing
 /*
 window.addEventListener('resize', function()
{
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize( width*0.75, height*0.75);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
});

// Render in extra devices
function checkDeviceRender()
{
    if(numDevices >= 1)
    {
        // Remove timeout later
        setTimeout(function()
        {	
            //Generate colour hex from id
            var colourHex = stringToHex(connectedDeviceIds[0]);
            colourHex = colourHex.substring(0, 6);
            colourHex = '0x'+colourHex; 
            //console.log(colourHex);
            //console.log(typeof colourHex);
            phoneMesh1.material.color.setHex(colourHex);
            scene.add(phoneMesh1);
            phoneMesh1.position.set(0, 0, 0);
            // Device text
            fontLoader.load(
                // path to the font (included in three)
                '../droid_serif_regular.typeface.json',
                // called when the font has loaded
                function (droidFont) {
                const settings = {
                    size: 0.01,
                    height: 0.0008,
                    font: droidFont,
                }
                const textGeometry = new TextGeometry('Device 1', settings);
                const textMaterial = new THREE.MeshBasicMaterial();
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.x = 0.05;
                //textMesh.rotateX(-Math.PI / 2);
                scene.add(textMesh);
                }, 
                // called when the font is loading
                function (xhr) {
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
                },
                // called when there is an error loading the font
                function (error) {
                console.log(error);
                }
            );
        },100);
    }
    if(numDevices >= 2) 
    {
        // Remove timeout later
        setTimeout(function()
        {	
            //Generate colour hex from id
            var colourHex = stringToHex(connectedDeviceIds[1]);
            colourHex = colourHex.substring(0, 6);
            colourHex = '0x'+colourHex;
            phoneMesh2.material.color.setHex(colourHex);
            scene.add(phoneMesh2);
            phoneMesh2.position.set(0, 0.06, 0);
            // Device text
            fontLoader.load(
                // path to the font (included in three)
                '../droid_serif_regular.typeface.json',
                // called when the font has loaded
                function (droidFont) {
                const settings = {
                    size: 0.01,
                    height: 0.0008,
                    font: droidFont,
                }
                const textGeometry = new TextGeometry('Device 2', settings);
                const textMaterial = new THREE.MeshBasicMaterial();
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.x = 0.05;
                textMesh.position.y = 0.06;
                //textMesh.rotateX(-Math.PI / 2);
                scene.add(textMesh);
                }, 
                // called when the font is loading
                function (xhr) {
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
                },
                // called when there is an error loading the font
                function (error) {
                console.log(error);
                }
            );
        },100);
    }
    if(numDevices >= 3)
    {
        // Remove timeout later
        setTimeout(function()
        {	
            //Generate colour hex from id
            var colourHex = stringToHex(connectedDeviceIds[2]);
            colourHex = colourHex.substring(0, 6);
            colourHex = '0x'+colourHex;
            phoneMesh3.material.color.setHex(colourHex);
            scene.add(phoneMesh3);
            phoneMesh3.position.set(0, 0.12, 0);
            // Device text
            fontLoader.load(
                // path to the font (included in three)
                '../droid_serif_regular.typeface.json',
                // called when the font has loaded
                function (droidFont) {
                const settings = {
                    size: 0.01,
                    height: 0.0008,
                    font: droidFont,
                }
                const textGeometry = new TextGeometry('Device 3', settings);
                const textMaterial = new THREE.MeshBasicMaterial();
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.x = 0.05;
                textMesh.position.y = 0.12;
                //textMesh.rotateX(-Math.PI / 2);
                scene.add(textMesh);
                }, 
                // called when the font is loading
                function (xhr) {
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
                },
                // called when there is an error loading the font
                function (error) {
                console.log(error);
                }
            );
        },100);
    }
    if(numDevices >= 4)
    {
        // Remove timeout later
        setTimeout(function()
        {	
            //Generate colour hex from id
            var colourHex = stringToHex(connectedDeviceIds[3]);
            colourHex = colourHex.substring(0, 6);
            colourHex = '0x'+colourHex;
            phoneMesh4.material.color.setHex(colourHex);
            scene.add(phoneMesh4);
            phoneMesh4.position.set(0, 0.18, 0);
            // Device text
            fontLoader.load(
                // path to the font (included in three)
                '../droid_serif_regular.typeface.json',
                // called when the font has loaded
                function (droidFont) {
                const settings = {
                    size: 0.01,
                    height: 0.0008,
                    font: droidFont,
                }
                const textGeometry = new TextGeometry('Device 4', settings);
                const textMaterial = new THREE.MeshBasicMaterial();
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.x = 0.05;
                textMesh.position.y = 0.18;
                //textMesh.rotateX(-Math.PI / 2);
                scene.add(textMesh);
                }, 
                // called when the font is loading
                function (xhr) {
                console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
                },
                // called when there is an error loading the font
                function (error) {
                console.log(error);
                }
            );
        },100);
    }
    rendering();
}
*/
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
    //console.log('Start button pressed');
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
    //console.log('Stop button pressed');
    socket.emit('distanceRecord',{
        room: roomToken,
        command: 'Stop',
        timedate: timedate
    });

}
function RunCalibration()
{

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
    //console.log("Sharing audio data with other devices, filesize: "+audioData.length);
    //console.log('ShareAudio function with timedate: '+timedate);
    
    socket.emit('audioData',{ 
        audioData: audioData,
        timedate: timedate,
        room: roomToken,
        device: deviceInArray},
        { binary: true });
  
   /*
    const form = new FormData();
    form.append('file', audioData);
    form.append('name', timedate+'_'+deviceInArray+'.pcm');
    form.append('room', roomToken);
    const options = {
        hostname: 'syncrecord.eu',
        port: 443,
        path: '/audioShare',
        method: 'POST',
        headers: form.getHeaders()
        };
    const req = https.request(options, (res) => {
        console.log(`Server responded with status code: ${res.statusCode}`);
    });
    
    form.pipe(req);
    
    req.on('error', (error) => {
        console.error(`Error sending file: ${error.message}`);
    }); */
}
// Function to download an audio track
function download(filename, data)
{
    //console.log("Download function started");
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
function generateRoundRobinPairs(numbers) 
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

// ********* FOR RECORDING TESTING, REMOVE BEFORE DEPLOYMENT ********** //
function EndedPRBS()
{
    /*
    socket.emit('distanceRecord',{
        timedate: timedate,
        command: 'EndPRBS',
        devinarray: deviceInArray,
        localtime: totSamples,
        room: roomToken,
    });
    */
}
