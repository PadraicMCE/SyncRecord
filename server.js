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
// For running remotely, use https
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

// Check file access permissions WRITE
/*
const filePath = './tmp/'
fs.access(filePath, fs.constants.W_OK, (err) => {
	if (err) {
	  console.error(`No write access to ${filePath}`);
	} else {
	  console.log(`Write access granted to ${filePath}`);
	}
  });
  */

const PORT = 443 || process.env.PORT;
/*
var https_options = {
	key: fs.readFileSync("./ssl/privkey.pem"),
    cert: fs.readFileSync("./ssl/cert.pem"),
    ca: fs.readFileSync("./ssl/fullchain.pem")
};
*/
// For local testing a self-signed ssl cert is used:
var https_options = {
	key: fs.readFileSync("./ssl/openssl/privkey.pem"),
    cert: fs.readFileSync("./ssl/openssl/cert.pem")
};

//const PORT = 80 || process.env.PORT;
const app = express();
const server = https.createServer(https_options, app);
//const server = http.createServer(app);
const io = socketio(server);
//Set static folder
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public', { 'extensions': ['html', 'js'], 'content-type': 'application/javascript' }));
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
app.use('/https/', express.static(path.join(__dirname, 'node_modules/https')));
//app.use('/stream/', express.static(path.join(__dirname, 'node_modules/socket.io-stream')));

/*
app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});*/

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

