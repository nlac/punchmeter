declare global {
  //function $<T extends Element = Element>(selector: string): T | null;

  function $<K extends keyof HTMLElementTagNameMap>(
    selector: K
  ): HTMLElementTagNameMap[K] | null;
  function $<T extends Element = Element>(selector: string): T | null;
}

export {};
