import * as config from "../config.json";
import { sound } from "../lib/sound";
import { setupButtons } from "./buttons";
import { RuleEngine } from "../lib/rule-engine";
import { RuleId } from "./rules-ids";
import { ChartState } from "./chart";

export class CalibrateState extends ChartState {
  listener!: ((e: DeviceMotionEvent) => Promise<void>) | undefined;

  constructor() {
    super();
    setupButtons([
      {
        title: "Calibrate",
        onClick: () => {
          RuleEngine.get().trigger([RuleId.Calibrate]);
        },
      },
    ]);
  }

  resetWindow() {
    this.slidedAccArray = [];
    this.slidedSoundArray = [];
    this.slidedResultArray = [];
    this.updateChart();
  }

  destroy() {
    if (this.listener !== undefined) {
      window.removeEventListener("devicemotion", this.listener);
      this.listener = undefined;
    }
  }

  async calibrateDelay() {
    this.soundDelay = 0;
    setupButtons([
      {
        title: "Calibrating signal delays...",
        disabled: true,
      },
    ]);
    await sound.speak("Hit a single power punch after the beep");
    await sound.beep();
    this.resetWindow();
    if (!this.listener) {
      this.listener = this._listener.bind(this);
      window.addEventListener("devicemotion", this.listener);
    }
  }

  async calibratePower() {
    this.maxPower = 0;
    setupButtons([
      {
        title: "Calibrating punch power...",
        disabled: true,
      },
    ]);
    await sound.speak("Hit 3 power punch after the beep");
    await sound.beep();
    this.resetWindow();
  }

  isDelayCalibrated() {
    return this.soundDelay > 0;
  }

  isPowerCalibrated() {
    return this.maxPower > 0;
  }

  hasFullWindow() {
    return this.slidedAccArray.length >= config.maxTime;
  }

  getDelay() {
    if (!this.hasFullWindow()) {
      return;
    }
    let soundMax = 0,
      accMax = 0,
      soundMaxIdx = 0,
      accMaxIdx = 0;
    for (let i = 0; i < this.slidedSoundArray.length; i++) {
      if (this.slidedSoundArray[i] > soundMax) {
        soundMax = this.slidedSoundArray[i];
        soundMaxIdx = i;
      }
      if (this.slidedAccArray[i] > accMax) {
        accMax = this.slidedAccArray[i];
        accMaxIdx = i;
      }
    }
    // triggering DelaySet
    this.soundDelay = soundMaxIdx - accMaxIdx; // supposed to be positive

    this.resetWindow();
    console.debug(`soundDelay: ${this.soundDelay}`);
  }

  getPower() {
    if (!this.hasFullWindow()) {
      return;
    }
    // triggering PowerSet
    this.maxPower = Math.max(...this.slidedResultArray);

    this.resetWindow();
    console.debug(`maxPower: ${this.maxPower}`);
  }
}
