// The rules of the river: how it sits on the screen, what floats down it, what the duck bumps into,
// and the score. Positions across the river are in lanes (0 is the middle of the leftmost lane) and
// distances along it are in lane widths, so nothing needs refitting when the screen changes size.

export const LANES = 5;
export const LIVES = 3;
export const JUMP_POINTS = 20;   // a jump is worth twenty metres
export const AIR = 1.05;         // seconds in the air after a ramp
export const STEER = 5;          // lanes a second with the arrow keys
export const DUCK_R = .26;       // the duck's bump circle: a little smaller than the duck, to be kind
export const DUCK_MIN = -.12, DUCK_MAX = LANES - 1 + .12;   // as far as the duck can go and stay on the water
const RADIUS = { rock: .3, hippo: .32 };
const LOG = .7, LOG_R = .19;     // a log reaches .7 lanes either side of its middle, so it blocks two lanes

// The river runs up the middle of the screen with grass either side, and the duck swims near the bottom.
// `ahead` is how many lanes of river the duck can see in front of it, `behind` how many are below it.
export function river(W, H) {
  const rw = Math.min(W * .92, Math.max(H * .9, 300), 760), u = rw / LANES;
  const left = (W - rw) / 2, duckY = H - Math.max(u * 1.25, H * .18);
  return { W, H, rw, u, left, right: left + rw, duckY, ahead: duckY / u, behind: (H - duckY) / u };
}

// The duck speeds up all through a swim: quickly over the first minute, so even a short swim gets
// faster, then a little more over the next four minutes, then it holds steady.
// p: how far through the first minute (it also makes rows busier)
// reach: seconds for something to float from the top of the screen down to the duck
// mps: metres swum a second; every: seconds between rows of things
export const FULL_SPEED = 300;
export function pace(t) {
  const p = Math.min(1, t / 60), q = Math.min(1, Math.max(0, t - 60) / (FULL_SPEED - 60));
  return { p, reach: 3.6 - 1.4 * p - .4 * q, mps: 3 + 4 * p + 3 * q, every: 1.7 - .6 * p };
}

// One row across the river. At least two lanes are always left open, so there's a wide way through,
// and there's often a ramp in one of the open lanes. The very first thing down the river is a ramp,
// right where the duck starts, so the first jump comes without any steering.
export function row(rng, p, n) {
  if (n === 0) return [{ kind: "ramp", x: (LANES - 1) / 2 }];
  const open = Array.from({ length: LANES }, (_, i) => i), out = [];
  const take = i => open.splice(open.indexOf(i), 1);
  const want = n < 3 ? 1 : 1 + +(rng() < .3 + .4 * p) + +(rng() < .25 * p);
  for (let k = 0; k < want && open.length > 2; k++) {
    const pairs = open.filter(i => open.includes(i + 1));
    if (pairs.length && open.length >= 4 && rng() < .3) {
      const i = pairs[rng() * pairs.length | 0];
      take(i); take(i + 1);
      out.push({ kind: "log", x: i + .5 });
    } else {
      const i = open[rng() * open.length | 0];
      take(i);
      out.push({ kind: rng() < .25 ? "hippo" : "rock", x: i });
    }
  }
  if (rng() < .45 - .15 * p) out.push({ kind: "ramp", x: open[rng() * open.length | 0] });
  return out;
}

// The lanes a thing blocks.
export function covers(o) {
  if (o.kind === "ramp") return [];
  return o.kind === "log" ? [o.x - .5, o.x + .5] : [o.x];
}

// Does the duck, at x across the river, touch thing o, which is o.d lanes ahead of it?
export function bumps(x, o) {
  if (o.kind === "ramp") return false;
  if (o.kind === "log") {
    const nx = Math.max(o.x - LOG, Math.min(o.x + LOG, x));
    return Math.hypot(x - nx, o.d) < DUCK_R + LOG_R;
  }
  return Math.hypot(x - o.x, o.d) < DUCK_R + RADIUS[o.kind];
}
export const onRamp = (x, o) => o.kind === "ramp" && Math.abs(x - o.x) < .45 && Math.abs(o.d) < .3;

export const score = (metres, jumps) => Math.floor(metres) + jumps * JUMP_POINTS;
export const cleanBest = v => Number.isInteger(v) && v > 0 && v < 1e7 ? v : 0;

// A repeatable random (mulberry32), for replaying a run.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
