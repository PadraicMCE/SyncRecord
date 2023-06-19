/*
	Testing of socket.io rooms for communication between devices assigned to certain recording sessions.
	A new room is created by the master device, which can be joined by other devices.
	NOTE: Add master device approval to allow a new client device to join? Pop up notification of new client attempting to join?
	Written by: Padraic McEvoy
	Last updated: 19/06/2023
	Link: https://socket.io/docs/v3/rooms/
*/
//Using required packages
const path = require('path');
//const https = require('https');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
// Used for file receiving and storage
const multer = require('multer');
// Setting up the directory for multer
const storage = multer.diskStorage({
	destination: function(req,file,cb) {
		cb(null, './tmp/');
	},
	filename: function(req,file,cb) {
		cb(null, file.originalname);
	}
}); 
let upload = multer({ storage: storage });

const fs = require('fs');
const { DH_UNABLE_TO_CHECK_GENERATOR } = require('constants');

//Variables for use in script


//Setting up https port 443 with ssl certificates and matched on DNS cname. NGinx used so run http instead.
//const HOST = '127.0.0.1';
const PORT = 8000 || process.env.PORT;
/*
const PORT = 443 || process.env.PORT;
var https_options = {
	key: fs.readFileSync("./ssl/privkey.pem"),
    cert: fs.readFileSync("./ssl/cert.pem"),
    ca: fs.readFileSync("./ssl/fullchain.pem")
};*/

// Testing on local server with http. For microphone access https is required
const app = express();
//const server = https.createServer(https_options, app);
const server = http.createServer(app);
const io = socketio(server);
//Set static folder
app.use(express.static(path.join(__dirname, 'public')));

app.post('/test', upload.single('image'), (req,res) => {
	try {
		res.send(req.file);
		//console.log(req.file);
	}catch(err) {
		res.send(400);
	}
	console.log('Uploaded Image\r');
});
app.post('/uploadAudio', upload.single('audio'), (req,res) => {
	try {
		res.send(req.file);
		console.log(req.file);
	}catch(err) {
		res.send(400);
	}
	console.log('Uploaded Audio\r');
});

//Run when client connects
io.on('connection', socket => {
    socket.emit('message', 'Welcome to server');
	
    socket.on('userConnected', data =>
    {
        console.log('User '+data+' connected');
        socket.emit('userConnected',data);
        socket.broadcast.emit('userConnected',data);
	});

    //Sending audio data between devices
    socket.on('MediaMessage', (deviceNo,date,media) =>
    {
        socket.broadcast.emit('MediaMessage',deviceNo,date,media);
        console.log("Broadcast new media");
    });

    //Runs when a client disconnects
    socket.on('disconnect', () => {
        console.log('A client has disconnected');
		//pollDevices();
	});

	socket.on('joinRoom', (room) =>
	{
		socket.join(room);
		var id = socket.id;
		console.log(id);
		io.to(room).emit('joinedRoom',{
			id: id
		});

	});

	socket.on('assignDevice', function(message)
	{
		console.log(message.id);
		io.to(message.id).emit('DevNumAssigned',message.device);
	});

});

io.of("/").adapter.on("create-room", (room) => {
	console.log(`room ${room} was created`);
});

io.of("/").adapter.on("join-room", (room, id) => {
	console.log(`socket ${id} has joined room ${room}`);
});



server.listen(PORT);
console.log(`Server running on ${PORT}`);
//Notification on server.
//server.listen(PORT, HOST);
//console.log(`Server running on https://${HOST}:${PORT}`);