import type { Game } from "@clockwyrks/simple-2d";
import { createDebug } from "./debug";
import { initialState } from "./world";
import { update } from "./simulation";
import { render } from "./render";
import * as C from "./constants";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  // Pointer press origins, keyed by contact id, for cross-frame menu clicks.
  readonly menuPress?: Readonly<Record<number, number>>;
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;
}

export type { CaromDebugApi } from "./debug";
import type { CaromDebugApi } from "./debug";
export const BACKGROUND = "#0b1219";
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    C.ACTIONS.forEach((name) =>
      api.input.register(name, { keys: [...C.BINDINGS[name]] }),
    );
    Object.values(C.CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        wave: i === 2 ? "triangle" : "sine",
        freq: [560, 260, 780, 980][i],
        freqTo: [320, 180, 420, 440][i],
        durationMs: [65, 45, 90, 180][i],
        gain: 0.15,
      }),
    );
    for (const key of ["screen", "mode"] as const)
      api.diagnostics.register(key, (s) => s[key]);
    for (const key of ["p1", "p2"] as const)
      api.diagnostics.register(key, (s) => s.score[key]);
    for (const key of ["x", "y", "vx", "vy", "spin"] as const)
      api.diagnostics.register(`ball.${key}`, (s) => s.ball?.[key] ?? "none");
    api.diagnostics.register("ball.speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    for (const side of ["left", "right"] as const)
      for (const key of ["cy", "vy"] as const)
        api.diagnostics.register(`${side}.${key}`, (s) => s.paddles[side][key]);
    return [initialState(false), createDebug()];
  },
  update,
  render,
};
