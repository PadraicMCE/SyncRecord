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

	//Poll devices to determine which ones are connected
	//pollDevices();

	socket.on('uploadAudio', function(message) {
		var writer = fs.createWriteStream(path.resolve(__dirname,'./tmp/'+message.numOfDevices+'/'+message.name),{encoding:'binary'});
		writer.write(message.data);
		writer.end();
		console.log('Finished receiving audio file');
	})


	
    socket.on('userConnected', data =>
    {
        console.log('User '+data+' connected');
        socket.emit('userConnected',data);
        socket.broadcast.emit('userConnected',data);
        if(data == 1)
        {
            device1 = true;
        }
        if(data == 2)
        {
            device2 = true;
        }
        if(data == 3)
        {
            device3 = true;
        }
        if(data == 4)
        {
            device4 = true;
		}
		if(data == "M")
		{
			emitterDevice = true;
		}
	});

    //Sending audio data between devices
    socket.on('MediaMessage', (deviceNo,date,media) =>
    {
        socket.broadcast.emit('MediaMessage',deviceNo,date,media);
        console.log("Broadcast new media");
    });

    //Tell devices to start recording
    socket.on('recordStart', function(message)
    {
		socket.broadcast.emit('recordStart',{
			data: message.data
		});
        //socket.broadcast.emit('recordStart',data);
        //console.log("Audio");
	});

	socket.on('recordingStarted', function(message)
	{
		if(message.device == '1')
		{ 
			device1Recording = true;
			console.log('Device 1 started recording');
			if(device2Recording)
			{
				console.log('emitting Distance start command');
				socket.broadcast.emit('Distance',{
					numDevices: '2',
					device: '1',
					command: 'start'
				});
			}
		}
		if(message.device == '2')
		{ 
			device2Recording = true;
			console.log('Device 2 started recording');
			if(device1Recording)
			{
				console.log('emitting Distance start command');
				socket.broadcast.emit('Distance',{
					numDevices: '2',
					device: '1',
					command: 'start'
				});
			}
		}
		/*
		socket.broadcast.emit('recordingStarted',{
			device: message.device,
			recording: message.recording
		});
		*/
	});
	
	socket.on('recordStop', function(message)
	{
		socket.broadcast.emit('recordStop',{
			data: message.data
		});
	});

    //Device number determined by password entered (Master / Slave)
    socket.on('password', data =>
    {
        socket.emit('device', data);
    });

    //Runs when a client disconnects
    socket.on('disconnect', () => {
        console.log('A client has disconnected');
		//pollDevices();
	});
	
	socket.on('Distance', function(message)
    {
		console.log('Distance command received, device: '+message.device);
		if(message.device == '1')
		{
			if(message.command == 'start')
			{
				console.log('Sending distance command, device 1');
				socket.broadcast.emit('Distance',{
					numDevices: '2',
					device: '1',
					command: 'start'
				});
			}
			if(message.command == 'finished')
			{
				setTimeout(function()
				{
					console.log('Sending distance command, device 2');
					socket.broadcast.emit('Distance',{
						numDevices: '2',
						device: '2',
						command: 'start'
					});
				},100);
			}
		}
		if(message.device == '2')
		{
			
			if(message.command == 'finished')
			{
				setTimeout(function()
				{
					socket.broadcast.emit('recordStop',{
						numDevices: '2',
						device: '2',
						command: 'stop'
					});
				},200);
			}
		}
	});

	socket.on('recordingStopped', function(message)
	{
		if(message.device == '1')
		{
			device1Recording = false;
			console.log('device 1 finished recording');
		} 
		if(message.device == '2')
		{
			device2Recording = false;
			console.log('device 2 finished recording');
		}
	});

	socket.on('NumberOfDevices', data =>
	{
		io.emit('NumberOfDevices',data);
		//Debugging
		console.log('Number of devices command relayed: '+data);
		numberOfDevices = data;
	});

	socket.on('writeToTextFile',function(message)
	{
		fs.appendFile('\nBatteryTest.txt','Time:'+message.time+'  Percentage: '+message.percentage, function(err)
		{
			if(err) throw err;
			console.log('File appended, time: '+message.time+'  precentage: '+message.percentage);
		});
	});

});

function emitting(msg,data1)
{
	io.emit(msg,{
		data: data1
	});
}


server.listen(PORT);
console.log(`Server running on ${PORT}`);
//Notification on server.
//server.listen(PORT, HOST);
//console.log(`Server running on https://${HOST}:${PORT}`);