// Allow downloading of created audio files; New route.
app.get('/download/:filename', (req, res) => {
	const filename = req.params.filename;
	const filepath = path.join(__dirname, '/tmp/', filename);
  
	res.sendFile(filepath);
  });

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
		//console.log('audio data received, size: '+message.audioData.length+' from device: '+message.device);
		// Create a new WaveFile instance
		//const wav = new WaveFile();
		// Set the audio format properties
		//wav.fromScratch(1, 48000, '32f', message.audioData);
		// Change the bit depth to 32-bit
		//wav.toBitDepth("16");
		// Save the WAV file
		//const wavBuffer = wav.toBuffer();

		//Sending raw pcm, can change to .wav
		/*
		io.to(message.room).emit('audioData',{
			audioData: message.audioData,
			timedate: message.timedate,
			device: message.device},
			{ binary: true });
			*/
		var filename = message.timedate+'_'+message.device;
		saveAudioToFile(message.room, filename, message.audioData);
	});

	socket.on('distanceRecord', function(message)
	{
		console.log('Received "distanceRecord" with command: '+message.command+' from: '+socket.id);
		if(message.command == 'Started')
		{
			//console.log('Started response received from device: '+message.device);
			try{
				io.to(message.master).emit('distanceRecord',{
					timedate: message.timedate,
					command: message.command,
					device: message.device,
					devinarray: message.devinarray,
					room: message.room,
					master: message.master
				});
			} catch(error){
				//Add error handling. Send error message to room.
			}
			var name = message.timedate;
			var dev = message.devinarray;
			var time = message.localtime;
			fs.appendFile('./public/tmp/'+message.room+'/'+name,'startrecord '+dev+': '+time+'\r',
			function(err){
				if(err) throw err;
				//console.log('file: ./tmp/'+name+'.txt'+'  data: startrecord '+dev+': '+time+'\r');
			});
			
		}
		else if(message.command == 'PRBSPlay')
		{
			io.to(message.device).emit('distanceRecord',{
				timedate: message.timedate,
				command: message.command,
				device: message.device,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'PRBSReady')
		{
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: message.command,
				device: message.device,
				deviceNo: message.deviceNo,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'Ready')
		{
			console.log('startprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime);
			//Relay to device to play PRBS
			io.to(message.device).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'Ready',
				device: message.device,
				devinarray: message.devinarray,
				deviceNo: message.deviceNo,
				room: message.room,
				master: message.master
			});
			//Log local time of prbs being played
			fs.appendFile('./public/tmp/'+message.room+'/'+message.timedate,
			'startprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r',
			function(err){
				if(err) throw err;
				//console.log('file: ./tmp/'+name+'.txt'+'  data: startprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r');
			});
		}
		else if(message.command == 'Finished')
		{
			console.log("Received "+message.command+" from "+message.devinarray+" sending to "+message.device)
			io.to(message.device).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'Finished',
				device: message.device,
				devinarray: message.devinarray,
				deviceNo: message.deviceNo,
				localtime: message.localtime,
				room: message.room,
				master: message.master
			});
			console.log('stoppedprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime);
			//Log local time of prbs being played
			fs.appendFile('./public/tmp/'+message.room+'/'+message.timedate,
			'stoppedprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r',
			function(err){
				if(err) throw err;
				//console.log('file: ./tmp/'+name+'.txt'+'  data: stopprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r');
			});
		}
		else if(message.command == 'Stop')
		{
			//console.log('Sending command: '+message.command+' to devices: '+message.device1+' and '+message.device2);
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: message.command,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'Start')
		{
			//console.log('Sending command: '+message.command+' to room: '+message.room);
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'Start',
				room: message.room,
				master: message.master
			});
			fs.mkdir('./public/tmp/'+message.room, {recursive: true}, (err) => {
				if (err) {
					console.error('Error creating directory:', err);
				} else {
					console.log('Directory created successfully or already exists.');
					fs.appendFile('./public/tmp/'+message.room+'/'+message.timedate,
					'numberdevices '+message.numDevices+'\r',
					function(err){
						if(err) throw err;
						//console.log('file: ./tmp/'+name+'.txt'+'  data: stopprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r');
					});
				}
			});
		}
		else if(message.command == 'Stopped')
		{
			//Log local time of prbs being played
			fs.appendFile('./public/tmp/'+message.room+'/'+message.timedate,
			'stoppedrecord '+message.devinarray+': '+message.localtime+'\r',
			function(err){
				if(err) throw err;
				//console.log('file: ./tmp/'+name+'.txt'+'  data: stopprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r');
			});
			io.to(message.master).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'Stopped',
				device: message.device,
				devinarray: message.devinarray,
				deviceNo: message.deviceNo,
				localtime: message.localtime,
				room: message.room,
				master: message.master
			});
			// RUN PYTHON SCRIPT HERE. CHECK AUDIO FILE
			// Script to synchronise final recordings
		}
		else if(message.command == 'PRBSFinished')
		{
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'PRBSFinished',
				device: message.device,
				devinarray: message.devinarray,
				deviceNo: message.deviceNo,
				localtime: message.localtime,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'EndPRBS')
		{
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'EndPRBS',
				devinarray: message.devinarray,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'PRBSended')
		{
			fs.appendFile('./public/tmp/'+message.room+'/'+message.timedate,
			'endedPRBS '+message.devinarray+': '+message.localtime+'\r',
			function(err){
				if(err) throw err;
				//console.log('file: ./tmp/'+name+'.txt'+'  data: stopprbs '+message.deviceNo+' device '+message.devinarray+': '+message.localtime+'\r');
			});
			io.to(message.master).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'LastPRBSCheck',
				devinarray: message.devinarray,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'Sync')
		{
			//Run python script to determine synchronisation of audio channels
			var arguments = [];
			arguments.push('./public/tmp/'+message.room+'/'+message.timedate);
			for (let i = 1; i <= message.devinarray; i++)
			{
				arguments.push('./public/tmp/'+message.room+'/'+message.timedate+'_'+i+'.pcm');
			}
			let options = {
				mode: 'text',
				pythonOptions: ['-u'], // get print results in real-time
				args: arguments
			  };
			PythonShell.run('./ReadAudio.py', options).then(messages=>{
				// No results to print to console.
				//Print when successful TODO: Add timeout to detect latency errors etc.
				io.to(message.master).emit('distanceRecord',
				{
					timedate: message.timedate,
					command: 'ReadyForSync',
					room: message.room,
					master: message.master
				});
			});
		}
		else if(message.command == 'SyncAudio')
		{
			//Run python script to synchronise audio channels
			//Run python script to determine synchronisation of audio channels
			var arguments = [];
			arguments.push('./public/tmp/'+message.room+'/'+message.timedate+'_sync');
			for (let i = 1; i <= message.devices; i++)
			{
				arguments.push('./public/tmp/'+message.room+'/'+message.timedate+'_'+i+'.pcm');
			}
			//console.log("Python arguments: "+ arguments);
			let options = {
				mode: 'text',
				pythonOptions: ['-u'], // get print results in real-time
				args: arguments,
			  };
			
			  const pythonScript = 'SyncAudio.py';
			const pyshell = new PythonShell(pythonScript, options);
			/*
			// Set up event listeners to capture stdout and stderr
			pyshell.on('message', (message) => {
				console.log(`Python script stdout: ${message}`);
			});
			
			pyshell.on('stderr', (message) => {
				console.error(`Python script stderr: ${message}`);
			});
			*/
			// Optional: Handle script termination
			pyshell.end((err, code, signal) => {
				if (err) {
				console.error('Python script execution failed:', err);
				} else {
				console.log(`Python script execution completed with code ${code}, signal ${signal}`);
				// Allow files to be downloaded
				const audioFile = './tmp/'+message.room+'/'+message.timedate+'_sync.wav';
				io.to(message.master).emit('distanceRecord',
				{
					timedate: message.timedate,
					command: 'ReadyForDownload',
					room: message.room,
					file: audioFile
				});
				}
				// Commands to send download links to master device
			});
			
			/*
			PythonShell.run('SyncAudio.py', options).then(messages=>{
				// No results to print to console.
				//Print when successful TODO: Add timeout to detect latency errors etc.
				// Check what message; Error, complete?
				//console.log(messages);
			});*/
			
		}
	});
	

});

io.of("/").adapter.on("create-room", (room) => {
	console.log(`room ${room} was created`);
});
io.of("/").adapter.on("join-room", (room, id) => {
	console.log(`socket ${id} has joined room ${room}`);
});

function saveAudioToFile(session, filename, data) {
	const filePath = './public/tmp/'+session+'/'+filename+'.pcm';
	// Append the data to the file
	fs.appendFile(filePath, data, (err) => {
	  if (err) {
		console.error('Error saving audio:', err);
	  } else {
		//console.log('Audio data saved to file: '+filePath);
	  }
	});
  }

server.listen(PORT);
console.log(`Server running on ${PORT}`);