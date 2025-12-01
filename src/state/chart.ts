import { ChartWrapper } from "../lib/chart-wrapper";
import * as config from "../config.json";
import { RuleEngine, Trigger } from "../lib/rule-engine";
import { RuleId } from "./rules-ids";
import { sound } from "../lib/sound";
import { hasSensor } from "../lib/emulate-sensor";

const pushAndSlide = (newElement: any, arr: any[], maxLength: number) => {
  arr.push(newElement);
  if (arr.length > maxLength) {
    arr.shift();
  }
};

const isDelayCalibrated = (delay: any) =>
  typeof delay === "number" && delay > 0;

const isPowerCalibrated = (power: number) => power > 0;

export class ChartState {
  protected chartWrapper: ChartWrapper;
  slidedAccArray: number[] = [];
  heavySpectrum: number[] = [];
  slidedSpectrumArray: number[][] = [];
  slidedSoundArray: number[] = [];
  slidedPowerArray: number[] = [];
  freqDataArray!: Uint8Array;

  maxChart = 100;
  accMult: number;
  spectMult: number;
  soundMult: number;
  powerMult: number;

  freqWeights: number[] = [];

  @Trigger([RuleId.DelayCalibrated], [], isDelayCalibrated)
  soundDelay!: number | undefined;

  @Trigger([RuleId.PowerCalibrated], [], isPowerCalibrated)
  maxPower!: number;

  constructor() {
    this.spectMult = config.spectMult;
    this.soundMult = config.soundMult;
    this.powerMult = config.powerMult;
    this.accMult = config.accMult;

    this.chartWrapper = new ChartWrapper(
      $<HTMLCanvasElement>("#charts")!.getContext("2d"),
      {
        pwr: {
          backgroundColor: "#66ff66",
          borderColor: "#66ff66",
        },
        spect: {
          backgroundColor: "#cccccc",
          borderColor: "#cccccc",
        },
        snd: {
          backgroundColor: "#993333",
          borderColor: "#993333",
        },
        acc: {
          backgroundColor: "#0033cc",
          borderColor: "#0033cc",
        },
      },
      {
        pointStyle: false,
        scales: {
          x: {
            type: "linear",
            title: { text: "Time", display: true },
            min: 0,
            max: config.maxTime,
          },
          y: {
            type: "linear",
            title: { text: "Value", display: true },
            min: 0, //-this.maxChart,
            max: this.maxChart,
          },
        },
      }
    );
  }

  isDelayCalibrated() {
    return isDelayCalibrated(this.soundDelay);
  }

  isPowerCalibrated() {
    return isPowerCalibrated(this.maxPower);
  }

  // will be overridden
  protected shouldListen() {
    return true;
  }

  protected getPower(newSoundValue: number, newAccValue: number) {
    const len = this.slidedSoundArray.length;
    const d = this.soundDelay ?? 0;
    if (len - 1 - d <= 0) {
      return 0;
    }
    if (hasSensor()) {
      return newSoundValue * this.slidedAccArray[len - 1 - d];
    }

    return newAccValue * this.slidedSoundArray[len - 1 - d];
  }

  protected async _listener(e: DeviceMotionEvent) {
    if (!this.shouldListen()) {
      return;
    }

    // processing acceleration
    const acc = e.acceleration;
    if (!acc) {
      return;
    }
    const heavyAcc = sound.heavyValue("acc", config.accMass, [
      Math.sqrt(acc.x! * acc.x! + acc.y! * acc.y! + acc.z! * acc.z!),
    ])[0];

    // processing sound
    if (!sound.analyser) {
      const dim = await sound.createAnalyser(config.fftSize, 0);
      this.freqDataArray = new Uint8Array(dim);
    }

    sound.analyser.getByteFrequencyData(this.freqDataArray);
    const momentarySpectrum = sound.groupAvg(
      this.freqDataArray,
      config.freqGroupSize,
      true
    );

    // temp.smoothed spectrum array
    this.heavySpectrum = sound.heavyValue(
      "spectrum",
      config.soundMass,
      momentarySpectrum
    );

    // weighted spectrum intensity
    const heavySound =
      this.heavySpectrum.reduce((s, v) => s + v) /
      (this.freqWeights.length
        ? sound.distance(
            sound.normalizeArray(this.heavySpectrum),
            this.freqWeights
          )
        : 1);

    // processing final power

    const power = this.getPower(heavySound, heavyAcc);
    const heavyPower = sound.heavyValue("power", config.powerMass, [power])[0];

    pushAndSlide(heavyAcc, this.slidedAccArray, config.maxTime);
    pushAndSlide(this.heavySpectrum, this.slidedSpectrumArray, config.maxTime);
    pushAndSlide(heavySound, this.slidedSoundArray, config.maxTime);
    pushAndSlide(heavyPower, this.slidedPowerArray, config.maxTime);

    RuleEngine.get().trigger([RuleId.Listening]);
  }

  updateChart() {
    const opts = {
      pwr: sound.toChartData(this.slidedPowerArray, 0, 1, 0, this.powerMult),
      snd: sound.toChartData(this.slidedSoundArray, 0, 1, 0, this.soundMult),
      acc: sound.toChartData(
        this.slidedAccArray,
        hasSensor() ? this.soundDelay ?? 0 : -(this.soundDelay ?? 0),
        1,
        0,
        this.accMult
      ),
    };
    if (config.enableMonitorButton) {
      (opts as any).spect = sound.toChartData(
        this.heavySpectrum,
        0,
        config.freqGroupSize,
        0,
        this.spectMult
      );
    }
    this.chartWrapper.update(opts);
  }
}
