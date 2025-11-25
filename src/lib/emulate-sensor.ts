import { RuleId } from "../state/rules-ids";
import { TrainState } from "../state/train";
import { RuleEngine } from "./rule-engine";
import * as config from "../config.json";

let _hasSensor: boolean | undefined = undefined;

export const hasSensor = () => {
  return _hasSensor;
};

const probeSensor: () => Promise<boolean> = () => {
  if (typeof _hasSensor === "boolean") {
    return Promise.resolve(_hasSensor);
  }

  return new Promise((resolve) => {
    if (!("DeviceMotionEvent" in window)) {
      resolve(false);
      return;
    }

    let resolved = false;
    let timer: number;

    const finish = (result: boolean) => {
      if (resolved) return;
      resolved = true;

      // cleanup
      clearTimeout(timer);
      window.removeEventListener("devicemotion", handler);

      _hasSensor = result;
      RuleEngine.get().trigger([RuleId.SensorPresenceDetermined]);
      resolve(result);
    };

    const handler = (event: DeviceMotionEvent) => {
      const acc = event.acceleration;
      if (acc && typeof acc.x === "number") {
        finish(true);
        return;
      }
    };

    window.addEventListener("devicemotion", handler);

    timer = setTimeout(() => finish(false), 500);

    // for iOS 13+
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((state: string) => {
          if (state !== "granted") {
            finish(false);
          }
        })
        .catch(() => finish(false));
    }
  });
};

const getAcc = (appState: TrainState) => {
  const sa = appState.slidedSoundArray;
  return 0.6 * (sa[sa.length - 2] ?? 0);
};

export const setupEmulate = async (appState: TrainState) => {
  if (await probeSensor()) {
    // no emulation needed
    return;
  }

  let timer: any;

  const oldAddListener = window.addEventListener.bind(window);
  window.addEventListener = function (type, callback, options) {
    if (type !== "devicemotion") {
      return (oldAddListener as any).apply(window, arguments);
    }

    timer = setInterval(() => {
      callback({
        acceleration: {
          x: getAcc(appState),
          y: 0,
          z: 0,
        },
      });
    }, config.emulatedTimerFreq);
  };

  const oldRemoveListener = window.removeEventListener.bind(window);
  window.removeEventListener = function (type, callback, options) {
    if (type !== "devicemotion") {
      return (oldRemoveListener as any).apply(window, arguments);
    }
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};
