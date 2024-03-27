/* ************************************
    Written by: Padraic McEvoy
    Last updated 21/12/2023
************************************ */
//Using required packages
const path = require('path');
// For running remotely, use https
const https = require('https');
//const http = require('http');
const express = require('express');
const socketio = require('socket.io');
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

// 8443 for remote; 443 for local
const PORT = 8443 || process.env.PORT;
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


const app = express();
const server = https.createServer(https_options, app);
const io = socketio(server);
//Set static folder
app.use(express.static('public', { 'extensions': ['html', 'js'], 'content-type': 'application/javascript' }));
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
app.use('/https/', express.static(path.join(__dirname, 'node_modules/https')));

// Allow downloading of created audio files; New route.
app.get('/download/:filename', (req, res) => {
	const filename = req.params.filename;
	const filepath = path.join(__dirname, '/tmp/', filename);
  
	res.sendFile(filepath);
  });

io.on('connection', socket => {
    socket.emit('message', 'Welcome to server');

	socket.on('disconnect', function(message)
	{
		// TODO: Check room of disconnected device.
		io.emit('devDisconnected',{
			id: socket.id
		});
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
		var filename = message.timedate+'_'+message.device;
		saveAudioToFile(message.room, filename, message.audioData);
	});

	socket.on('distanceRecord', function(message)
	{
		console.log('Received "distanceRecord" with command: '+message.command+' from: '+socket.id);
		if(message.command == 'Started')
		{
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
			});
		}
		else if(message.command == 'Stop')
		{
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: message.command,
				room: message.room,
				master: message.master
			});
		}
		else if(message.command == 'Start')
		{
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
			let options = {
				mode: 'text',
				pythonOptions: ['-u'], // get print results in real-time
				args: arguments,
			  };
			
			const pythonScript = 'SyncAudio.py';
			const pyshell = new PythonShell(pythonScript, options);
			// Optional: Handle script termination
			pyshell.end((err, code, signal) => {
				if (err) {
				console.error('Python script execution failed:', err);
				} else {
				console.log(`Python script execution completed with code ${code}, signal ${signal}`);
				// Allow files to be downloaded
				//const audioFile = './tmp/'+message.room+'/'+message.timedate+'_sync.wav';
				const audioFile = './tmp/'+message.room+'/'+message.timedate+'_sync.zip';
				io.to(message.master).emit('distanceRecord',
				{
					timedate: message.timedate,
					command: 'ReadyForDownload',
					room: message.room,
					file: audioFile
				});
				console.log('Sending download command to master');
				}
				// Commands to send download links to master device
			});
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
		
	  }
	});
  }

server.listen(PORT);
console.log(`Server running on ${PORT}`);