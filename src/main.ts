import { Rule, RuleEngine } from "./lib/rule-engine";
import { RuleId } from "./state/rules-ids";
import { TrainState, TrainStatus } from "./state/train";

const appState = new TrainState();

// high level application logic extracted here
RuleEngine.get()

  // workflow of calibrating
  .register(RuleId.CalibrationTriggered, function (this: Rule, params: any) {
    appState.enableCharts = false;
    appState.startCalibrateDelay();
    return true;
  })
  .register(RuleId.DelayCalibrationStarted, function (this: Rule, params: any) {
    appState.enableCharts = true;
    return true;
  })
  .register(RuleId.DelayCalibrated, function (this: Rule, params: any) {
    appState.enableCharts = false;
    appState.startCalibratePower();
    return true;
  })
  .register(RuleId.PowerCalibrationStarted, function (this: Rule, params: any) {
    appState.enableCharts = true;
    return true;
  })
  .register(RuleId.PowerCalibrated, function (this: Rule, params: any) {
    appState.enableCharts = false;
    appState.finishTraining(true);
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
    if (appState.enableCharts) {
      appState.updateChart();
    }

    if (!appState.isDelayCalibrated() && appState.hasFullWindow()) {
      appState.calculateDelay();
      appState.enableCharts = true;
      return;
    }

    if (!appState.isPowerCalibrated() && appState.hasFullWindow()) {
      appState.calculatePower();
      appState.enableCharts = true;
      return;
    }

    if (appState.trainStatus === TrainStatus.Started) {
      appState.processTraining();
    }
  });
