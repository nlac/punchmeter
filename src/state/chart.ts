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

const getPower = (
  arr1: number[],
  from1: number,
  to1: number,
  arr2: number[],
  from2: number,
  to2: number
) => {
  const max1 = Math.max(...arr1.slice(from1, to1));
  const max2 = Math.max(...arr2.slice(from2, to2));
  return max1 * max2;
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
  accMult = 1.0;
  soundMult = 0.1;
  powerMult = 0.01;

  @Trigger([RuleId.DelayCalibrated], [], isDelayCalibrated)
  soundDelay!: number | undefined;

  @Trigger([RuleId.PowerCalibrated], [], isPowerCalibrated)
  maxPower!: number;

  constructor() {
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

    // calculating power from the two type of signals
    // since sound is processed with a delay compared to the acceleration, it should be corrected:
    // -> the corresponding acceleration value is in the past
    const len = this.slidedSoundArray.length;
    const r = config.maxDelaySearchArea;
    const d = this.soundDelay ?? 0;
    const power =
      len >= r + d
        ? getPower(
            hasSensor() ? this.slidedAccArray : this.slidedSoundArray,
            len - r - d,
            len - d,
            hasSensor() ? this.slidedSoundArray : this.slidedAccArray,
            len - r,
            len
          )
        : 0;

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
