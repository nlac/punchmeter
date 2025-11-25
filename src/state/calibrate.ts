import * as config from "../config.json";
import { sound } from "../lib/sound";
import { setupButtons } from "../lib/ui";
import { RuleEngine } from "../lib/rule-engine";
import { RuleId } from "./rules-ids";
import { ChartState } from "./chart";
import { hasSensor } from "../lib/emulate-sensor";

export class CalibrateState extends ChartState {
  listener!: ((e: DeviceMotionEvent) => Promise<void>) | undefined;

  constructor() {
    super();
    setupButtons([
      {
        title: "Calibrate",
        onClick: () => {
          RuleEngine.get().trigger([RuleId.CalibrationTriggered]);
        },
      },
    ]);
  }

  resetWindow() {
    this.slidedAccArray = [];
    this.slidedSoundArray = [];
    this.slidedPowerArray = [];
    this.updateChart();
  }

  destroy() {
    if (this.listener !== undefined) {
      window.removeEventListener("devicemotion", this.listener);
      this.listener = undefined;
    }
  }

  async startCalibrateDelay() {
    this.soundDelay = undefined;

    setupButtons([
      {
        title: "Calibrating sound delay...",
        disabled: true,
      },
    ]);
    await sound.speak("Hit one single punch after the beep");
    await sound.beep();
    this.resetWindow();
    if (!this.listener) {
      this.listener = this._listener.bind(this);
      window.addEventListener("devicemotion", this.listener);
    }
    RuleEngine.get().trigger([RuleId.DelayCalibrationStarted]);
  }

  async startCalibratePower() {
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
    RuleEngine.get().trigger([RuleId.PowerCalibrationStarted]);
  }

  hasFullWindow() {
    return this.slidedAccArray.length >= config.maxTime;
  }

  calculateDelay() {
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
    const delay = soundMaxIdx - accMaxIdx;
    if (delay <= 0 && hasSensor()) {
      console.info(`soundDelay in invalid - restart calibrating`);
      this.soundDelay = undefined;
      this.resetWindow();
      return;
    }

    this.soundDelay = Math.abs(delay); // supposed to be positive
    this.resetWindow();
    console.info(`soundDelay: ${this.soundDelay}`);
  }

  calculatePower() {
    if (!this.hasFullWindow()) {
      return;
    }
    // triggering PowerSet
    this.maxPower = Math.max(...this.slidedPowerArray);

    const maxSound = Math.max(...this.slidedSoundArray);
    const maxAcc = Math.max(...this.slidedAccArray);

    const gap = 0.75;
    this.accMult = (gap * this.maxChart) / maxAcc;
    this.soundMult = (gap * this.maxChart) / maxSound;
    this.powerMult = (gap * this.maxChart) / this.maxPower;

    this.resetWindow();
    console.info(`maxPower: ${this.maxPower}`);
  }
}
