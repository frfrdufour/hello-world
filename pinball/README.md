# Gravewick Manor Pinball

An original haunted-mansion pinball table that runs in the browser. No build step, no dependencies.

## Two modes

- **Classic:** 90s-style pinball. Physics use real units (millimetres, a 27 mm ball, a 6.5 degree table slope, 30 ms flipper stroke).
- **Haunted:** the same table bends its own rules. Random hauntings (lights out, moon gravity, tilting house, portals, poltergeist, mirror world), ghost balls, time rewind and walls you draw with the mouse.

Press `H` or use the on-screen switch to change mode at any time.

## Run it

Open `index.html` through any static web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

| Key | Action |
| --- | --- |
| Left Shift, Z, Left arrow | Left flipper |
| Right Shift, /, Right arrow | Right flipper |
| Space, Down arrow | Plunger (hold, then release) |
| X, Up arrow | Nudge |
| Enter | Start |
| H | Classic / Haunted |
| R | Rewind time (Haunted) |
| P, M, N, V | Pause, sound, music, voices |

## Files

- `js/physics.js`: ball, flipper and collision code
- `js/table.js`: table layout
- `js/game.js`: rules, scoring and Haunted mode
- `js/render.js`: drawing
- `js/dmd.js`: dot-matrix score display
- `js/audio.js`: synthesized effects, music and spoken lines
- `js/main.js`: input and the main loop

All art, sound, music and text are original and generated in code.
