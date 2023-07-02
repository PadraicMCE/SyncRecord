// TODO: Add recordings saved from each recording session. Naming?? DateTime and array token?
//       Socket id static for each user.
// NOTE: Recording PCM for positioning  - use AudioWorklet.
//       Recording final audio to .wav - use MediaRecorder. Possibly convert from AudioWorklet raw data.

import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

//Font for text in scene
const fontLoader = new FontLoader();
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
// Time/Date for recording labels
var timedate;
// AudioWorklet variables
var context;
var audioSource;
// Buffer to hold recorded audio data before sending to server / devices
var pcmBuffer;
var recording = false;
// Variable for global audio stream access
var globalStream;
var recordPermission = false;
var source;
var recorderNode;
// **************************************
// ************ Interface *************** //
// **************************************
// User interface
var noticeDiv = document.getElementById('div');
noticeDiv.innerHTML += '<p style="color:white;font-size:40px;">Ad Hoc Microphone Array</p>';
// Div for control buttons
var createRoomDiv = document.createElement("div");
var createRoomButton = document.createElement("BUTTON");
createRoomButton.innerHTML = "Create Array";
createRoomButton.setAttribute("class","createRoomButton");
createRoomDiv.appendChild(createRoomButton);
createRoomButton.style.width = '400px';
createRoomButton.style.height = '200px';
createRoomButton.style.fontSize = '50px';
//
var joinRoomDiv = document.createElement("div");
var joinRoomButton = document.createElement("BUTTON");
joinRoomButton.setAttribute("class","joinRoomButton");
joinRoomButton.innerHTML = "Join Array";
joinRoomDiv.appendChild(joinRoomButton);
joinRoomButton.style.width = '400px';
joinRoomButton.style.height = '200px';
joinRoomButton.style.fontSize = '50px';
//Session ID (Socket.io room)
var createSessionTokenDiv = document.createElement("div");
var DeviceInArrayDiv = document.createElement("div");
createSessionTokenDiv.style.fontSize = '50px';
createSessionTokenDiv.style.color = 'white';
DeviceInArrayDiv.style.fontSize = '50px';
DeviceInArrayDiv.style.color = 'white';

// Add all div to main webpage
document.body.appendChild(createRoomDiv);
createRoomDiv.appendChild(createSessionTokenDiv);
document.body.appendChild(joinRoomDiv);
document.body.appendChild(DeviceInArrayDiv);

// **************************************
// ************** WEBGL ***************** //
// **************************************
// 3D Scene
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

// Responsive to window size changes
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth*0.75, window.innerHeight*0.75);
    renderer.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
// Create Box
const phoneGeometry = new THREE.BoxGeometry(0.1, 0.05, 0.0025);
var phoneMaterial1 = new THREE.MeshLambertMaterial({color: 0x000000});
var phoneMaterial2 = new THREE.MeshLambertMaterial({color: 0x000000});
var phoneMaterial3 = new THREE.MeshLambertMaterial({color: 0x000000});
var phoneMaterial4 = new THREE.MeshLambertMaterial({color: 0x000000});
const phoneMesh1 = new THREE.Mesh(phoneGeometry, phoneMaterial1);
const phoneMesh2 = new THREE.Mesh(phoneGeometry, phoneMaterial2);
const phoneMesh3 = new THREE.Mesh(phoneGeometry, phoneMaterial3);
const phoneMesh4 = new THREE.Mesh(phoneGeometry, phoneMaterial4);
/*
scene.add(phoneMesh1);
scene.add(phoneMesh2);
scene.add(phoneMesh3);
phoneMesh1.position.set(0, 0, 0); // Optional, 0,0,0 is the default
phoneMesh2.position.set(0.5, 0, 0); // Optional, 0,0,0 is the default
phoneMesh3.position.set(1, 0, 0); // Optional, 0,0,0 is the default
*/
// Light
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

// **************************************
// ************** Controls ************** //
// **************************************

// Controls only for master device
var controlsDiv;
var RunCalibButton = document.createElement("BUTTON");
var StartRecordButton = document.createElement("BUTTON");
var StopRecordButton = document.createElement("BUTTON");

// Create room clicked (device assigned as master of that array)
// A random token is created.
// Device joins that session as master.
createRoomButton.onclick = function()
{
    var token = rand();
    if(debugprint) console.log(token);
    createSessionTokenDiv.innerHTML = "Array Token: "+token;
    roomToken = token;
    master = true;
    socket.emit('joinRoom',roomToken);
    // Create recording controls buttons for master device
    createAudioControls();
    createRoomButton.disabled = true;
}
// Join array button pressed, user asked for array token.
// Device joins as client to the session entered.
joinRoomButton.onclick = function()
{
    // Prompt the user for input and store it in a variable
    master = false;
    const sessionToken = prompt('Enter Array Token:');
    createSessionTokenDiv.innerHTML = "Array Token: "+sessionToken;
    roomToken = sessionToken;
    socket.emit('joinRoom',roomToken);
    joinRoomButton.disabled = true;
}

