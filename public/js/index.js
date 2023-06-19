const socket = io();
const width = screen.availWidth;
const height = screen.availHeight;

//Flag for debug printing
var debugprint = true;
//Room token to allow communication with other devices in the session
var roomToken;

// User interface
var noticeDiv = document.getElementById('div');
noticeDiv.innerHTML += '<p style="color:white;font-size:40px;">Socket Room Test</p>';
// Div for control buttons
var createRoomDiv = document.createElement("div");
// Run set up button
var createRoomButton = document.createElement("BUTTON");
createRoomButton.innerHTML = "Create Session";
createRoomButton.setAttribute("class","createRoomButton");
createRoomDiv.appendChild(createRoomButton);
createRoomButton.style.width = '400px';
createRoomButton.style.height = '200px';
createRoomButton.style.fontSize = '50px';
// Stop Button
var joinRoomDiv = document.createElement("div");
var joinRoomButton = document.createElement("BUTTON");
joinRoomButton.setAttribute("class","joinRoomButton");
joinRoomButton.innerHTML = "Join Session";
joinRoomDiv.appendChild(joinRoomButton);
joinRoomButton.style.width = '400px';
joinRoomButton.style.height = '200px';
joinRoomButton.style.fontSize = '50px';
//Session ID (Socket.io room)
var createSessionTokenDiv = document.createElement("div");
var joinSessionTokenDiv = document.createElement("div");
createSessionTokenDiv.style.fontSize = '50px';
createSessionTokenDiv.style.color = 'white';
// Add all div to main webpage
document.body.appendChild(createRoomDiv);
document.body.appendChild(createSessionTokenDiv);
document.body.appendChild(joinRoomDiv);
document.body.appendChild(joinSessionTokenDiv);

// **************************************
// ************** Controls ************** //
// **************************************

createRoomButton.onclick = function()
{
    var token = rand();
    console.log(token);
    createSessionTokenDiv.innerHTML = "Session Token: "+token;
    roomToken = token;
}

joinRoomButton.onclick = function()
{
    // Prompt the user for input and store it in a variable
    const sessionToken = prompt('Enter session token:');
    createSessionTokenDiv.innerHTML = "Session Token: "+sessionToken;
    roomToken = sessionToken;
}

const rand = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 4; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        token += characters.charAt(randomIndex);
    }
    return token;
  };