// Experimental rule engine to extract high-level application logic
// - DOM event handlers become simple rule triggers
// - simplifies state logic

// synchronous, lightweight high-level logic
type Logic = (params?: any) => boolean | void;

export class Rule {
  id: string;
  logic: Logic;
  priority: number;
  _rank: number = 0;

  constructor(id: string, logic: Logic, priority?: number) {
    this.id = id;
    this.logic = logic;
    this.priority = priority ?? 0;
  }

  matches(pattern: RegExp | string): boolean {
    try {
      const regex =
        pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
      return regex.test(this.id);
    } catch {
      return false;
    }
  }

  run(params: any) {
    return this.logic(params);
  }
}

type TriggerOptions = {
  // scoping rules
  include?: (RegExp | string)[];
  exclude?: (RegExp | string)[];
  // optional custom params passed at triggering
  params?: any;
};

export class RuleEngine {
  protected rules: Rule[] = [];

  protected triggerQueue: TriggerOptions[] = [];
  protected flushScheduled: boolean = false;

  // make it a singleton
  protected constructor() {}
  protected static _instance: RuleEngine;
  static get() {
    if (!RuleEngine._instance) {
      RuleEngine._instance = new RuleEngine();
    }
    return RuleEngine._instance;
  }

  // sort by priority + register order
  sortRules() {
    this.rules.forEach(
      (r, idx) => ((r as any)._rank = -0.000001 * idx + r.priority)
    );
    this.rules.sort((r1, r2) => (r1._rank < r2._rank ? 1 : -1));
  }

  // adding a new rule
  register(id: string, logic: Logic, priority?: number) {
    this.rules.push(new Rule(id, logic, priority));
    this.sortRules();
    // chaining
    return this;
  }

  protected flushTrigger(trigger: TriggerOptions) {
    for (const rule of this.rules) {
      const matcher = rule.matches.bind(rule);
      if (
        (!trigger.include || trigger.include.some(matcher)) &&
        (!trigger.exclude || !trigger.exclude.some(matcher))
      ) {
        console.debug(
          `RE: running logic of ${rule.id} with params`,
          trigger.params
        );
        if (rule.run(trigger.params)) {
          // stop evaluation of rules if a logic returns true
          return true;
        }
      }
    }
    return false;
  }

  // firing all triggers in the queue
  protected flushTriggers() {
    this.flushScheduled = false;
    const triggers = [...this.triggerQueue];
    this.triggerQueue = [];

    for (const trigger of triggers) {
      if (this.flushTrigger(trigger)) {
        break;
      }
    }
  }

  // explicitly scheduling a trigger in the microtask queue
  trigger(
    include: (RegExp | string)[] | undefined,
    exclude?: (RegExp | string)[] | undefined,
    params?: any
  ) {
    this.triggerQueue.push({ include, exclude, params });
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(this.flushTriggers.bind(this));
    }
  }
}

// setting up a class property to trigger on change
// target: "ES6" works, "ES20xx" doesn't
export function Trigger(
  include: (RegExp | string)[] | undefined,
  exclude?: (RegExp | string)[] | undefined,
  params?: any
): PropertyDecorator {
  return function (target: any, key: string | symbol) {
    const privateKey = "_" + String(key);

    Object.defineProperty(target, key, {
      get(this: any) {
        return this[privateKey];
      },
      set(this: any, value: any) {
        this[privateKey] = value;
        RuleEngine.get().trigger(include, exclude, params);
      },
      enumerable: true,
      configurable: true,
    });
  };
}
