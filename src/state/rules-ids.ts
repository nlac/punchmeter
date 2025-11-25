// enum for rule ids to trace workflow + refactor more easy
export enum RuleId {
  Listening = "listening",

  CalibrationTriggered = "calibrate_button_clicked",
  DelayCalibrationStarted = "delay_calibration_process_started",
  DelayCalibrated = "delay_variable_calibrated",
  PowerCalibrationStarted = "power_calibration_process_started",
  PowerCalibrated = "power_variable_calibrated",

  TrainStart = "train-start",
  TrainPause = "train-pause",
  TrainFinish = "train-finish",
}
