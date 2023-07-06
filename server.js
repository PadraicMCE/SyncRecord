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
const https = require('https');
//const http = require('http');
const express = require('express');
const socketio = require('socket.io');
//const ss = require('socket.io-stream');
//Import PythonShell module.
const {PythonShell} = require('python-shell');
//Package to convert pcm to wav
const WaveFile = require('wavefile').WaveFile;
const multer = require('multer');

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
const { deserialize } = require('v8');


const PORT = 443 || process.env.PORT;
var https_options = {
	key: fs.readFileSync("./ssl/privkey.pem"),
    cert: fs.readFileSync("./ssl/cert.pem"),
    ca: fs.readFileSync("./ssl/fullchain.pem")
};

//const PORT = 8000 || process.env.PORT;
const app = express();
const server = https.createServer(https_options, app);
//const server = http.createServer(app);
const io = socketio(server);
//Set static folder
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public', { 'extensions': ['html', 'js'], 'content-type': 'application/javascript' }));
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
//app.use('/stream/', express.static(path.join(__dirname, 'node_modules/socket.io-stream')));


app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});

//HTTPS Streaming of audio
/*
app.post('/upload', upload.single('file'), (req, res) => {
	const file = req.file; // Uploaded file object
	const name = req.body.name; // Value of the 'name' field
	const room = req.body.room; // Value of the 'description' field
  
	const chunks = [];
	res.on('data', (chunk) => {
	  chunks.push(chunk);
	});
	res,on('end', () => {
	  console.log('All audio data received');
	  const dataArrayBuffer = Buffer.concat(chunks);
	  const dataArray = deserializeDataArray(dataArrayBuffer);
	  // Send audio data to client devices
	  
  
	});
  
  }); */

/*
app.post('/audioShare', (req, res) => {
	var tempBuffer = [];
	// Create a writable stream to save the received binary data
	const writableStream = fs.createWriteStream(tempBuffer);
	
	// Receive the binary data in chunks
	req.on('data', (chunk) => {
	  // Write each chunk to the writable stream
	  writableStream.write(chunk);
	});
	
	// End the writable stream when all data has been received
	req.on('end', () => {
	  writableStream.end();
	  console.log('File saved successfully.');
	  res.sendStatus(200);
	});
});*/

io.on('connection', socket => {
    socket.emit('message', 'Welcome to server');

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
        io.to(message.room).emit('Number of Devices',{
            device: message.device
        });
	});

	socket.on('deviceIds', function(message)
	{
		socket.to(message.room).emit('deviceIds',message.ids);
	});

	socket.on('Record', function(message)
	{
		io.to(message.room).emit('Record',{command: message.command, timedate: message.timedate});
	});

	socket.on('audioData', function(message)
	{
		console.log('audio data received, size: '+message.audioData.length+' from device: '+message.device);
		// Create a new WaveFile instance
		const wav = new WaveFile();
		// Set the audio format properties
		wav.fromScratch(1, 48000, '32f', message.audioData);
		// Change the bit depth to 32-bit
		wav.toBitDepth("16");
		// Save the WAV file
		const wavBuffer = wav.toBuffer();

		//Sending raw pcm, can change to .wav
		io.to(message.room).emit('audioData',{
			audioData: message.audioData,
			timedate: message.timedate,
			device: message.device},
			{ binary: true });
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