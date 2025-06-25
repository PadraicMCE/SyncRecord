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
const buffers = {};	//Buffers for audio data

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


const PORT = 8443 || process.env.PORT;
// For remote deployment ssl certificates:

var https_options = {
	key: fs.readFileSync("./ssl/privkey.pem"),
    cert: fs.readFileSync("./ssl/cert.pem"),
    ca: fs.readFileSync("./ssl/fullchain.pem")
}; 


// For local testing a self-signed ssl cert is used:
/*
var https_options = {
	key: fs.readFileSync("./ssl/openssl/privkey.pem"),
    cert: fs.readFileSync("./ssl/openssl/cert.pem")
};
*/

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

	// Log every socket message received
	/*
    socket.onAny((event, ...args) => {
        console.log(`Received event: ${event}, with data:`, args);
    });
	*/

	socket.on('disconnect', function(message)
	{
		// TODO: Check room of disconnected device.
		io.emit('devDisconnected',{
			id: socket.id
		});
		// Clear buffers
		// Clean up buffers for the device
		for (const roomId in buffers) 
		{
			for (const deviceId in buffers[roomId]) 
			{
			  //if (socket.id === deviceId) {
				/*flushBufferToFile(roomId, deviceId, (err) => {
				  if (err) {
					console.error('Error writing remaining buffer to file:', err);
				  } */
				  delete buffers[roomId][deviceId];
				//});
			}
		}
	});

    socket.on('joinRoom', (room) =>
	{
		socket.join(room);
		var id = socket.id;
		console.log(id);
		io.to(room).emit('joinedRoom',{
			id: id
		});
		//Initialise a new nested buffer for the room
		if(!buffers[room])
		{
			buffers[room] = {};
		}
		if(!buffers[room][id])
		{
			buffers[room][id] = [];
		}
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
		var filename = './public/tmp/'+message.room+'/'+message.timedate+'_'+message.device+'.pcm';
		//var filename = message.timedate+'_'+message.device;
		//data = message.audioData;
		//console.log(message.audioData.BYTES_PER_ELEMENT);
		//buffer = Buffer.from(message.audioData.buffer);
		//console.log(buffer.BYTES_PER_ELEMENT);
		//saveAudioToFile(message.room, filename, buffer);
		position = message.totData;
		samples = message.samples;
		//Check buffers initialised
		if(!buffers[message.room])
		{
			buffers[message.room] = {};
		}
		if(!buffers[message.room][socket.id])
		{
			buffers[message.room][socket.id] = [];
		}
		//console.log("Audio data received, samples: "+samples+" ,position: "+position);
		const bufferData = Buffer.from(message.audioData);
		//const bufferData = new Float32Array(message.audioData);
		fs.appendFile('./public/tmp/'+message.room+'/'+message.timedate+'_'+message.device+'BufferLog',
			'Audio data position received: '+position+'\r',
			function(err){
				if(err) throw err;
			});
		insertDataAtPosition(buffers[message.room][socket.id],bufferData,position);
		/*
		writeFileAtPosition(filename, message.audioData, position, (err) => {
			if (err) {
			  console.error('Error writing to file:', err);
			  socket.emit('error', 'Error writing to file');
			} else {
			  socket.emit('success', 'Data written successfully');
			}
		});
		*/
		/*
		// Check if the file exists
		fs.access(filename, fs.constants.F_OK, (err) => {
			if (err) {
			// File doesn't exist, create it
			fs.writeFile(filename, '', (err) => {
				if (err) {
				//console.error('Error creating file:', err);
				} else {
				//console.log('File created successfully');
				}
			});
			} else {
			// File exists
			//console.log('File already exists');
			if(!isNaN(position))
			{
				//
				
				//
				writeDataToPosition(filename, position, message.audioData);
			}
			}
		}); 
		*/
		/*
		if(!isNaN(position))
		{
			writeDataToPosition(filename, position, message.audioData);
		}
		*/
	});

	socket.on('distanceRecord', function(message)
	{
		//console.log('Received "distanceRecord" with command: '+message.command+' from: '+socket.id);
		if(message.command == 'Started')
		{
			try{
				io.to(message.master).emit('distanceRecord',{
					timedate: message.timedate,
					command: message.command,
					device: message.device,
					devinarray: message.devinarray,
					room: message.room,
					master: message.master,
					calibrating: message.calibrating
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
			console.log('Received "distanceRecord" with command: '+message.command+' from: '+socket.id + 'to:'+message.device);
			io.to(message.device).emit('distanceRecord',{
				timedate: message.timedate,
				command: message.command,
				device: message.device,
				room: message.room,
				master: message.master,
				calibrating: message.calibrating
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
				master: message.master,
				calibrating: message.calibrating
			});
		}
		else if(message.command == 'Start')
		{
			io.to(message.room).emit('distanceRecord',{
				timedate: message.timedate,
				command: 'Start',
				room: message.room,
				master: message.master,
				calibrating: message.calibrating
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
				master: message.master,
				calibrating: message.calibrating
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
				master: message.master,
				calibrating: message.calibrating
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
			// Retrieve list of devices in the room
			const clientsInRoom = io.sockets.adapter.rooms.get(message.room);
			//console.log(clientsInRoom);
			const deviceList = [];
			if (clientsInRoom) {
				clientsInRoom.forEach(clientId => {
				  //const clientSocket = io.sockets.sockets.get(clientId);
				  //deviceList.push(clientSocket.deviceId);
				  deviceList.push(clientId);
				});
			}
			//console.log(deviceList);
			// Flush buffers to file for each device in the room
			i = 1;
			deviceList.forEach(deviceId => {
				flushBufferToFile(message.room, deviceId, message.timedate, i, 0, (err) => {
				if (err) {
					console.error(`Error flushing buffer to file for device ${deviceId} in room ${roomId}:`, err);
				} else {
					console.log(`Buffer flushed to file for device ${deviceId} in room ${message.room}`);
				}
				});
				i = i + 1;
			});
			/*
			console.log('Buffer size: '+buffers[message.room][socket.id].length);
			flushBufferToFile(message.room, message.timedate, message.devinarray, 0, (err) => {
				if (err) {
				  console.error('Error writing remaining buffer to file:', err);
				}
			});*/
			//Run python script to determine synchronisation of audio channels
			var arguments = [];
			// Added in for calibration file.
			arguments.push(message.room)
			arguments.push('./public/tmp/'+message.room+'/'+message.timedate);
			for (let i = 1; i <= message.devinarray; i++)
			{
				arguments.push('./public/tmp/'+message.room+'/'+message.timedate+'_'+i+'_temp.pcm');
			}
			let options = {
				mode: 'text',
				pythonOptions: ['-u'], // get print results in real-time
				args: arguments
			};
			// Create a new PythonShell instance
			//let pyshell = new PythonShell('./ReadAudio.py', options);
			let pyshell = new PythonShell('./Detection.py', options);

			// Capture messages from the Python script
			pyshell.on('message', function (message) {
				console.log('Python message:', message);
			});

			// Capture error messages from the Python script
			pyshell.on('stderr', function (stderrMessage) {
				console.error('Python stderr:', stderrMessage);
			});

			// Handle errors
			pyshell.on('error', function (error) {
				console.error('Python error:', error);
			});

			// Handle when the script finishes
			pyshell.on('close', function () {
				console.log('Python script finished.');
				io.to(message.master).emit('distanceRecord', {
					timedate: message.timedate,
					command: 'ReadyForSync',
					room: message.room,
					master: message.master,
					calibrating: message.calibrating
				});
			});
			/*
			PythonShell.run('./ReadAudio.py', options).then(messages=>
			{
				io.to(message.master).emit('distanceRecord',
				{
					timedate: message.timedate,
					command: 'ReadyForSync',
					room: message.room,
					master: message.master
				});
			});
			*/
		}
		else if(message.command == 'SyncAudio')
		{	
			// Retrieve list of devices in the room
			const clientsInRoom = io.sockets.adapter.rooms.get(message.room);
			//console.log(clientsInRoom);
			const deviceList = [];
			if (clientsInRoom) {
				clientsInRoom.forEach(clientId => {
				  //const clientSocket = io.sockets.sockets.get(clientId);
				  //deviceList.push(clientSocket.deviceId);
				  deviceList.push(clientId);
				});
			}
			//console.log(deviceList);
			// Flush buffers to file for each device in the room
			i = 1;
			deviceList.forEach(deviceId => {
				flushBufferToFile(message.room, deviceId, message.timedate, i, 1, (err) => {
				if (err) {
					console.error(`Error flushing buffer to file for device ${deviceId} in room ${roomId}:`, err);
				} else {
					console.log(`Buffer flushed to file for device ${deviceId} in room ${message.room}`);
				}
				});
				i = i + 1;
			});
			//Run python script to synchronise audio channels
			//Run python script to determine synchronisation of audio channels
			/*
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
			*/
		}
	});
	
	//Data for phones that support unprocessed audio data
	socket.on('audio_support', function(message)
	{
		console.log(`Device: ${message.device}`)
		console.log(`Manufacturer: ${message.manufacturer}`)
		console.log(`Unprocessed audio supported: ${message.audio_source_unprocessed_supported}`)
		fs.appendFile('./supported_devices',
			'Manufacturer: '+message.manufacturer+'\r'+'Device: '+message.device+'\r'+'Unprocessed audio supported: '+message.audio_source_unprocessed_supported+'\r-------------------------\r',
			function(err){
				if(err) throw err;
			});
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
var positionStreamsMap ={};
// Function to create a writable stream to the audio file at a specified position
function createWriteStream(filepath, position) {
	return fs.createWriteStream(filepath, { flags: 'r+', start: position });
}
// Function to get or create a writable stream for a given position in audio file
function getOrCreateWriteStream(filepath, position) {
	if (!positionStreamsMap[position]) {
	  positionStreamsMap[position] = createWriteStream(filepath, position);
	}
	return positionStreamsMap[position];
}

// Event listener for errors on each stream
Object.values(positionStreamsMap).forEach((writeStream) => {
	writeStream.on('error', (err) => {
	  console.error(`Error writing to file:`, err);
	});
});

// Function to write data to the stream at a specified position
function writeDataToPosition(filepath, position, data) {
	const writeStream = getOrCreateWriteStream(filepath, position);
	writeStream.write(data, (err) => {
	  if (err) {
		console.error(`Error writing data to file:`, err);
	  } else {
		//console.log(`Data written successfully to position ${position}`);
	  }
	});
}

function writeFileAtPosition(filepath, data, position, callback)
{
	fs.open(filepath, 'r+', (err, fd) => {
		if (err) return callback(err);
		fs.write(fd, data, 0, data.length, position, (err) => {
			if (err) {
				fs.close(fd, () => callback(err));
			} else {
				fs.close(fd, callback);
			}
		})
	})
}

function insertDataAtPosition(buffer, data, position) 
{
	// Ensure the position is within the buffer's range
	/*
	if (position > buffer.length) {
	  position = buffer.length;
	}*/
	//buffer.set(data,position);
	buffer.splice(position, 0, data);
	// Add check buffer size not too large -> flush to file now and empty buffer.
	//Log local time of prbs being played

}

function flushBufferToFile(roomId, deviceId, datestamp, devnum, clear, callback) 
{
	const buffer = buffers[roomId][deviceId];
	console.log('Buffer size in function: '+buffers[roomId][deviceId].length);
	const data = Buffer.concat(buffer);
	var filePath = null;
	// Write the buffered data to a file
	if(clear == 0)
	{
		filePath = path.join(__dirname, `./public/tmp/${roomId}/${datestamp}_${devnum}_temp.pcm`);
	} else {
		filePath = path.join(__dirname, `./public/tmp/${roomId}/${datestamp}_${devnum}.pcm`);
	}
	fs.writeFile(filePath, data, (err) => {
	  	if (err) return callback(err);
	  	if(clear == 1)
		{
	  		buffers[roomId][deviceId] = []; // Clear the buffer after writing
		}
	  	callback(null);
	});
}

server.listen(PORT);
console.log(`Server running on ${PORT}`);