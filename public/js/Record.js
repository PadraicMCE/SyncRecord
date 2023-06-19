var recording = false;

class RecorderWorkletProcessor extends AudioWorkletProcessor
{
  static get parameterDescriptors()
  {
    return [{
      name: 'isRecording',
      defaultValue: 0,
    }];
  }

  constructor()
  {
    super();
    this._bufferSize = 2048;
    this._buffer = new Float32Array(this._bufferSize);
    this._initBuffer();
    this.port.onmessage = (event) => 
    {
      if (event.data.eventType == 'start')
      {
        console.log('startRecording command received at AudioWorklet');
        recording = true;
        this.port.postMessage({
          eventType: 'started'
        });
      }
      if (event.data.eventType == 'stop')
      {
        console.log('stopRecording command at AudioWorklet');
        recording = false;
        this.port.postMessage({
          eventType: 'stopped'
        });
      }
    };
  }
  /*
  _initBuffer()
  {
    this._bytesWritten = 0;
  }

  _isBufferEmpty()
  {
    return this._bytesWritten === 0;
  }

  _isBufferFull()
  {
    return this._bytesWritten === this._bufferSize;
  }

  _appendToBuffer(value)
  {
    if (this._isBufferFull())
    {
      this._flush();
    }
    this._buffer[this._bytesWritten] = value;
    this._bytesWritten += 1;
  }

  _flush() {
    let buffer = this._buffer;
    if (this._bytesWritten < this._bufferSize) {
      buffer = buffer.slice(0, this._bytesWritten);
    }
    console.log(buffer);
    this.port.postMessage({
      eventType: 'data',
      audioBuffer: buffer
    });

    this._initBuffer();
  }

  _recordingStopped() {
    
    this.port.postMessage({
      eventType: 'stopped'
    });
    
  }*/

  process(inputs, outputs, parameters) 
  {
    const input = inputs[0];
    const inputChannel = input[0];
    if(recording)
    {
      this.port.postMessage({
        eventType: 'data',
        //audioBuffer: buffer
        audioBuffer: inputChannel
      });
    }

    /*
    const isRecordingValues = parameters.isRecording;

    const input = inputs[0];
    const inputDataType = input[0].constructor.name;
    */
    /*
    if (inputDataType === 'Float32Array') {
      // The audio data is 32-bit floating point
      console.log('Data is Float32');
    } else if (inputDataType === 'Int16Array') {
      // The audio data is 16-bit integer
      console.log('Data is Int16');
    } else {
      // The data format is not recognized
      console.log('Data is not recognised');
    }*/
    /*
    for (
      let dataIndex = 0;
      dataIndex < isRecordingValues.length;
      dataIndex++
    ) {
      const shouldRecord = isRecordingValues[dataIndex] === 1;
      if (!shouldRecord && !this._isBufferEmpty()) {
        this._flush();
        this._recordingStopped();
      }

      if (shouldRecord) {
        this._appendToBuffer(input[0][dataIndex]);
        //console.log(inputs[0][0][0]);
      }
    }*/
    //console.log(parameters.isRecording);
    return true;
  }

}
registerProcessor('recorder-worklet', RecorderWorkletProcessor);