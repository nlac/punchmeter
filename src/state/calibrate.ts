import * as config from "../config.json";
import { sound } from "../lib/sound";
import { debug, setupButtons } from "../lib/ui";
import { RuleEngine } from "../lib/rule-engine";
import { RuleId } from "./rules-ids";
import { ChartState } from "./chart";
import { hasSensor } from "../lib/emulate-sensor";

export class CalibrateState extends ChartState {
  listener!: ((e: DeviceMotionEvent) => Promise<void>) | undefined;
  isMonitoring = false;

  constructor() {
    super();
    this.reset();
  }

  resetWindow() {
    this.slidedAccArray = [];
    this.slidedSpectrumArray = [];
    this.slidedSoundArray = [];
    this.slidedPowerArray = [];
    this.updateChart();
  }

  reset() {
    if (this.listener !== undefined) {
      window.removeEventListener("devicemotion", this.listener);
      this.listener = undefined;
    }
    this.resetWindow();
    this.isMonitoring = false;
    this.soundDelay = undefined;
    this.freqWeights = [];

    const buttons = [
      {
        title: "Calibrate/Start",
        onClick: () => {
          RuleEngine.get().trigger([RuleId.CalibrationTriggered]);
        },
      },
    ];
    if (config.enableMonitorButton) {
      buttons.push({
        title: "Monitor",
        onClick: () => {
          RuleEngine.get().trigger([RuleId.MonitorTriggered]);
        },
      });
    }
    setupButtons(buttons);
    debug("", false);
  }

  async startMonitor() {
    this.soundDelay = undefined;
    this.isMonitoring = true;
    const me = this;
    setupButtons([
      {
        title: "Stop monitoring",
        onClick: () => {
          me.reset();
        },
      },
    ]);
    this.resetWindow();
    if (!this.listener) {
      this.listener = this._listener.bind(this);
      window.addEventListener("devicemotion", this.listener);
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
    await sound.speak(
      "Hit one single punch after the beep. 5, 4, 3, 2, 1 - ready!"
    );
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
    await sound.speak("Hit 3 power punch after the beep. 3, 2, 1 - ready!");
    await sound.beep();
    this.resetWindow();
    RuleEngine.get().trigger([RuleId.PowerCalibrationStarted]);
  }

  hasFullWindow() {
    return this.slidedAccArray.length >= config.maxTime;
  }

  async calculateDelay() {
    if (!this.hasFullWindow()) {
      return;
    }
    let soundMax = 0,
      accMax = 0,
      soundMaxIdx = 0,
      accMaxIdx = 0;
    let avgSound = 0,
      avgAcc = 0;

    let spectMax = 0;
    let spectMaxIdx = 0;

    for (let i = 0; i < this.slidedSoundArray.length; i++) {
      avgSound += this.slidedSoundArray[i];
      avgAcc += this.slidedAccArray[i];

      const spect = this.slidedSpectrumArray[i].reduce((sum, v) => sum + v, 0);
      if (spect > spectMax) {
        spectMax = spect;
        spectMaxIdx = i;
      }

      if (this.slidedSoundArray[i] > soundMax) {
        soundMax = this.slidedSoundArray[i];
        soundMaxIdx = i;
      }
      if (this.slidedAccArray[i] > accMax) {
        accMax = this.slidedAccArray[i];
        accMaxIdx = i;
      }
    }

    // calculating spectrum weights
    this.freqWeights = sound.normalizeArray(
      this.slidedSpectrumArray[soundMaxIdx]
    );

    avgSound /= this.slidedSoundArray.length;
    avgAcc /= this.slidedSoundArray.length;

    debug(`peak at ${((soundMax * accMax) / (avgSound * avgAcc)).toFixed(2)}`);

    // TODO put it into config
    if ((soundMax * accMax) / (avgSound * avgAcc) < 120) {
      debug(`peak is too low`);
      this.soundDelay = undefined;
      await sound.speak(`Again`);
      this.resetWindow();
      return;
    }

    const delay = soundMaxIdx - accMaxIdx;
    if (delay <= 0 && hasSensor()) {
      debug(`invalid sounDelay`);
      this.soundDelay = undefined;
      await sound.speak(`Again`);
      this.resetWindow();
      return;
    }

    // triggering DelaySet
    this.soundDelay = Math.abs(delay); // supposed to be positive
    this.resetWindow();
    debug(`soundDelay: ${this.soundDelay}`);
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
    console.info(`maxPower: ${this.maxPower.toFixed(2)}`);
    debug(`calcPower: maxPower=${this.maxPower.toFixed(2)}`);
  }
}