if(master)
{
    // Button to run positioning calibration clicked
    RunCalibButton.onclick = function()
    {

    }
    // Button to start recording clicked
    StartRecordButton.onclick = function()
    {
        console.log('Start button pressed');
        // Get current time/date
        ed = Date.now().toString();
        // Send command to room devices to start recording. Use token as name identifier.
        socket.emit('Record',{
            room: roomToken,
            command: 'Start',
            ed: ed
        });
        document.querySelector('StartRecordButton').disabled = true;
    }
    // Button to stop recording clicked
    StopRecordButton.onclick = function()
    {
        // Send command to room devices to stop recording. Use token as name identifier.
        socket.emit('Record',{
            room: roomToken,
            command: 'Stop',
            ed: ed
        });
    }
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
        if(debugprint) console.log(message.id);
        connectedDeviceIds.push(message.id);
        console.log(connectedDeviceIds);
        numDevices = numDevices + 1;
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
    DeviceInArrayDiv.innerHTML = "Device number assigned: "+message;
    // Identify the device recording in batch (and room token)
    deviceInArray = message;
});
socket.on('Number of Devices', function(message)
{
    if(!master)
    {
        numDevices = message.device;
    }
    checkDeviceRender();
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
                    pcmBuffer = new Float32Array();
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
    var blob = new Blob([message.audioData]);
    var link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    var filename = message.timedate+"_"+message.device+".pcm";
    console.log(filename);
    link.download = filename;
    //console.log("download link created");
    //link.click(); //Automatically download the audiofile

    // UI for each audio received
    const soundClips = document.createElement('section');
    const clipContainer = document.createElement('article');
    const clipLabel = document.createElement('p');
    const audio = document.createElement('audio');
    const deleteButton = document.createElement('button');
    const downloadButton = document.createElement('button');
    
    
    clipContainer.classList.add('clip');
    audio.setAttribute('controls', '');
    deleteButton.innerHTML = "Delete";
    downloadButton.innerHTML = "Download";
    clipLabel.innerHTML = filename;
    
    clipContainer.appendChild(audio);
    clipContainer.appendChild(clipLabel);
    clipContainer.appendChild(deleteButton);
    clipContainer.appendChild(downloadButton);
    soundClips.appendChild(clipContainer);
    document.body.appendChild(soundClips);
    
    audio.controls = true;

    var filename = message.timedate+"_"+message.device+".pcm";
    console.log('Filename: '+filename);
    var blob = new Blob([message.audioData]);

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

// **************************************
// ************* Functions ************** //
// **************************************

// Generate random token for socket rooms.
// Used by master device when creating the room, then entered by client devices to join the room.
const rand = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
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
    RunCalibButton = document.createElement("BUTTON");
    StartRecordButton = document.createElement("BUTTON");
    StopRecordButton = document.createElement("BUTTON");
    RunCalibButton.innerHTML = "Run Position Calibration";
    RunCalibButton.setAttribute("class","RunCalibButton");
    RunCalibButton.style.width = '400px';
    RunCalibButton.style.height = '200px';
    RunCalibButton.style.fontSize = '50px';
    // Disable until calibration complete
    StartRecordButton.innerHTML = "Start Recording";
    //StartRecordButton.setAttribute("class","StartRecordButton");
    StartRecordButton.id = "StartRecordButton";
    StartRecordButton.style.width = '400px';
    StartRecordButton.style.height = '200px';
    StartRecordButton.style.fontSize = '50px';
    StopRecordButton.innerHTML = "Stop Recording";
    //StopRecordButton.setAttribute("class","StopRecordButton");
    StopRecordButton.id = "StopRecordButton";
    StopRecordButton.style.width = '400px';
    StopRecordButton.style.height = '200px';
    StopRecordButton.style.fontSize = '50px';
    StopRecordButton.disabled = true;
    // Functions for buttons
    StartRecordButton.onclick = function()
    {
        StartRecording();
        StartRecordButton.disabled = true;
        StopRecordButton.disabled = false;
    }
    StopRecordButton.onclick = function()
    {
        StopRecording();
        StopRecordButton.disabled = true;
        StartRecordButton.disabled = false;
    }
    // Add controls to document
    controlsDiv.appendChild(RunCalibButton);
    controlsDiv.appendChild(StartRecordButton);
    controlsDiv.appendChild(StopRecordButton);
    document.body.appendChild(controlsDiv);
    
}
// Function called to create the recording status of local device.
// Add master sees recording status of all devices?
function createRecordingStatus()
{

}
 // Renderer window resizing
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
                '/three.js-master/examples/fonts/droid/droid_serif_regular.typeface.json',
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
                '/three.js-master/examples/fonts/droid/droid_serif_regular.typeface.json',
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
                '/three.js-master/examples/fonts/droid/droid_serif_regular.typeface.json',
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
                '/three.js-master/examples/fonts/droid/droid_serif_regular.typeface.json',
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
    socket.emit('Record',{
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
