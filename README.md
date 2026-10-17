# Carom

A top-down paddle duel about angles, momentum, and a little misdirection. Strike
while moving to curve the ball; bank shots off two swaying, rotating gold bars.
Play against the computer or a friend on the same keyboard. First to 11 wins,
with a two-point lead.

## Run

Requires a current Node.js release supported by Vite.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Everything runs in the browser; no accounts,
backend, downloads, or external assets are needed.

## Production

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` to the root of any static host.

## Controls

| Action | Keys |
| --- | --- |
| Left paddle | W / S |
| Right paddle (Versus) | Up / Down arrows |
| Human paddle (Solo) | Either movement pair |
| Navigate menu | Either movement pair |
| Select | Enter / Space, or click / tap |
| Pause / resume | P / Escape |
| Back | Escape |
| Mute | M |
| Diagnostics | Backtick |

On touchscreens the engine supplies two vertical sliders and menu controls.
Moving at impact adds spin; center hits fly straight and edge hits take steeper
angles. Obstacles preserve the ball's speed and spin. Paddle hits accelerate it.

## Development

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` check types,
lint, formatting, and engine-backed simulation tests with coverage. State and
physics are render-independent immutable transitions. The engine's debug API is
returned by initialization for deterministic scenarios; nothing is installed on
the browser global object. The `showcase/` directory contains screenshots and an
engine-recorded rally.
