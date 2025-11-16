// Service around AudioContext
class Sound {
  audioCtx: any;
  source: any;
  stream: any;
  analyser: any;
  mediaStream: any;
  lastArrays: Record<string, any>;
  heavyValueArrays: Record<string, any>;
  lastSpokenText: string = "";

  constructor() {
    this.lastArrays = {};
    this.heavyValueArrays = {};
  }

  getAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext(/*{ 
        sampleRate: 16000 
      }*/);
    }
    return this.audioCtx;
  }

  async beep(volume?: number, duration?: number, frequency?: number) {
    this.getAudioContext();

    var oscillator = this.audioCtx.createOscillator();
    var gainNode = this.audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    gainNode.gain.value = volume ?? 0.5; //0..1
    oscillator.frequency.value = frequency ?? 2000;
    oscillator.type = "sine";

    oscillator.start(this.audioCtx.currentTime);
    const ms = duration ?? 500;
    oscillator.stop(this.audioCtx.currentTime + ms / 1000);

    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async speak(text: string, volume0_100?: number) {
    console.info("speak: " + text);

    volume0_100 = volume0_100 ?? 50;

    if (volume0_100 && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking) {
        if (this.lastSpokenText.match(/minutes/i)) {
          return;
        }
        window.speechSynthesis.cancel();
      }
      this.lastSpokenText = text;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.pitch = 1;
      utterance.rate = 1.1;
      utterance.volume = 0.01 * volume0_100;

      return new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
  }

  async createSource() {
    if (this.source) {
      return this.source;
    }

    this.getAudioContext();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        //sampleRate: 16000,// this.audioCtx.sampleRate,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    return this.source;
  }

  async createAnalyser(fftSize, smoothing) {
    await this.createSource();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = fftSize ?? 512;
    this.analyser.smoothingTimeConstant = smoothing ?? 0;
    this.source.connect(this.analyser);
    //return new Uint8Array(this.analyser.frequencyBinCount);
    //return new Float32Array(this.analyser.frequencyBinCount);
    return this.analyser.frequencyBinCount;
  }

  derivative(id, arr) {
    if (!this.lastArrays[id]) {
      this.lastArrays[id] = Array.from(arr);
    }
    const lastArray = this.lastArrays[id];
    const result = arr.map((v, i) => v - lastArray[i]);
    this.lastArrays[id] = Array.from(lastArray);
    return result;
  }

  heavyValue(id, mass, dataArray) {
    if (mass === 0) {
      return Array.from(dataArray);
    }
    if (!this.heavyValueArrays[id]) {
      this.heavyValueArrays[id] = {
        arr: Array.from(dataArray),
        mass,
      };
    }
    const h = this.heavyValueArrays[id];
    for (let i = 0; i < h.arr.length; i++) {
      h.arr[i] = h.arr[i] * h.mass + dataArray[i] * (1.0 - h.mass);
    }
    return h.arr;
  }

  avg(dataArray, r) {
    const copy = Array.from(dataArray);
    for (let i = r; i < dataArray.length - 1 - r; i++) {
      let av = 0;
      for (let j = -r; j < r; j++) {
        av += dataArray(i + j);
      }
      copy[i] = av / (2 * r + 1);
    }
    return copy;
  }

  groupAvg(dataArray, group, takeAbs) {
    if (group <= 1) {
      return Array.from(dataArray);
    }
    //let start = 0;
    return Array.from({ length: dataArray.length / group }, (_, i) => {
      const start = i * group;
      return (
        dataArray
          .slice(start, start + group)
          .reduce((sum, v) => sum + (takeAbs ? Math.abs(v) : v), 0) / group
      );
    });
  }

  toChartData(dataArray, offsetX, multX, offsetY, multY) {
    offsetX = offsetX ?? 0;
    offsetY = offsetY ?? 0;
    multX = multX ?? 1;
    multY = multY ?? 1;
    return dataArray.map((y, x) => ({
      x: multX * (x + offsetX),
      y: multY * (y + offsetY),
    }));
  }

  async destroy() {
    // Disconnect audio nodes
    if (this.source) {
      this.source.disconnect();
      this.source = undefined;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = undefined;
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.mediaStream = undefined;
    }

    // Close audio context
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      await this.audioCtx.close();
      this.audioCtx = undefined;
    }
  }
}

export const sound = new Sound();
