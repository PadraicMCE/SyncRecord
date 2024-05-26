class recordProcessor extends AudioWorkletProcessor
{
  static get parameterDescriptors() {
    return [{
      name: 'isRecording',
      defaultValue: 0
    }];
  }
  constructor()
    {
      super();
      this.port.onmessage = (e) => 
			{
        //Count numer of samples sent
        this.sampleCounter = 0;
        // Continuously send data back to the min thread.
				if (e.data.eventType === 'Start') 
				{
          console.log('WorkletAudio received start command');
					this.iterations == 0;
          this.shouldRecord = 1;
          this.port.postMessage({
            eventType: 'started',
          });
				}
        if (e.data.eventType === 'Stop') 
				{
          console.log('WorkletAudio received stop command');
					this.shouldRecord = 0;
          this.port.postMessage({
            eventType: 'stopped',
            timedate: e.data.timedate
          });
				}
      };
    }

    process(inputs,ouputs,parameters)
    {
      const input = inputs[0];
      const inputChannel = input[0];
        this.port.postMessage({
          eventType: 'data',
          totalSamples: this.sampleCounter,
          samples: inputChannel.length,
          audioBuffer: inputChannel
        });
      //console.log(inputChannel)
      this.sampleCounter += inputChannel.length;
      return true;
    }

}
registerProcessor('recorder-worklet', recordProcessor);