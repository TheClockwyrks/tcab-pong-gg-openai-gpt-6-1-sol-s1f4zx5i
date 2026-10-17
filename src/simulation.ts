import type { UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState, PaddleState, Side } from "./game";
import * as C from "./constants";
import { clamp, start, title, parked, obstacle } from "./world";
import { items, menuItemRect } from "./menus";
import { fly, type Events } from "./physics";
function confirm(s: CaromState): CaromState {
  switch (s.screen) {
    case "title":
      s = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...s, screen: "howto", menuIndex: 0, menuPress: {} }
        : start(s, s.menuIndex === 0 ? "solo" : "versus");
    case "howto":
      return title(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? start(s, s.mode)
          : title(s);
    case "matchover":
      return s.menuIndex === 0 ? start(s, s.mode) : title(s);
    default:
      return s;
  }
}
function input(state: CaromState, api: UpdateApi): CaromState {
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  // Samples include all contacts in arrival order, including a same-frame click.
  const samples = api.input.pointerSamples();
  api.input.pointer();
  api.input.pointerContacts();
  let s = state;
  if (edges.mute) {
    api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted() };
  }
  const screen = s.screen;
  if ((screen === "playing" || screen === "countdown") && edges.pause)
    return {
      ...s,
      resumeScreen: screen,
      screen: "paused",
      menuIndex: 0,
      menuPress: {},
    };
  if (screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPress: {} };
  if ((screen === "howto" || screen === "matchover") && edges.back)
    return title(s);
  const count = items(s).length;
  if (!count) return s;
  const up = edges["p1-up"] || edges["p2-up"],
    down = edges["p1-down"] || edges["p2-down"];
  let keyboardConfirmed = false;
  if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
  else if (edges.confirm) {
    s = confirm(s);
    keyboardConfirmed = true;
  }
  if (s.screen !== screen) return s;
  const presses = { ...s.menuPress };
  const hit = (x: number, y: number) => {
    for (let i = 0; i < count; i++) {
      const r = menuItemRect(s, i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return i;
    }
    return -1;
  };
  for (const sample of samples) {
    const index = hit(sample.x, sample.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (sample.type === "down" && sample.button === "primary")
      presses[sample.id] = index;
    if (sample.type === "up") {
      const accepted = index >= 0 && presses[sample.id] === index;
      delete presses[sample.id];
      if (accepted && !keyboardConfirmed) {
        s = confirm(s);
        keyboardConfirmed = true;
        if (s.screen !== screen) return { ...s, menuPress: {} };
      }
    }
  }
  return { ...s, menuPress: presses };
}
function move(p: PaddleState, vy: number, dt: number): PaddleState {
  if (p.driven) vy = p.drivenVy;
  const raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (cy !== raw && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}
export function update(
  state: DeepReadonly<CaromState>,
  api: UpdateApi,
  dt: number,
): CaromState {
  // InitApi deliberately has no audio controls. Poses carry mute in the state;
  // synchronize it before processing this frame's inputs and collision cues.
  api.audio.setMuted(state.muted);
  let s = input({ ...state, simTime: state.simTime + dt }, api);
  if (s.screen !== "countdown" && s.screen !== "playing")
    return { ...s, muted: api.audio.muted() };
  const events: Events = new Set();
  const held = (a: C.ActionName) => api.input.value(a) > 0;
  const axis = (up: boolean, down: boolean) =>
    (Number(down) - Number(up)) * C.PADDLE_SPEED;
  const leftVy = axis(
    held("p1-up") || (s.mode === "solo" && held("p2-up")),
    held("p1-down") || (s.mode === "solo" && held("p2-down")),
  );
  let rightVy = axis(held("p2-up"), held("p2-down"));
  if (s.mode === "solo") {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - s.paddles.right.cy;
    rightVy =
      s.ai.movement && Math.abs(diff) > deadzone && dt > 0
        ? Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt)
        : 0;
  }
  s = {
    ...s,
    paddles: {
      left: move(s.paddles.left, leftVy, dt),
      right: move(s.paddles.right, rightVy, dt),
    },
  };
  if (s.ball) {
    let b = s.ball;
    if (s.screen === "countdown") {
      const holdTimer = Math.max(0, b.holdTimer - dt);
      b = { ...b, holdTimer };
      if (holdTimer <= 0) {
        b = {
          ...b,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        s = { ...s, screen: "playing" };
      }
    } else if (!b.held) b = fly(b, s, dt, events);
    b = {
      ...b,
      trail: [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
        (p) => s.simTime - p.t <= C.TRAIL_TIME,
      ),
    };
    s = { ...s, ball: b };
    if (
      s.screen === "playing" &&
      (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
    ) {
      const scorer: Side = b.x > C.FIELD_W ? "left" : "right";
      const score = {
        p1: s.score.p1 + Number(scorer === "left"),
        p2: s.score.p2 + Number(scorer === "right"),
      };
      events.add(C.CUES.score);
      if (
        (score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD) ||
        (score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD)
      )
        s = { ...s, score, winner: scorer, screen: "matchover", menuIndex: 0 };
      else
        s = {
          ...s,
          score,
          ball: parked(),
          receiver: scorer === "left" ? "right" : "left",
          screen: "countdown",
        };
    }
  }
  const t = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    obstacleClock: t,
    obstacles: s.obstacles.map((o) => obstacle(o.index, t)),
    muted: api.audio.muted(),
  };
  events.forEach((cue) => api.audio.play(cue));
  return s;
}
