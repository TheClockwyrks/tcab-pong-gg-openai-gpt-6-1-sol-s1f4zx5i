import type { DeepReadonly } from "ts-essentials";
import type {
  CaromState,
  BallState,
  PaddleState,
  Screen,
  Mode,
  Side,
} from "./game";
import { initialState, parked, obstacle, drawSign } from "./world";
import { menuItemRect } from "./menus";
import { CAROM_DEBUG_VERSION } from "./constants";
type State = DeepReadonly<CaromState>;
type Pose<A extends unknown[] = []> = (s: State, ...args: A) => CaromState;
export interface CaromDebugApi {
  readonly version: number;
  clearWorld: Pose;
  spawnBall: Pose;
  spawnObstacle: Pose<[number]>;
  reset: Pose;
  reconcile: Pose;
  setScreen: Pose<[Screen]>;
  setMode: Pose<[Mode]>;
  setMenuIndex: Pose<[number]>;
  setTitleIndex: Pose<[number]>;
  setResumeScreen: Pose<["countdown" | "playing"]>;
  setScore: Pose<[number, number]>;
  setWinner: Pose<[Side | null]>;
  setReceiver: Pose<[Side]>;
  setPaddleCy: Pose<[Side, number]>;
  setPaddleVy: Pose<[Side, number]>;
  setPaddleDriven: Pose<[Side, boolean]>;
  setBallPosition: Pose<[number, number]>;
  setBallVelocity: Pose<[number, number]>;
  setBallSpin: Pose<[number]>;
  setBallHeld: Pose<[boolean]>;
  setBallHoldTimer: Pose<[number]>;
  setBallServeSign: Pose<[1 | -1]>;
  drawBallServeSign: Pose;
  setAiTracking: Pose<[boolean]>;
  setAiMovement: Pose<[boolean]>;
  setMuted: Pose<[boolean]>;
  setObstacleClock: Pose<[number]>;
  setObstacleClockRunning: Pose<[boolean]>;
  snapshot(s: State): Omit<CaromState, "ball"> & {
    version: number;
    ball: (BallState & { speed: number }) | null;
  };
  menuItemRect: typeof menuItemRect;
}
function ball(s: State, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddle(s: State, side: Side, patch: Partial<PaddleState>): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}
export function createDebug(): CaromDebugApi {
  return {
    version: CAROM_DEBUG_VERSION,
    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => ({ ...s, ball: parked() }),
    spawnObstacle: (s, i) => ({
      ...s,
      obstacles: [
        ...s.obstacles.filter((o) => o.index !== i),
        obstacle(i, s.obstacleClock),
      ].sort((a, b) => a.index - b.index),
    }),
    reset: (s) => initialState(s.muted),
    reconcile: (s) => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstacle(o.index, s.obstacleClock)),
    }),
    setScreen: (s, screen) => ({ ...s, screen }),
    setMode: (s, mode) => ({ ...s, mode }),
    setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
    setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
    setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
    setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
    setWinner: (s, winner) => ({ ...s, winner }),
    setReceiver: (s, receiver) => ({ ...s, receiver }),
    setPaddleCy: (s, side, cy) => paddle(s, side, { cy }),
    setPaddleVy: (s, side, drivenVy) => paddle(s, side, { drivenVy }),
    setPaddleDriven: (s, side, driven) => paddle(s, side, { driven }),
    setBallPosition: (s, x, y) => ball(s, { x, y }),
    setBallVelocity: (s, vx, vy) => ball(s, { vx, vy }),
    setBallSpin: (s, spin) => ball(s, { spin }),
    setBallHeld: (s, held) => ball(s, { held }),
    setBallHoldTimer: (s, holdTimer) => ball(s, { holdTimer }),
    setBallServeSign: (s, serveSign) => ball(s, { serveSign }),
    drawBallServeSign: (s) => ball(s, { serveSign: drawSign() }),
    setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
    setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
    setMuted: (s, muted) => {
      return { ...s, muted };
    },
    setObstacleClock: (s, obstacleClock) => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstacle(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (s, obstacleClockRunning) => ({
      ...s,
      obstacleClockRunning,
    }),
    snapshot: (s) => {
      const { menuPress: _, ...declared } = s;
      void _;
      return structuredClone({
        ...declared,
        version: CAROM_DEBUG_VERSION,
        ball: s.ball
          ? { ...s.ball, speed: Math.hypot(s.ball.vx, s.ball.vy) }
          : null,
      });
    },
    menuItemRect,
  };
}
