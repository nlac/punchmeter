type ButtonState = {
  hidden?: boolean;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export const setupButtons = (buttonState: ButtonState[]) => {
  const buttons: HTMLInputElement[] = Array.from(
    $("#buttons-container")!.children
  ) as HTMLInputElement[];

  buttons.forEach((b) => {
    b.style.display = "none";
    b.value = "";
    b.onclick = () => {};
  });

  buttonState.forEach((bs, i) => {
    buttons[i].style.display = bs.hidden ? "hidden" : "inline-block";
    if (bs.disabled) {
      buttons[i].setAttribute("disabled", "disabled");
    } else {
      buttons[i].removeAttribute("disabled");
    }
    buttons[i].value = bs.title ?? "";
    buttons[i].onclick = bs.onClick ?? (() => {});
  });
};

export enum DisplayAttrs {
  Time = "time",
  Punches = "punches",
  WeakPunches = "weak-punches",
  StrongPunches = "strong-punches",
  AveragePower = "average-power",
  StrongPercent = "strong-percent",
}

export const updateCard = (attr: string, value: string) =>
  (($(".display-container ." + attr) as HTMLSpanElement)!.innerHTML = value);

export const debug = (text: string, prepend = true) => {
  const cont = $("#debug-container pre")!;
  if (!prepend) {
    cont.innerHTML = "";
  }
  const isEmpty = cont.innerHTML === "";
  cont.innerHTML =
    text +
    (isEmpty
      ? ""
      : `
`) +
    cont.innerHTML;
};

export const initConfigItem = (id: string, initialValue: string) => {
  const card = $(`#${id}-card`)! as HTMLDivElement;
  const display = card.querySelector(
    `#${id}-card .stat-value`
  )! as HTMLDivElement;
  const config = card.querySelector(
    `#${id}-card .stat-config`
  )! as HTMLDivElement;
  const select = config.querySelector("select")! as HTMLSelectElement;
  const close = config.querySelector(
    ".stat-config-close"
  )! as HTMLButtonElement;

  display!.innerHTML = initialValue;
  select.value = initialValue;

  card.onclick = () => {
    card.classList.add("active");
  };

  select.onchange = (e) => {
    e.stopPropagation();
    const val = (select.querySelector("option:checked") as HTMLOptionElement)!
      .value;
    display.innerHTML = val;
    return false;
  };

  close.onclick = (e) => {
    e.stopPropagation();
    card.classList.remove("active");
    return false;
  };
};
