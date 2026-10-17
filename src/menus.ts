import type { CaromState } from "./game";
import * as C from "./constants";
export function items(s: CaromState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: CaromState, index: number) {
  if (index < 0 || index >= items(s).length) return null;
  return {
    x: 112,
    y:
      (s.screen === "title" ? 385 : s.screen === "howto" ? 582 : 365) +
      index * 66,
    w: 414,
    h: 54,
  };
}
