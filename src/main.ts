import { Rule, RuleEngine } from "./lib/rule-engine";
import { RuleId } from "./state/rules-ids";
import { TrainState, TrainStatus } from "./state/train";

const appState = new TrainState();

// high level application logic extracted here
RuleEngine.get()

  // workflow of calibrating
  .register(RuleId.Calibrate, function (this: Rule, params: any) {
    appState.calibrateDelay();
    return true;
  })
  .register(RuleId.DelaySet, function (this: Rule, params: any) {
    if (appState.isDelayCalibrated()) {
      appState.calibratePower();
    }
    return true;
  })
  .register(RuleId.PowerSet, function (this: Rule, params: any) {
    if (appState.isPowerCalibrated()) {
      appState.finishTraining(true);
    }
    return true;
  })

  // workflow of the actual training
  .register(RuleId.TrainStart, function (this: Rule, params: any) {
    appState.startTraining();
    return true;
  })
  .register(RuleId.TrainPause, function (this: Rule, params: any) {
    appState.pauseTraining();
    return true;
  })
  .register(RuleId.TrainFinish, function (this: Rule, params: any) {
    appState.finishTraining(false);
    return true;
  })

  // handler of the devicemotion event listener
  .register("listening", function (this: Rule, params: any) {
    appState.updateChart();

    if (!appState.isDelayCalibrated() && appState.hasFullWindow()) {
      appState.getDelay();
      return;
    }

    if (!appState.isPowerCalibrated() && appState.hasFullWindow()) {
      appState.getPower();
      return;
    }

    if (appState.trainStatus === TrainStatus.Started) {
      appState.processTraining();
    }
  });
