import { describe, it, expect } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type CaromState } from "./game";
import * as C from "./constants";
import { fly } from "./physics";
import { initialState, obstacle } from "./world";

async function setup(ms = 10) {
  const target = new EventTarget();
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  const cues: string[] = [];
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  await engine.initialize();
  const key = (code: string, type = "keydown") => {
    const event = new Event(type);
    Object.assign(event, { code, repeat: false });
    target.dispatchEvent(event);
  };
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, "keyup");
  };
  const point = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) => {
    const event = new Event(type);
    Object.assign(event, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: device,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    target.dispatchEvent(event);
  };
  return { engine, d: engine.debug, key, tap, point, cues, canvas };
}
function flight(
  s: CaromState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  spin = 0,
): CaromState {
  return {
    ...s,
    screen: "playing",
    obstacles: [],
    ball: { ...s.ball!, x, y, vx, vy, spin, held: false },
  };
}
describe("engine-backed game", () => {
  it("initializes the contract, diagnostics, menus and immutable readings", async () => {
    const { engine, d } = await setup();
    const before = structuredClone(engine.state);
    expect(d.snapshot(engine.state)).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      ball: { held: true, speed: 0 },
      ai: { tracking: true, movement: true },
    });
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(14);
    expect(d.menuItemRect(engine.state, 3)).toBeNull();
    expect(d.menuItemRect(engine.state, 0)?.w).toBeGreaterThan(0);
    d.snapshot(engine.state);
    d.reconcile(engine.state);
    expect(engine.state).toEqual(before);
    engine.apply((s) => d.setScreen(s, "playing"));
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
    engine.destroy();
  });
  it("navigates title, manual, remembers selection, and starts both modes", async () => {
    const { engine, tap, d } = await setup();
    await tap("ArrowUp");
    expect(engine.state.menuIndex).toBe(2);
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.menuIndex).toBe(2);
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
    await engine.advance(100);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.vx).toBeLessThan(0);
    engine.apply((s) => d.reset(s));
    await tap("Enter");
    expect(engine.state.mode).toBe("solo");
    engine.destroy();
  });
  it("resolves edge precedence and escape once, freezing every physical field", async () => {
    const { engine, key, tap } = await setup();
    key("KeyW");
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(2);
    expect(engine.state.screen).toBe("title");
    for (const c of ["KeyW", "KeyS", "Enter"]) key(c, "keyup");
    await tap("KeyS");
    await tap("Enter");
    await tap("Escape");
    expect(engine.state.screen).toBe("paused");
    const frozen = structuredClone(engine.state);
    await engine.advance(20);
    expect(engine.state.ball).toEqual(frozen.ball);
    expect(engine.state.obstacleClock).toBe(frozen.obstacleClock);
    expect(engine.state.simTime).toBeGreaterThan(frozen.simTime);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
    engine.destroy();
  });
  it("selects and confirms mouse and touch regions including same-frame edges", async () => {
    const { engine, d, point } = await setup();
    const a = d.menuItemRect(engine.state, 1)!;
    point("pointermove", a.x + 10, a.y + 10);
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    point("pointerdown", a.x + 10, a.y + 10);
    point("pointerup", 0, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    point("pointerdown", a.x + 10, a.y + 10, 2, "touch");
    await engine.advance(1);
    point("pointerup", a.x + 10, a.y + 10, 2, "touch");
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
    engine.destroy();
  });
  it("drives paddles independently, clamps actual velocity and preserves requested velocity", async () => {
    const { engine, d, key } = await setup();
    engine.apply((s) => d.setScreen(s, "countdown"));
    engine.apply((s) => d.setMode(s, "versus"));
    key("KeyS");
    key("ArrowUp");
    await engine.advance(1);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.01,
    );
    expect(engine.state.paddles.right.vy).toBe(-C.PADDLE_SPEED);
    engine.apply((s) => d.setPaddleDriven(s, "left", true));
    engine.apply((s) => d.setPaddleVy(s, "left", 1000));
    engine.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MAX_CY));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.left.drivenVy).toBe(1000);
    engine.destroy();
  });
  it("moves solo from either key pair and gates AI faculties", async () => {
    const { engine, d, key } = await setup();
    engine.apply((s) => flight(s, 800, 600, 500, 20));
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(C.PADDLE_SPEED);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    engine.apply((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    engine.apply((s) => d.setAiMovement(s, true));
    engine.apply((s) => d.setAiTracking(s, false));
    engine.apply((s) => d.setPaddleCy(s, "right", 600));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    engine.destroy();
  });
  it("serves on elapsed hold, without moving on the serve frame", async () => {
    const { engine, d } = await setup();
    engine.apply((s) => d.setScreen(s, "countdown"));
    engine.apply((s) => d.setBallHoldTimer(s, 0.005));
    engine.apply((s) => d.setBallServeSign(s, -1));
    await engine.advance(1);
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.held).toBe(false);
    expect(engine.state.ball?.vy).toBeCloseTo(
      -C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
    );
    expect(engine.state.ball?.trail.length).toBe(1);
    await engine.advance(20);
    expect(
      engine.state.ball!.trail.every(
        (p) => engine.state.simTime - p.t <= C.TRAIL_TIME,
      ),
    ).toBe(true);
    engine.destroy();
  });
  it("scores, parks toward receiver, and requires a two-point winning lead", async () => {
    const { engine, d, cues } = await setup();
    engine.apply((s) => d.setScore(s, 10, 10));
    engine.apply((s) => flight(s, C.FIELD_W + C.BALL_R + 1, 200, 500, 0));
    await engine.advance(1);
    expect(engine.state.score.p1).toBe(11);
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball?.trail).toEqual([]);
    engine.apply((s) => flight(s, C.FIELD_W + C.BALL_R + 1, 200, 500, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    expect(cues.filter((c) => c === C.CUES.score)).toHaveLength(2);
    engine.destroy();
  });
  it("poses every world field, rejects absent entities, reconciles and resets", async () => {
    const { engine, d } = await setup();
    engine.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(engine.state, 4)).toThrow();
    expect(() => d.spawnObstacle(engine.state, 7)).toThrow();
    await engine.advance(1);
    expect(d.snapshot(engine.state).ball).toBeNull();
    engine.apply((s) => d.spawnBall(s));
    engine.apply((s) => d.spawnObstacle(s, 1));
    engine.apply((s) => d.setObstacleClock(s, 1.2));
    expect(engine.state.obstacles[0]).toEqual(obstacle(1, 1.2));
    engine.apply((s) => d.setObstacleClockRunning(s, false));
    engine.apply((s) => d.setBallPosition(s, 300, 210));
    engine.apply((s) => d.setBallVelocity(s, 300, 400));
    engine.apply((s) => d.setBallSpin(s, 700));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setReceiver(s, "right"));
    engine.apply((s) => d.setWinner(s, "right"));
    engine.apply((s) => d.setTitleIndex(s, 1));
    engine.apply((s) => d.setResumeScreen(s, "countdown"));
    engine.apply((s) => d.drawBallServeSign(s));
    const read = d.snapshot(engine.state);
    expect(read.ball?.speed).toBe(500);
    expect(read.ball?.spin).toBe(700);
    expect(d.reconcile(engine.state)).toEqual(engine.state);
    engine.apply((s) => d.setMuted(s, true));
    await engine.advance(1);
    expect(engine.state.muted).toBe(true);
    engine.apply((s) => d.reset(s));
    expect(engine.state).toMatchObject({
      screen: "title",
      simTime: 0,
      muted: true,
      obstacleClock: 0,
    });
    engine.destroy();
  });
  it("renders every screen and handles pause restart, quit, and play again", async () => {
    const { engine, d, tap } = await setup();
    await tap("Enter");
    await tap("KeyP");
    engine.apply((s) => d.setMenuIndex(s, 1));
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
    await tap("KeyP");
    engine.apply((s) => d.setMenuIndex(s, 2));
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    engine.apply((s) => d.setScreen(s, "matchover"));
    engine.apply((s) => d.setWinner(s, "right"));
    await engine.advance(1);
    await tap("Enter");
    expect(engine.state.screen).toBe("countdown");
    engine.apply((s) => d.setScreen(s, "matchover"));
    engine.apply((s) => d.setMenuIndex(s, 1));
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    engine.destroy();
  });
});
describe("render-free collision core", () => {
  it("reflects walls without speed loss and decays spin exponentially", () => {
    const s = flight(initialState(false), 300, 12, 0, -500, 0),
      e = new Set<C.CueName>();
    const b = fly(s.ball!, s, 0.01, e);
    expect(b.vy).toBe(500);
    expect(b.y).toBeGreaterThanOrEqual(C.BALL_R);
    expect(e.has(C.CUES.wallBounce)).toBe(true);
    const spin = flight(initialState(false), 300, 360, 500, 0, 600);
    const result = fly(spin.ball!, spin, 0.1, new Set());
    expect(result.spin).toBeCloseTo(600 * Math.pow(0.5, 0.1 / C.SPIN_HALFLIFE));
    expect(Math.hypot(result.vx, result.vy)).toBeCloseTo(500);
    expect(result.vy).toBeGreaterThan(0);
  });
  it("adds motion spin, boosts speed, caps it, and preserves end-cap spin", () => {
    let s = flight(initialState(false), 78, C.FIELD_CY, -900, 0, 0);
    s = {
      ...s,
      paddles: { ...s.paddles, left: { ...s.paddles.left, vy: 720 } },
    };
    let b = fly(s.ball!, s, 0.01, new Set());
    expect(b.vx).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(936);
    expect(b.spin).toBeGreaterThan(500);
    s = flight(s, 78, C.FIELD_CY, -980, 0);
    b = fly(s.ball!, s, 0.01, new Set());
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(C.SPEED_CAP);
    s = flight(s, 55, C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1, 0, 500);
    b = fly(s.ball!, s, 0.01, new Set());
    expect(b.vy).toBe(-500);
    expect(b.spin).toBe(0);
  });
  it("reflects against tilted, corner, and inside obstacle contacts", () => {
    for (const t of [0, 0.6, 1.5]) {
      const o = obstacle(0, t),
        c = Math.cos(o.theta),
        sn = Math.sin(o.theta);
      let s = initialState(false);
      s = flight(s, o.cx + c * 23, o.cy + sn * 23, -c * 500, -sn * 500);
      s = { ...s, obstacles: [o] };
      const e = new Set<C.CueName>();
      const b = fly(s.ball!, s, 0.01, e);
      expect(b.vx * c + b.vy * sn).toBeGreaterThan(0);
      expect(e.has(C.CUES.obstacleBounce)).toBe(true);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(500);
    }
    for (const [x, y] of [
      [0, 0],
      [0, 69],
      [15, 75],
    ]) {
      const o = obstacle(0, 0);
      const s = {
        ...flight(initialState(false), o.cx + x, o.cy + y, -100, -100),
        obstacles: [o],
      };
      const b = fly(s.ball!, s, 0, new Set());
      expect(Number.isFinite(b.x)).toBe(true);
      expect(Math.hypot(b.x - o.cx, b.y - o.cy)).toBeGreaterThan(0);
    }
  });
  it("agrees across 2 and 16 millisecond steps", () => {
    const run = (dt: number) => {
      let s = flight(initialState(false), 250, 300, 650, -200, 400);
      for (let t = 0; t < 0.8 - 1e-8; t += dt)
        s = { ...s, ball: fly(s.ball!, s, dt, new Set()) };
      return s.ball!;
    };
    const a = run(0.002),
      b = run(0.016);
    expect(Math.hypot(a.vx, a.vy)).toBeCloseTo(Math.hypot(b.vx, b.vy));
    expect(Math.sign(a.vx)).toBe(Math.sign(b.vx));
    expect(Math.sign(a.vy)).toBe(Math.sign(b.vy));
  });
});
