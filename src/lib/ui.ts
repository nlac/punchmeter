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
  Average = "average",
  Punches = "punches",
  WeakPunches = "weak-punches",
  StrongPunches = "strong-punches"
}

export const updateCard = (attr: string, value: string) =>
  (($(".display-container ." + attr) as HTMLSpanElement)!.innerHTML = value);
