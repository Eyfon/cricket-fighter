// Physical key codes keep P2's numpad working even when Num Lock is off.
export const bindings = [
  {
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    guard: "KeyS",
    punch: "KeyJ",
    kick: "KeyK",
    dodge: "KeyL",
    skill: "KeyU",
    skill2: "KeyI",
    super: "KeyO",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    guard: "ArrowDown",
    punch: "Numpad1",
    kick: "Numpad2",
    dodge: "Numpad3",
    skill: "Numpad4",
    skill2: "Numpad5",
    super: "Numpad6",
  },
];
export function eventCode(event) {
  if (event.code) return event.code;
  return /^[a-z]$/i.test(event.key)
    ? `Key${event.key.toUpperCase()}`
    : event.key;
}
export class HumanInput {
  constructor(binding) {
    this.binding = binding;
    this.reset();
  }
  reset() {
    this.previous = {};
  }
  read(keys, dt) {
    const held = Object.fromEntries(
      Object.entries(this.binding).map(([action, code]) => [
        action,
        keys.has(code),
      ]),
    );
    const pressed = (action) => held[action] && !this.previous[action];
    const input = { left: held.left, right: held.right, down: held.guard };
    if (pressed("up")) input.jump = true;
    for (const action of ["punch", "kick", "dodge", "skill", "skill2", "super"]) {
      if (!pressed(action)) continue;
      if (held.guard && (action === "punch" || action === "kick")) {
        input[action === "punch" ? "specialPunch" : "specialKick"] = true;
      } else input[action] = true;
    }
    this.previous = held;
    return input;
  }
}
