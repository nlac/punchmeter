import { ChartWrapper } from "../lib/chart-wrapper";
import * as config from "../config.json";
import { RuleEngine, Trigger } from "../lib/rule-engine";
import { RuleId } from "./rules-ids";
import { sound } from "../lib/sound";

const pushAndSlide = (newElement: any[], arr: any[], maxLength: number) => {
  arr.push(newElement);
  if (arr.length > maxLength) {
    arr.shift();
  }
};

const getResult = (
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

const isDelayCalibrated = (delay: any) => typeof delay === "number";
const isPowerCalibrated = (power: number) => power > 0;

export class ChartState {
  protected chartWrapper: ChartWrapper;
  slidedAccArray: number[] = [];
  slidedSoundArray: number[] = [];
  slidedResultArray: number[] = [];
  freqDataArray!: Uint8Array;

  maxChart = 100;
  accMult = 1.0;
  soundMult = 0.1;
  resultMult = 0.01;

  @Trigger([RuleId.DelayCalibrated], [], isDelayCalibrated)
  soundDelay!: number | undefined;

  @Trigger([RuleId.PowerCalibrated], [], isPowerCalibrated)
  maxPower!: number;

  constructor() {
    this.chartWrapper = new ChartWrapper(
      $<HTMLCanvasElement>("#charts")!.getContext("2d"),
      {
        result: {
          borderColor: "#000000",
        },
        sound: {
          borderColor: "#ff9999",
        },
        acc: {
          borderColor: "#99ff99",
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
            min: -this.maxChart,
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

    // calculating result from the two type of signals
    // since sound is processed with a delay compared to the acceleration, it should be corrected:
    // -> the corresponding acceleration value is in the past
    const len = this.slidedSoundArray.length;
    const result =
      len >= config.maxDelaySearchArea + (this.soundDelay ?? 0)
        ? getResult(
            this.slidedAccArray,
            len - config.maxDelaySearchArea - (this.soundDelay ?? 0),
            len - (this.soundDelay ?? 0),
            this.slidedSoundArray,
            len - config.maxDelaySearchArea,
            len
          )
        : 0;

    const heavyResult = sound.heavyValue("result", config.resultMass, [
      result,
    ])[0];

    // display
    pushAndSlide(heavyAcc, this.slidedAccArray, config.maxTime);
    pushAndSlide(heavySoundDerivative, this.slidedSoundArray, config.maxTime);
    pushAndSlide(heavyResult, this.slidedResultArray, config.maxTime);

    RuleEngine.get().trigger([RuleId.Listening]);
  }

  updateChart() {
    this.chartWrapper.update({
      result: sound.toChartData(
        this.slidedResultArray,
        0,
        1,
        0,
        this.resultMult
      ),
      sound: sound.toChartData(this.slidedSoundArray, 0, 1, 0, this.soundMult),
      acc: sound.toChartData(
        this.slidedAccArray,
        this.soundDelay ?? 0,
        1,
        0,
        this.accMult
      ),
    });
  }
}
