import { RuleEngine, Trigger } from "../lib/rule-engine";
import { sound } from "../lib/sound";
import { setupButtons } from "./buttons";
import { CalibrateState } from "./calibrate";
import { RuleId } from "./rules-ids";

export enum TrainStatus {
  Stopped = "stopped",
  Paused = "paused",
  Started = "started",
}

export class TrainState extends CalibrateState {
  trainStatus: TrainStatus;
  enableCharts = false;

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

  finishTraining(initial: boolean) {
    setupButtons([this.startButton(false, "Start"), this.finishButton(true)]);
    this.resetWindow();
    this.enableCharts = false;
    this.trainStatus = TrainStatus.Stopped;
    sound.speak("Whenever you're ready - push Start and keep punching!");
  }

  async startTraining() {
    setupButtons([this.pauseButton(false), this.finishButton(false)]);
    await sound.speak("Go ahead!");
    this.enableCharts = true;
    this.trainStatus = TrainStatus.Started;
  }

  pauseTraining() {
    setupButtons([
      this.startButton(false, "Continue"),
      this.finishButton(false),
    ]);
    sound.speak("Waiting to continue.");
    this.enableCharts = false;
    this.trainStatus = TrainStatus.Paused;
  }

  processTraining() {
    // TODO: detecting + conting valid punches
    console.info("training...");
  }
}
