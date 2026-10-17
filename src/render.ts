import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { CaromState } from "./game";
import * as C from "./constants";
import { items, menuItemRect } from "./menus";
const ink = "#edf4ee",
  muted = "#72858b",
  cyan = "#83edc5",
  orange = "#ff936a",
  gold = "#d9c58d";
function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size = 14,
  color = ink,
  weight = 400,
  align: CanvasTextAlign = "left",
) {
  ctx.font = `${weight} ${size}px ${size > 60 ? "Arial, sans-serif" : '"Courier New", monospace'}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
  ctx.fill();
}
function field(ctx: CanvasRenderingContext2D, s: CaromState) {
  // Quiet court markings stay behind the bright collision bodies.
  ctx.strokeStyle = "#1c2a33";
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 18, C.FIELD_W - 48, C.FIELD_H - 36);
  ctx.setLineDash([5, 15]);
  line(ctx, C.NET_X, 28, C.NET_X, C.FIELD_H - 28, "#26363d");
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 76, 0, Math.PI * 2);
  ctx.strokeStyle = "#1b2b32";
  ctx.stroke();
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.strokeStyle = "#544e3c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      -C.OBSTACLE_HW - 6,
      -C.OBSTACLE_HH - 6,
      C.OBSTACLE_W + 12,
      C.OBSTACLE_H + 12,
      12,
    );
    ctx.stroke();
    bar(ctx, -C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, gold);
    ctx.fillStyle = "#736542";
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
  for (const side of ["left", "right"] as const) {
    const p = s.paddles[side],
      x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? cyan : orange;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    bar(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color);
    ctx.shadowBlur = 0;
  }
  if (s.ball) {
    const b = s.ball;
    if (b.trail.length > 1) {
      for (let i = 1; i < b.trail.length; i++) {
        const a = b.trail[i - 1],
          p = b.trail[i];
        line(
          ctx,
          a.x,
          a.y,
          p.x,
          p.y,
          `rgba(237,244,238,${(i / b.trail.length) * 0.5})`,
          2 + (i / b.trail.length) * 12,
        );
      }
    }
    ctx.shadowColor = ink;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
function menu(ctx: CanvasRenderingContext2D, s: CaromState) {
  items(s).forEach((label, i) => {
    const r = menuItemRect(s, i)!;
    const active = i === s.menuIndex;
    if (active) {
      ctx.fillStyle = "#83edc5";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else {
      ctx.strokeStyle = "#2c3a42";
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
    text(ctx, `0${i + 1}`, r.x + 18, r.y + 33, 12, active ? "#245646" : muted);
    text(ctx, label, r.x + 62, r.y + 34, 18, active ? "#0b211c" : ink, 700);
    text(
      ctx,
      active ? "↗" : "→",
      r.x + r.w - 22,
      r.y + 34,
      23,
      active ? "#123e32" : muted,
      400,
      "right",
    );
  });
}
export function render(s: DeepReadonly<CaromState>, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  // A very faint drafting grid, not a texture or fetched asset.
  for (let x = 40; x < C.FIELD_W; x += 40)
    for (let y = 40; y < C.FIELD_H; y += 40) {
      ctx.fillStyle = "#1b2830";
      ctx.fillRect(x, y, 1, 1);
    }
  const live = s.screen === "playing" || s.screen === "countdown";
  if (live || s.screen === "paused" || s.screen === "matchover") {
    field(ctx, s);
    text(ctx, "P1 / HUMAN", C.FIELD_CX - 80, 48, 12, cyan, 400, "right");
    text(
      ctx,
      s.mode === "solo" ? "P2 / COMPUTER" : "P2 / HUMAN",
      C.FIELD_CX + 80,
      48,
      12,
      orange,
    );
    text(
      ctx,
      String(s.score.p1).padStart(2, "0"),
      C.FIELD_CX - 86,
      112,
      64,
      ink,
      700,
      "right",
    );
    text(
      ctx,
      String(s.score.p2).padStart(2, "0"),
      C.FIELD_CX + 86,
      112,
      64,
      ink,
      700,
    );
    text(
      ctx,
      `${s.mode === "solo" ? "SOLO / HUMAN × MACHINE" : "VERSUS / LOCAL DUEL"}  ·  FIRST TO ${C.WIN_SCORE} / LEAD BY ${C.WIN_LEAD}`,
      C.FIELD_CX,
      680,
      12,
      muted,
      400,
      "center",
    );
    text(ctx, "P / ESC  PAUSE", 100, 680, 11, muted);
    text(
      ctx,
      s.muted ? "M  SOUND OFF" : "M  SOUND ON",
      1180,
      680,
      11,
      muted,
      400,
      "right",
    );
    if (s.screen === "countdown") {
      text(ctx, "READY TO RECEIVE", C.FIELD_CX, 416, 13, cyan, 400, "center");
      text(
        ctx,
        (s.ball?.holdTimer ?? C.HOLD_TIME).toFixed(1),
        C.FIELD_CX,
        446,
        22,
        ink,
        700,
        "center",
      );
    }
  }
  if (s.screen === "title" || s.screen === "howto") {
    text(ctx, "C / 01", 64, 55, 15, cyan, 700);
    text(ctx, "AN EXPERIMENT IN ANGLES", 1216, 55, 12, muted, 400, "right");
    line(ctx, 64, 78, 1216, 78, "#2a373d");
    if (s.screen === "title") {
      text(ctx, "THE PADDLE DUEL, WITH A TWIST.", 112, 165, 12, cyan);
      text(ctx, C.TITLE_TEXT, 104, 284, 116, ink, 900);
      text(ctx, "Move. Strike. Bend the trajectory.", 112, 329, 17, muted);
      menu(ctx, s);
      text(ctx, "W S / ↑ ↓  SELECT     ENTER  PLAY", 112, 626, 12, muted);
      // An original diagram of a spin shot, anchored like a technical plate.
      ctx.save();
      ctx.translate(702, 147);
      ctx.strokeStyle = "#26383e";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 450, 438);
      ctx.setLineDash([4, 10]);
      line(ctx, 225, 18, 225, 420, "#2b3d43");
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(225, 219, 65, 0, Math.PI * 2);
      ctx.strokeStyle = "#22343b";
      ctx.stroke();
      bar(ctx, 24, 220, 12, 80, cyan);
      bar(ctx, 414, 108, 12, 80, orange);
      ctx.save();
      ctx.translate(166, 117);
      ctx.rotate(-0.4);
      bar(ctx, -8, -53, 16, 106, gold);
      ctx.restore();
      ctx.save();
      ctx.translate(284, 321);
      ctx.rotate(-0.4);
      bar(ctx, -8, -53, 16, 106, gold);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(45, 258);
      ctx.bezierCurveTo(128, 254, 150, 280, 235, 176);
      ctx.bezierCurveTo(291, 110, 338, 85, 395, 136);
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(395, 136, 9, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      text(ctx, "+ SPIN", 74, 301, 11, cyan);
      text(ctx, "01 / THE BANK SHOT", 22, 411, 11, muted);
      text(ctx, "↗", 388, 54, 33, cyan);
      ctx.restore();
      text(ctx, "SPIN IS YOUR SECOND SHOT.", 702, 619, 14, ink, 700);
      text(ctx, "Catch it moving. Send it somewhere new.", 702, 645, 12, muted);
    } else {
      text(ctx, "FIELD MANUAL / 01", 112, 149, 13, cyan);
      text(ctx, "HOW TO PLAY", 108, 226, 66, ink, 800);
      const rows = [
        [
          "01",
          "TAKE YOUR SIDE",
          "Solo: W / S or ↑ / ↓.  Versus: W / S left, ↑ / ↓ right.",
        ],
        [
          "02",
          "STRIKE IN MOTION",
          "Move your paddle at impact to add spin. Your shot curves.",
        ],
        [
          "03",
          "PLAY THE ANGLES",
          "The gold bars sway and rotate. Bank a shot off their faces.",
        ],
        [
          "04",
          "CLOSE IT OUT",
          `First to ${C.WIN_SCORE}, win by ${C.WIN_LEAD}. P / Esc pauses. M toggles sound.`,
        ],
      ];
      rows.forEach(([n, h, d], i) => {
        const y = 292 + i * 67;
        text(ctx, n, 112, y, 14, cyan);
        text(ctx, h, 162, y, 16, ink, 700);
        text(ctx, d, 162, y + 25, 14, muted);
      });
      menu(ctx, s);
    }
    line(ctx, 64, 665, 1216, 665, "#2a373d");
    text(ctx, "CAROM / INDEPENDENT ARCADE", 64, 695, 11, muted);
    text(ctx, "NO STRAIGHT ANSWERS.", 1216, 695, 11, muted, 400, "right");
  }
  if (s.screen === "paused" || s.screen === "matchover") {
    ctx.fillStyle = "rgba(7,14,20,0.91)";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    text(
      ctx,
      s.screen === "paused" ? "TIME OUT / TAKE A BREATH" : "MATCH COMPLETE",
      112,
      185,
      13,
      cyan,
    );
    text(
      ctx,
      s.screen === "paused"
        ? "PAUSED"
        : `${s.winner === "left" ? "PLAYER ONE" : s.mode === "solo" ? "COMPUTER" : "PLAYER TWO"} WINS`,
      108,
      277,
      s.screen === "paused" ? 88 : 62,
      ink,
      800,
    );
    text(
      ctx,
      s.screen === "paused"
        ? "The field can wait."
        : `${s.score.p1} — ${s.score.p2}   /   Well played. Run it back?`,
      112,
      320,
      17,
      muted,
    );
    menu(ctx, s);
    text(ctx, "↑ ↓  SELECT    ENTER  CONFIRM", 112, 615, 12, muted);
  }
  ctx.restore();
}
