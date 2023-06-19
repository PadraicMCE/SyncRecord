const socket = io();
const width = screen.availWidth;
const height = screen.availHeight;

//Flag for debug printing
var debugprint = true;
//Master device

// User interface
var noticeDiv = document.getElementById('div');
noticeDiv.innerHTML += '<p style="color:white;font-size:40px;">Camera ON</p>';
// Div for control buttons
var runSetupDiv = document.createElement("div");
// Run set up button
var runSetupButton = document.createElement("BUTTON");
runSetupButton.innerHTML = "Run PRBS";
runSetupButton.setAttribute("class","runSetupButton");
runSetupDiv.appendChild(runSetupButton);
runSetupButton.style.width = '400px';
runSetupButton.style.height = '400px';
runSetupButton.style.fontSize = '100px';
// Stop Button
var stopDiv = document.createElement("div");
var stopButton = document.createElement("BUTTON");
stopButton.setAttribute("class","stopButton");
stopButton.innerHTML = "Stop";
stopDiv.appendChild(stopButton);
stopButton.style.width = '400px';
stopButton.style.height = '400px';
stopButton.style.fontSize = '100px';

// **************************************
// ************** Controls ************** //
// **************************************
