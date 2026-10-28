import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LANES, LIVES, JUMP_POINTS, DUCK_MIN, DUCK_MAX, DUCK_R, FULL_SPEED, river, pace, row, covers, bumps, onRamp, score, cleanBest, seeded,
} from "../../src/river.js";

const SCREENS = [[1280, 720], [412, 839], [915, 412], [768, 1024], [1920, 1080], [320, 568]];
// lots of rows, from the gentle start to full speed
function* rows(seed = 1, n = 4000) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) yield row(r, (i % 200) / 199, i);
}

test("on any screen the river fits, with room for the duck and a good look ahead", () => {
  for (const [W, H] of SCREENS) {
    const L = river(W, H);
    assert.ok(L.left >= 0 && L.right <= W, `${W}x${H} river on screen`);
    assert.ok(L.rw <= 760 && Math.abs(L.u * LANES - L.rw) < 1e-9);
    assert.ok(L.u >= 55, `${W}x${H} lanes wide enough for a duck`);
    assert.ok(L.duckY + L.u * .6 < H, `${W}x${H} the duck is on screen`);
    assert.ok(L.ahead >= 4, `${W}x${H} can see ${L.ahead.toFixed(1)} lanes ahead`);
    assert.ok(Math.abs(L.ahead + L.behind - H / L.u) < 1e-9);
  }
});

test("the duck keeps speeding up until full speed, then holds steady", () => {
  let prev = pace(0);
  assert.equal(prev.p, 0);
  for (let t = 5; t <= FULL_SPEED; t += 5) {
    const P = pace(t);
    assert.ok(P.reach < prev.reach && P.mps > prev.mps && P.every <= prev.every, `faster at ${t}s`);
    assert.ok(P.reach >= 1.8 && P.every >= 1, "never too fast for little hands");
    prev = P;
  }
  assert.deepEqual(pace(FULL_SPEED), pace(1000));
});

test("even a short swim gets noticeably faster", () => {
  assert.ok(pace(20).mps >= pace(0).mps * 1.4, "40% faster after 20 seconds");
  assert.ok(pace(20).reach <= pace(0).reach * .9);
  assert.ok(pace(60).mps >= pace(0).mps * 2, "twice as fast after a minute");
});

test("the first thing down the river is a ramp in front of the duck", () => {
  assert.deepEqual(row(seeded(9), 0, 0), [{ kind: "ramp", x: (LANES - 1) / 2 }]);
  assert.ok(onRamp((LANES - 1) / 2, { kind: "ramp", x: (LANES - 1) / 2, d: 0 }));
});

test("every row leaves at least two lanes open, and ramps sit in open lanes", () => {
  let ramps = 0, logs = 0, hippos = 0, threes = 0;
  for (const things of rows()) {
    const blocked = things.flatMap(covers);
    assert.equal(new Set(blocked).size, blocked.length, "nothing on top of anything else");
    assert.ok(blocked.length <= LANES - 2, `${blocked.length} lanes blocked`);
    for (const o of things) {
      assert.ok(["rock", "log", "hippo", "ramp"].includes(o.kind));
      for (const lane of o.kind === "ramp" ? [o.x] : covers(o)) assert.ok(Number.isInteger(lane) && lane >= 0 && lane < LANES, `${o.kind} at ${o.x}`);
      if (o.kind === "ramp") { ramps++; assert.ok(!blocked.includes(o.x), "a ramp has nothing in its lane"); }
      if (o.kind === "log") logs++;
      if (o.kind === "hippo") hippos++;
    }
    assert.ok(things.filter(o => o.kind === "ramp").length <= 1);
    if (blocked.length === 3) threes++;
  }
  assert.ok(ramps > 1000 && logs > 500 && hippos > 500 && threes > 300, `${ramps} ramps, ${logs} logs, ${hippos} hippos, ${threes} busy rows`);
});

test("the first rows are gentle: just one thing to miss", () => {
  for (let s = 1; s < 50; s++) {
    const r = seeded(s);
    for (let n = 0; n < 3; n++) assert.ok(row(r, 0, n).flatMap(covers).length <= (n ? 2 : 0));
  }
});

test("the same seed floats the same things down the river", () => {
  assert.deepEqual([...rows(5, 50)], [...rows(5, 50)]);
  assert.notDeepEqual([...rows(5, 50)], [...rows(6, 50)]);
});

test("the duck bumps what's in its lane, and passes what's in the next one", () => {
  for (const kind of ["rock", "hippo"]) {
    assert.ok(bumps(2, { kind, x: 2, d: 0 }));
    assert.ok(bumps(2.3, { kind, x: 2, d: .2 }));
    assert.ok(!bumps(3, { kind, x: 2, d: 0 }), `${kind} next door`);
    assert.ok(!bumps(2, { kind, x: 2, d: .7 }), `${kind} still ahead`);
  }
  const log = { kind: "log", x: 1.5, d: 0 };
  assert.ok(bumps(1, log) && bumps(2, log) && bumps(1.5, log));
  assert.ok(!bumps(0, log) && !bumps(3, log));
  assert.ok(!bumps(2, { kind: "ramp", x: 2, d: 0 }), "ramps are never a bump");
  assert.ok(onRamp(2.3, { kind: "ramp", x: 2, d: .1 }));
  assert.ok(!onRamp(2.6, { kind: "ramp", x: 2, d: 0 }) && !onRamp(2, { kind: "ramp", x: 2, d: .5 }));
});

test("the duck can get to every lane but not out of the river", () => {
  assert.ok(DUCK_MIN < 0 && DUCK_MAX > LANES - 1);
  assert.ok(DUCK_MIN - DUCK_R > -.5 && DUCK_MAX + DUCK_R < LANES - .5);
});

test("score is metres swum plus points for every jump", () => {
  assert.equal(LIVES, 3);
  assert.equal(score(0, 0), 0);
  assert.equal(score(123.9, 0), 123);
  assert.equal(score(100, 4), 100 + 4 * JUMP_POINTS);
  assert.ok(score(50, 3) > score(50, 2) && score(51, 2) > score(50, 2));
});

test("a saved best score is only kept if it makes sense", () => {
  assert.equal(cleanBest(345), 345);
  for (const bad of [undefined, null, -5, 0, 1.5, "300", NaN, Infinity, 1e9, {}]) assert.equal(cleanBest(bad), 0);
});
