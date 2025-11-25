import { RuleEngine } from "../lib/rule-engine";
import { sound } from "../lib/sound";
import { updateCard, DisplayAttrs, setupButtons } from "../lib/ui";
import { CalibrateState } from "./calibrate";
import { RuleId } from "./rules-ids";

export enum TrainStatus {
  Stopped = "stopped",
  Paused = "paused",
  Started = "started",
}

type Punch = {
  relStrength: number;
  time: number;
};

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

export class TrainState extends CalibrateState {
  trainStatus: TrainStatus;
  enableCharts = false;

  //config:
  noiseLimit = 0.1;
  weakLimit = 0.25;

  punches: Punch[] = [];
  startTime = 0;
  elapsedTime = 0;

  constructor() {
    super();
    this.enableCharts = true;
    this.trainStatus = TrainStatus.Stopped;
  }

  protected shouldListen() {
    return (
      this.enableCharts &&
      (!this.isPowerCalibrated() || this.trainStatus === TrainStatus.Started)
    );
  }

  startButton() {
    return {
      title: "Start",
      onClick: () => {
        RuleEngine.get().trigger([RuleId.TrainStart]);
      },
    };
  }

  pauseButton() {
    return {
      title: "Pause",
      onClick: () => {
        RuleEngine.get().trigger([RuleId.TrainPause]);
      },
    };
  }

  continueButton() {
    return {
      title: "Continue",
      onClick: () => {
        RuleEngine.get().trigger([RuleId.TrainContinue]);
      },
    };
  }

  finishButton(disabled: boolean) {
    return {
      title: "Finish",
      disabled,
      onClick: () => {
        RuleEngine.get().trigger([RuleId.TrainFinish]);
      },
    };
  }

  finishTraining(first: boolean) {
    setupButtons([this.startButton(), this.finishButton(true)]);
    this.trainStatus = TrainStatus.Stopped;
    this.enableCharts = false;
    sound.speak(
      first
        ? "Whenever you're ready - push Start and keep punching!"
        : "Nice job! Take a rest."
    );
  }

  async startTraining() {
    setupButtons([this.pauseButton(), this.finishButton(false)]);

    // reset
    this.resetWindow();
    this.startTime = Date.now();
    this.punches = [];
    this.elapsedTime = 0;
    updateCard(DisplayAttrs.AveragePower, "0.0");
    updateCard(DisplayAttrs.StrongPercent, "0.0");
    updateCard(DisplayAttrs.Punches, "0");
    updateCard(DisplayAttrs.StrongPunches, "0");
    updateCard(DisplayAttrs.WeakPunches, "0");

    this.enableCharts = true;
    this.trainStatus = TrainStatus.Started;

    sound.speak("Go ahead!");
  }

  pauseTraining() {
    setupButtons([this.continueButton(), this.finishButton(false)]);

    // stop listening to event callback
    this.enableCharts = false;
    // inc. elapsde time
    this.elapsedTime += Date.now() - this.startTime;
    this.trainStatus = TrainStatus.Paused;

    sound.speak("Waiting for continue.");
  }

  async continueTraining() {
    setupButtons([this.pauseButton(), this.finishButton(false)]);

    this.enableCharts = true;
    this.startTime = Date.now();
    this.trainStatus = TrainStatus.Started;

    sound.speak("Continue training!");
  }

  getPunch() {
    const p = this.slidedPowerArray;
    if (p.length < 3) {
      return undefined;
    }
    return p[p.length - 3] < p[p.length - 2] &&
      p[p.length - 2] >= p[p.length - 1]
      ? p[p.length - 2] / this.maxPower
      : undefined;
  }

  getStrongPunches() {
    const weakLimit = this.weakLimit;
    return this.punches.reduce<number>(
      (acc: number, p: Punch) => acc + (p.relStrength >= weakLimit ? 1 : 0),
      0
    );
  }

  processTraining() {
    const timeSoFar = this.elapsedTime + Date.now() - this.startTime;
    updateCard(DisplayAttrs.Time, formatTime(timeSoFar));

    // TODO: detecting + counting valid punches
    const relStrength = this.getPunch();
    if (!relStrength) {
      return;
    }
    // avoiding noise, but register even the weak punches
    if (relStrength > this.noiseLimit) {
      this.punches.push({
        relStrength,
        time: Date.now(),
      });
      const averagePower =
        this.punches.reduce<number>(
          (acc: number, p: Punch) => acc + p.relStrength,
          0
        ) / this.punches.length;

      const nStrong = this.getStrongPunches();
      updateCard(
        DisplayAttrs.StrongPercent,
        ((100.0 * nStrong) / this.punches.length).toFixed(1)
      );
      updateCard(DisplayAttrs.AveragePower, (100.0 * averagePower).toFixed(1));
      updateCard(DisplayAttrs.Punches, String(this.punches.length));
      updateCard(DisplayAttrs.StrongPunches, String(nStrong));
      updateCard(
        DisplayAttrs.WeakPunches,
        String(this.punches.length - nStrong)
      );
    }
  }
}
