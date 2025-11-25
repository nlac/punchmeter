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
  weakLimit = 0.3;

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

  startButton(disabled: boolean, title: string) {
    return {
      title,
      disabled,
      onClick: () => {
        //await sound.speak("Go ahead!");
        RuleEngine.get().trigger([RuleId.TrainStart]);
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

  pauseButton(disabled: boolean) {
    return {
      title: "Pause",
      disabled,
      onClick: () => {
        RuleEngine.get().trigger([RuleId.TrainPause]);
      },
    };
  }

  finishTraining(first: boolean) {
    setupButtons([this.startButton(false, "Start"), this.finishButton(true)]);

    // reset
    this.resetWindow();
    this.enableCharts = false;
    this.trainStatus = TrainStatus.Stopped;
    this.punches = [];
    this.startTime = Date.now();
    this.elapsedTime = 0;

    sound.speak("Whenever you're ready - push Start and keep punching!");
  }

  async startTraining() {
    setupButtons([this.pauseButton(false), this.finishButton(false)]);
    await sound.speak("Go ahead!");

    this.startTime = Date.now();

    this.enableCharts = true;
    this.trainStatus = TrainStatus.Started;
  }

  pauseTraining() {
    setupButtons([
      this.startButton(false, "Continue"),
      this.finishButton(false),
    ]);
    sound.speak("Waiting for continue.");
    this.enableCharts = false;

    this.elapsedTime += Date.now() - this.startTime;

    this.trainStatus = TrainStatus.Paused;
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
      const average =
        this.punches.reduce<number>(
          (acc: number, p: Punch) => acc + p.relStrength,
          0
        ) / this.punches.length;

      const nStrong = this.getStrongPunches();
      updateCard(DisplayAttrs.Average, (100.0*average).toFixed(1));
      updateCard(DisplayAttrs.Punches, String(this.punches.length));
      updateCard(DisplayAttrs.StrongPunches, String(nStrong));
      updateCard(DisplayAttrs.WeakPunches, String(this.punches.length - nStrong));
    }
  }
}
