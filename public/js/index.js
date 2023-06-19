// TODO: Add recordings saved from each recording session. Naming?? DateTime and array token?
//       Socket id static for each user.
// NOTE: Recording PCM for positioning  - use AudioWorklet.
//       Recording final audio to .wav - use MediaRecorder. Possibly convert from AudioWorklet raw data.

import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
var debugprint = true;
//Room token to allow communication with other devices in the session
var roomToken;
// Determine if master device
var master;
var deviceInArray;
// Tracking number of connected client devices.
var numDevices = 0;
var connectedDeviceIds = [];

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

// Controls only for master device
var controlsDiv;
var RunCalibButton; 
var StartRecordButton;
var StopRecordButton;

// **************************************
// ************** Controls ************** //
// **************************************

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

    }
    // Button to stop recording clicked
    StopRecordButton.onclick = function()
    {

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
        if(debugprint) console.log(connectedDeviceIds);
        numDevices = numDevices + 1;
        if(debugprint) console.log(numDevices);
        socket.emit('assignDevice', {
            device: numDevices,
            id: message.id,
            room: roomToken
        });
    }
});
socket.on('DevNumAssigned', message =>
{
    if(debugprint) console.log(message);
    DeviceInArrayDiv.innerHTML = "Device number assigned: "+message;
    deviceInArray = message;
});

// **************************************
// ************** WEBGL ***************** //
// **************************************
// 3D Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbbbbbb); // Optional, black is default
// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth*0.75, window.innerHeight*0.75);
// Set up lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(10, 20, 0); // x, y, z
scene.add(dirLight);
// Camera
const camera = new THREE.OrthographicCamera(
  width / -2, // left
  width / 2, // right
  height / 2, // top
  height / -2, // bottom
  1, // near
  100 // far
);
camera.position.set(1, 1, 1);
camera.lookAt(0, 0, 0);
const controls = new OrbitControls( camera, renderer.domElement );
const loader = new GLTFLoader();
// Add it to HTML
document.body.appendChild(renderer.domElement);
renderer.render(scene, camera);
animate();


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
    StartRecordButton.setAttribute("class","StartRecordButton");
    StartRecordButton.style.width = '400px';
    StartRecordButton.style.height = '200px';
    StartRecordButton.style.fontSize = '50px';
    StopRecordButton.innerHTML = "Stop Recording";
    StopRecordButton.setAttribute("class","StopRecordButton");
    StopRecordButton.style.width = '400px';
    StopRecordButton.style.height = '200px';
    StopRecordButton.style.fontSize = '50px';
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
// WebGL Animation
function animate() {
    requestAnimationFrame(animate)
    //cube.rotation.x += 0.005
    //cube.rotation.y += 0.01
    controls.update()
    renderer.render(scene, camera)
 }
 // Window resizing
 window.addEventListener('resize', function()
	{
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize( width*0.75, height*0.75);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	} );
function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth*0.75, window.innerHeight*0.75 );
}