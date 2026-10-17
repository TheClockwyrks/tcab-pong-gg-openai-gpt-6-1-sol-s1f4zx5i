import type { BallState, CaromState, PaddleState, ObstacleState } from "./game";
import * as C from "./constants";
import { clamp } from "./world";
type Ball = { -readonly [K in keyof BallState]: BallState[K] };
export type Events = Set<C.CueName>;
function paddle(b: Ball, p: PaddleState, left: boolean, events: Events) {
  const x0 = left ? C.P1_X0 : C.P2_X0,
    x1 = left ? C.P1_X1 : C.P2_X1,
    y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF;
  if (
    b.x <= x0 - C.BALL_R ||
    b.x >= x1 + C.BALL_R ||
    b.y <= y0 - C.BALL_R ||
    b.y >= y1 + C.BALL_R
  )
    return;
  const depths = [
    b.x - x0 + C.BALL_R,
    x1 + C.BALL_R - b.x,
    b.y - y0 + C.BALL_R,
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP),
      angle = clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    b.vx = (left ? 1 : -1) * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    events.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
  }
}
function obstacle(b: Ball, o: ObstacleState, events: Events) {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta),
    dx = b.x - o.cx,
    dy = b.y - o.cy;
  const x = dx * c + dy * s,
    y = -dx * s + dy * c,
    qx = clamp(x, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(y, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const dist = Math.hypot(x - qx, y - qy);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = (x - qx) / dist;
    ny = (y - qy) / dist;
    push = C.BALL_R - dist;
  } else if (C.OBSTACLE_HW - Math.abs(x) <= C.OBSTACLE_HH - Math.abs(y)) {
    nx = x >= 0 ? 1 : -1;
    ny = 0;
    push = C.BALL_R + C.OBSTACLE_HW - Math.abs(x);
  } else {
    nx = 0;
    ny = y >= 0 ? 1 : -1;
    push = C.BALL_R + C.OBSTACLE_HH - Math.abs(y);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c,
    dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    events.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
// Work on a private ball value: contacts may mutate this local scratch value,
// but neither the previous frame nor any of its nested objects is modified.
export function fly(
  ball: BallState,
  state: CaromState,
  dt: number,
  events: Events,
): BallState {
  const b = { ...ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy),
      a = speed > 0 ? (b.spin / speed) * h : 0,
      c = Math.cos(a),
      s = Math.sin(a),
      vx = b.vx;
    b.vx = vx * c - b.vy * s;
    b.vy = vx * s + b.vy * c;
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
    paddle(b, state.paddles.left, true, events);
    paddle(b, state.paddles.right, false, events);
    state.obstacles.forEach((o) => obstacle(b, o, events));
  }
  return b;
}
