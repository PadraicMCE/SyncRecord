/* ************************************
    Written by: Padraic McEvoy
    Last updated 25/05/2026
************************************ */
/* **********************************
**** Settings for cloud/local deployment ****
********************************** */
// Set to true for local deployment/testing
const local_deploy = false; //false;
// CLoud server URL for downloads
const Server_URL = 'syncrecord.eu';
// https:// does not need to be included here.


/* **********************************
**** Server code ****
********************************** */

//Using required packages
const path = require('path');
const os = require('os');
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

const roomProcessingPromises = new Map();
// Map for masters of each array
const roomMaster = new Map();   // roomId -> socket.id of the master

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


const PORT = 3000 || process.env.PORT;

const app = express();
//Set static folder
app.use(express.static('public', { 'extensions': ['html', 'js'], 'content-type': 'application/javascript' }));
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));
app.use('/https/', express.static(path.join(__dirname, 'node_modules/https')));
// Make the 'tmp' directory publicly accessible for downloads
app.use('/downloads', express.static(path.join(__dirname, 'public/tmp')));

// For remote deployment ssl certificates:
if(!local_deploy)
{
	var https_options = {
		key: fs.readFileSync("./ssl/privkey.pem"),
		cert: fs.readFileSync("./ssl/cert.pem"),
		ca: fs.readFileSync("./ssl/fullchain.pem")
	}; 
	server = https.createServer(https_options, app);
}
if(local_deploy)
{
	// For local testing a self-signed ssl cert is used:
	var https_options = {
		key: fs.readFileSync("./ssl/openssl/SyncRecord_privkey.pem"),
		cert: fs.readFileSync("./ssl/openssl/SyncRecord_cert.pem")
	};
	server = https.createServer(https_options, app);
}

const io = socketio(server);

