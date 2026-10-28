# Duck Duck Duck

[![Tests](https://github.com/russellmorton/duck-duck-duck/actions/workflows/test.yml/badge.svg)](https://github.com/russellmorton/duck-duck-duck/actions/workflows/test.yml)

**Play it: https://duck-duck-duck-kappa.vercel.app**

A river game for toddlers. A little yellow duck swims down a river. Steer it side to side to miss the rocks, logs and sleepy hippos, and to hit the wooden ramps. Every ramp sends the duck flying up in a spin, with a "Wheee!", before it splashes back down.

**Score = metres swum + 20 for every jump.**

The duck has three hearts. Bumping into something costs a heart: the duck goes dizzy, loses a few feathers and blinks for a moment, and can't be bumped again until it stops blinking. When the hearts run out the river slows to a stop and a score card shows the score, the metres, the jumps and the best score so far. Then one big button starts another swim.

Made for little hands:

- The first thing down the river is a ramp, right where the duck starts, so the first jump comes without any steering.
- Every row of things leaves at least two lanes open, and the first rows only have one thing to miss. The duck speeds up all through a swim: about twice as fast after the first minute, then a little faster still over the next four minutes, after which it holds steady.
- Bump circles are a little smaller than the drawings, and a duck that lands on something after a jump doesn't get bumped.
- Arrows either side of the duck show it goes side to side until it's been steered. If nobody has steered after a few seconds, the game says how.
- Everything spoken also shows in a caption at the bottom. Every 100 metres gets a ding and a cheer.
- The buttons for grown-ups are sound on/off and full screen. The best score and the sound setting are remembered in the browser. The screen is kept awake while playing.

## Controls

- **Desktop:** left and right arrow keys (or A and D). Space or up arrow quacks.
- **Touch screens:** slide a finger left and right anywhere on the screen. The duck moves a little further than the finger does. Holding a finger still also works: the duck paddles over towards it. A quick tap quacks.

## Running it

No build step. It's a static page with plain ES modules.

```sh
npm install
npm start          # http://localhost:4173
```

Add `?seed=<number>` to the address to send the same rocks, logs, hippos and ramps down the river every time. The browser tests use this.

## Tests

```sh
npm run test:unit  # layout, pace, rows of things, bumps, the score (node:test)
npm run test:e2e   # plays the game in Chromium, desktop and phone sizes (Playwright)
npm test           # both
```

## Layout

- `index.html`: markup and styles
- `src/river.js`: the rules (where the river sits, how fast it goes, what floats down it, what counts as a bump, the score)
- `src/draw.js`: canvas drawings of the river and banks, the duck, rocks, logs, hippos and ramps
- `src/game.js`: everything else, including steering, jumps, bumps, sound, voice, the score card and the buttons

## Deploying

Pushes to `main` deploy to production through Vercel's GitHub integration; pull requests get preview deployments. Vercel serves the repo root as a static site (`vercel.json`), and `.vercelignore` keeps tests and tooling out. GitHub Actions runs the tests on every push and pull request. `src/analytics.js` loads Vercel Web Analytics on the deployed site only.

All the sounds, including the quack, are synthesised in the browser, and the tunes at the end of a swim are original.
