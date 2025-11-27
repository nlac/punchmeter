import { ChartWrapper } from "../lib/chart-wrapper";
import * as config from "../config.json";
import { RuleEngine, Trigger } from "../lib/rule-engine";
import { RuleId } from "./rules-ids";
import { sound } from "../lib/sound";
import { hasSensor } from "../lib/emulate-sensor";

const pushAndSlide = (newElement: any[], arr: any[], maxLength: number) => {
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
  slidedSoundArray: number[] = [];
  slidedPowerArray: number[] = [];
  freqDataArray!: Uint8Array;

  maxChart = 100;
  accMult: number;
  soundMult: number;
  powerMult: number;

  @Trigger([RuleId.DelayCalibrated], [], isDelayCalibrated)
  soundDelay!: number | undefined;

  @Trigger([RuleId.PowerCalibrated], [], isPowerCalibrated)
  maxPower!: number;

  constructor() {
    this.soundMult = config.soundMult;
    this.powerMult = config.powerMult;
    this.accMult = config.accMult;

    this.chartWrapper = new ChartWrapper(
      $<HTMLCanvasElement>("#charts")!.getContext("2d"),
      {
        power: {
          backgroundColor: "#66ff66",
          borderColor: "#66ff66",
        },
        sound: {
          backgroundColor: "#993333",
          borderColor: "#993333",
        },
        acc: {
          backgroundColor: "#3333bb",
          borderColor: "#3333bb",
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

    const avgSound =
      this.freqDataArray.reduce((sum, v) => sum + v, 0) /
      this.freqDataArray.length;

    const soundDerivative = sound.derivative("sound-der", [avgSound])[0];

    const heavySoundDerivative = sound.heavyValue("freq", config.freqMass, [
      soundDerivative,
    ])[0];

    const power = this.getPower(heavySoundDerivative, heavyAcc);

    const heavyPower = sound.heavyValue("power", config.powerMass, [power])[0];

    // display
    pushAndSlide(heavyAcc, this.slidedAccArray, config.maxTime);
    pushAndSlide(heavySoundDerivative, this.slidedSoundArray, config.maxTime);
    pushAndSlide(heavyPower, this.slidedPowerArray, config.maxTime);

    RuleEngine.get().trigger([RuleId.Listening]);
  }

  updateChart() {
    this.chartWrapper.update({
      power: sound.toChartData(this.slidedPowerArray, 0, 1, 0, this.powerMult),
      sound: sound.toChartData(this.slidedSoundArray, 0, 1, 0, this.soundMult),
      acc: sound.toChartData(
        this.slidedAccArray,
        hasSensor() ? this.soundDelay ?? 0 : -(this.soundDelay ?? 0),
        1,
        0,
        this.accMult
      ),
    });
  }
}