io.on('connection', socket => {
    socket.emit('message', 'Welcome to server');

	socket.on('disconnect', function(message) {
		console.log(`Socket ${socket.id} disconnected.`);
		// Check if this socket was the master of any room
		// Iterate through roomMaster map to find matches
		for (const [roomId, masterId] of roomMaster.entries()) {
			if (masterId === socket.id) {
				console.log(`Master ${socket.id} left room ${roomId}. Triggering cleanup.`);
				// Remove the master entry from the map
				roomMaster.delete(roomId);
				// Clean up buffers for all devices in this room
				if (buffers[roomId]) {
					console.log(`Clearing buffers for room ${roomId}...`);
					delete buffers[roomId];
				}
				// Clean up any pending processing promises
				if (roomProcessingPromises[roomId]) {
					console.log(`Cancelling pending processing for room ${roomId}...`);
					delete roomProcessingPromises[roomId];
				}
				// Delete the directory
				if (!local_deploy) {
					deleteRoomFolder(roomId);
				} else {
					console.log(`[Local Mode] Skipping folder deletion for room ${roomId}.`);
				}
			}
		}
		// Clean up buffers for this specific socket in any room (In case slave device disconnects)
		for (const roomId in buffers) {
			if (buffers[roomId] && buffers[roomId][socket.id]) {
				delete buffers[roomId][socket.id];
				console.log(`Cleaned up buffer for slave device ${socket.id} in room ${roomId}`);
			}
		}
	});

    socket.on('joinRoom', function(message)
	{
		room = message.room;
		socket.join(room);
		var id = socket.id;
		console.log(id);
		io.to(room).emit('joinedRoom',{
			id: id
		});
		// Check is room exists. If not, set master.
		if (!roomMaster.has(room)) {
			// First client that ever joins this room becomes the master
			roomMaster.set(room, id);
			console.log(`${id} is now the MASTER of room ${room}`);
		}
		//Initialise a new nested buffer for the room
		if(!buffers[room])
		{
			buffers[room] = {};
		}
		if(!buffers[room][id])
		{
			// Allocate 20MB per device stream. (Approx 3.5 minutes of audio at 48kHz 16-bit mono)
			// The audio stream is written directly to a file, so this shouldn't be needed.
			buffers[room][id] = Buffer.alloc(20 * 1024 * 1024); // 20MB buffer
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
		const roomDir = `./public/tmp/${message.room}`;
    	const filename = `${message.timedate}_${message.device}.pcm`;
    	const filePath = path.join(roomDir, filename);
		//Decode the Base64 data from the client
		const bufferData = Buffer.from(message.audioData, 'base64');
		const position = parseInt(message.totData);
		// Write the audio stream data to the file at the correct position
		writeToPcmFile(filePath, bufferData, position);
	});

	socket.on('distanceRecord', function(message)
	{
		//console.log('Received "distanceRecord" with command: '+message.command+' from: '+socket.id);
		if(message.command == 'Started')
		{
			console.log("Started received by: "+socket.id+"  with calibrating: "+message.calibrating)
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
			console.log("Stop command recieved"+"  with calibrating: "+message.calibrating)
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
			console.log("Start command recieved"+"  with calibrating: "+message.calibrating)
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
			console.log("Stopped received by: "+socket.id+"  with calibrating: "+message.calibrating)
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
			console.log("PRBSFinished received by: "+socket.id+"  with calibrating: "+message.calibrating)
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
			console.log("Received Sync Command");
			// Retrieve list of devices in the room
			const clientsInRoom = io.sockets.adapter.rooms.get(message.room);
			if (!clientsInRoom) return;

			const deviceList = Array.from(clientsInRoom);
    		const roomDir = path.join(__dirname, `./public/tmp/${message.room}`);

			// Audio stream snapshot paths to pass to Detection.py
    		const snapshotPaths = [];

			deviceList.forEach((deviceId, index) => {
				const devNum = index + 1;
				const sourceFile = path.join(roomDir, `${message.timedate}_${devNum}.pcm`);
				const snapshotFile = path.join(roomDir, `${message.timedate}_${devNum}_snapshot.pcm`);
				if (fs.existsSync(sourceFile)) {
					// Copy to same directory with a new suffix
					fs.copyFileSync(sourceFile, snapshotFile);
					snapshotPaths.push(snapshotFile);
				}
			});

			//Run python script to determine synchronisation of audio channels
			roomProcessingPromises[message.room] = new Promise((resolve, reject) => {
				let scriptArgs = [message.room, path.join(roomDir, message.timedate)];
				// Add the snapshot files as arguments for Python script
        		snapshotPaths.forEach(p => scriptArgs.push(p));
				
				let options = {
					mode: 'text',
					pythonOptions: ['-u'], // get print results in real-time
					args: scriptArgs
				};
				// Create a new PythonShell instance
				let pyshell = new PythonShell('./Detection.py', options);
				// Capture messages from the Python script
				pyshell.on('message', function (message) {
					console.log('Python message:', message);
				});
				// Capture error messages from the Python script
				pyshell.on('stderr', function (stderrMessage) {
					console.error('Python stderr:', stderrMessage);
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
					if(message.calibrating == 1)
					{
						// If localising mic array with no audio recording.
						if(!local_deploy)
						{	const zipFileName = `${message.timedate}_sync.zip`;
							const absoluteZipPath = path.join(__dirname, 'public','tmp',message.room,message.timedate+'_sync');
							// If cloud-hosted, send the download file.
							const checkFileAndSendLink = () => {
								fs.access(absoluteZipPath, fs.constants.F_OK, (err) => {
									if(!err) {
										// File exists, proceed to send the link
										const fileUrlPath = `${message.room}/${message.timedate}_sync`;
										const fullDownloadUrl = local_deploy
											? `https://${getLocalIpAddress()}:${PORT}/tmp/${fileUrlPath}`
											: `https://${Server_URL}:${PORT}/tmp/${fileUrlPath}`;
										console.log(`Sending 'DownloadReady' to master. URL: ${fullDownloadUrl}`);
										// --- SEND THE EVENT ---
										io.to(message.master).emit('DownloadReady', {
											timedate: message.timedate, // Used as part of the filename on the client
											downloadLink: fullDownloadUrl, // The key the client expects
										});
										// Clean up the promise tracker
										delete roomProcessingPromises[message.room];
									} else if (attempts < maxAttempts) {
										// File doesn't exist yet, retry after a delay
										attempts++;
										console.log(`File not found, retrying... (Attempt ${attempts}/${maxAttempts})`);
										setTimeout(checkFileAndSendLink, retryDelay);
									} else {
										// Max attempts reached, file never appeared.
										console.error(`Gave up waiting for file: ${absoluteZipPath}. It never appeared.`);
										// --- NOTIFY THE CLIENT OF THE FAILURE ---
										io.to(message.master).emit('customError', {
											message: `Processing failed: The server could not create the download file for ${zipFileName}.`
										});
										// Clean up the promise tracker
										delete roomProcessingPromises[message.room];
									}
								});
							}
							checkFileAndSendLink();
						}
						// If hosted locally, the file remains in the directory.
					}
					resolve();
					io.to(message.room).emit('distanceRecord',{
						timedate: message.timedate,
						command: message.command,
						room: message.room,
						master: message.master,
						calibrating: message.calibrating
					});
				});
				// Handle errors
				pyshell.on('error', function (error) {
				console.error('Python error:', error);
				});
			});
		}
		else if(message.command == 'SyncAudio')
		{	
			console.log("Received SyncAudio Command");
			// Retrieve list of devices in the room
			const clientsInRoom = io.sockets.adapter.rooms.get(message.room);
			if (!clientsInRoom) return;

			const deviceList = Array.from(clientsInRoom);
    		const roomDir = path.join(__dirname, `./public/tmp/${message.room}`);
			
			//Run python script to synchronise audio channels
			const runSyncAudioScript = () => {
				var scriptArgs = [];
				scriptArgs.push(message.room)
				scriptArgs.push(path.join(__dirname, 'public', 'tmp', message.room, `${message.timedate}_sync`));
				for (let i = 1; i <= message.devices; i++)
				{
					const finalPcmFile = path.join(__dirname, 'public', 'tmp', message.room, `${message.timedate}_${i}.pcm`);
					scriptArgs.push(finalPcmFile);
				}
				let options = {
					mode: 'text',
					pythonOptions: ['-u'], // get print results in real-time
					args: scriptArgs,
				};
				
				const pythonScript = 'SyncAudio.py';
				const pyshell = new PythonShell(pythonScript, options);
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
					console.log('Python script finished. Preparing download link.');
					//Absolute path of zip file to check existance
					const zipFileName = `${message.timedate}_sync.zip`;
					const absoluteZipPath = path.join(__dirname, 'public','tmp',message.room,zipFileName);
					// Verification loop to check if the zip file exists and had been released.
					let attempts = 0;
					const maxAttempts = 10;
					const retryDelay = 500; //ms
					const checkFileAndSendLink = () => {
						fs.access(absoluteZipPath, fs.constants.F_OK, (err) => {
							if(!err) {
								// File exists, proceed to send the link
								console.log(`File found on attempt ${attempts + 1}. Sending download link.`);
								const fileUrlPath = `${message.room}/${zipFileName}`;
								const fullDownloadUrl = local_deploy
									? `https://${getLocalIpAddress()}:${PORT}/tmp/${fileUrlPath}`
									: `https://${Server_URL}:${PORT}/tmp/${fileUrlPath}`;
								console.log(`Sending 'DownloadReady' to master. URL: ${fullDownloadUrl}`);
								// --- SEND THE EVENT ---
								io.to(message.master).emit('DownloadReady', {
									timedate: message.timedate, // Used as part of the filename on the client
									downloadLink: fullDownloadUrl, // The key the client expects
								});
								// Clean up the promise tracker
								delete roomProcessingPromises[message.room];
							} else if (attempts < maxAttempts) {
								// File doesn't exist yet, retry after a delay
								attempts++;
								console.log(`File not found, retrying... (Attempt ${attempts}/${maxAttempts})`);
								setTimeout(checkFileAndSendLink, retryDelay);
							} else {
								// Max attempts reached, file never appeared.
								console.error(`Gave up waiting for file: ${absoluteZipPath}. It never appeared.`);
								// --- NOTIFY THE CLIENT OF THE FAILURE ---
								io.to(message.master).emit('customError', {
									message: `Processing failed: The server could not create the download file for ${zipFileName}.`
								});
								// Clean up the promise tracker
								delete roomProcessingPromises[message.room];
							}
						});
					}
					if(!local_deploy) // If clousd deployment, start client download process.
					{
						checkFileAndSendLink();
					}
					else //Local deployment, send a message.
					{
						io.to(message.master).emit('distanceRecord',{
							timedate: message.timedate,
							command: 'SyncFinished',
							devinarray: message.devinarray,
							room: message.room,
							master: message.master
						});
					}
				});
			};

			// Check if the sync process for the room is complete
			if (roomProcessingPromises[message.room]) {
			console.log(`SyncAudio received for ${message.room}, but Detection is still running. Queuing...`);
			
			// Wait for the stored Promise to resolve, then run the next script
			roomProcessingPromises[message.room]
				.then(() => runSyncAudioScript())
				.catch(() => {
					console.error("Detection failed; not running SyncAudio.");
					delete roomProcessingPromises[message.room];
				});
			} else {
				// Detection is not running (or already finished), run immediately
				runSyncAudioScript();
			}
		}
		else if(message.command == 'download')
		{
			// Commands to send download links to master device
			console.log("Received download Command");
			// Retrieve list of devices in the room
			const clientsInRoom = io.sockets.adapter.rooms.get(message.room);
			if (!clientsInRoom) return;
			const deviceList = Array.from(clientsInRoom);
    		const roomDir = path.join(__dirname, `./public/tmp/${message.room}`);
			// Run python script to package audio streams without synchronisation
			const runPackAudioScript = () => {
				var scriptArgs = [];
				scriptArgs.push(message.room)
				scriptArgs.push(path.join(__dirname, 'public', 'tmp', message.room, `${message.timedate}`));
				for (let i = 1; i <= message.devices; i++)
				{
					const finalPcmFile = path.join(__dirname, 'public', 'tmp', message.room, `${message.timedate}_${i}.pcm`);
					scriptArgs.push(finalPcmFile);
				}
				let options = {
					mode: 'text',
					pythonOptions: ['-u'], // get print results in real-time
					args: scriptArgs,
				};
				
				const pythonScript = 'PackAudio.py';
				const pyshell = new PythonShell(pythonScript, options);
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
					console.log('Python script finished. Preparing download link.');
					//Absolute path of zip file to check existance
					const zipFileName = `${message.timedate}.zip`;
					const absoluteZipPath = path.join(__dirname, 'public','tmp',message.room,zipFileName);
					// Verification loop to check if the zip file exists and had been released.
					let attempts = 0;
					const maxAttempts = 10;
					const retryDelay = 500; //ms
					const checkFileAndSendLink = () => {
						fs.access(absoluteZipPath, fs.constants.F_OK, (err) => {
							if(!err) {
								// File exists, proceed to send the link
								console.log(`File found on attempt ${attempts + 1}. Sending download link.`);
								const fileUrlPath = `${message.room}/${zipFileName}`;
								const fullDownloadUrl = local_deploy
									? `https://${getLocalIpAddress()}:${PORT}/tmp/${fileUrlPath}`
									: `https://${Server_URL}:${PORT}/tmp/${fileUrlPath}`;
								console.log(`Sending 'DownloadReady' to master. URL: ${fullDownloadUrl}`);
								// --- SEND THE EVENT ---
								io.to(message.master).emit('DownloadReady', {
									timedate: message.timedate, // Used as part of the filename on the client
									downloadLink: fullDownloadUrl, // The key the client expects
								});
								// Clean up the promise tracker
								delete roomProcessingPromises[message.room];
							} else if (attempts < maxAttempts) {
								// File doesn't exist yet, retry after a delay
								attempts++;
								console.log(`File not found, retrying... (Attempt ${attempts}/${maxAttempts})`);
								setTimeout(checkFileAndSendLink, retryDelay);
							} else {
								// Max attempts reached, file never appeared.
								console.error(`Gave up waiting for file: ${absoluteZipPath}. It never appeared.`);
								// --- NOTIFY THE CLIENT OF THE FAILURE ---
								io.to(message.master).emit('customError', {
									message: `Processing failed: The server could not create the download file for ${zipFileName}.`
								});
								// Clean up the promise tracker
								delete roomProcessingPromises[message.room];
							}
						});
					}
					if(!local_deploy) // If clousd deployment, start client download process.
					{
						checkFileAndSendLink();
					}
					else //Local deployment, send a message.
					{
						io.to(message.master).emit('distanceRecord',{
							timedate: message.timedate,
							command: 'PackFinished',
							devinarray: message.devinarray,
							room: message.room,
							master: message.master
						});
					}
				});
			};
			runPackAudioScript();
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

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '0.0.0.0'; // Fallback
}

function deleteRoomFolder(roomId) {
    const folderPath = path.join(__dirname, 'public', 'tmp', roomId);
    fs.rm(folderPath, { recursive: true, force: true }, (err) => {
        if (err) {
            console.error(`Failed to delete folder ${folderPath}:`, err);
        } else {
            console.log(`Deleted folder for room ${roomId}`);
        }
    });
}

function writeToPcmFile(filepath, data, position) {
    // Check if file exists; if not, create it.
    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, ""); 
    }
    fs.open(filepath, 'r+', (err, fd) => {
        if (err) return console.error("File open error:", err);   
        // Write the audio chunk at the exact byte position
        fs.write(fd, data, 0, data.length, position, (writeErr) => {
            if (writeErr) console.error("Write error:", writeErr);
            fs.close(fd, () => {});
        });
    });
}

server.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
    if (local_deploy) {
        const localIp = getLocalIpAddress();
        console.log('----------------------------------------------------');
        console.log('Server is in LOCAL mode.');
        console.log(`Connect your Android client to: https://${localIp}:${PORT}`);
        console.log('----------------------------------------------------');
    } else {
		const localIp = getLocalIpAddress();
        console.log('----------------------------------------------------');
        console.log('Server is in REMOTE mode.');
        console.log(`Connect your Android client to: https://${Server_URL}:${PORT} or https://${localIp}:${PORT}`);
        console.log('----------------------------------------------------');
    }
});