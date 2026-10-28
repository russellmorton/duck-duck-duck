import {
  LANES, LIVES, AIR, STEER, DUCK_MIN, DUCK_MAX, river, pace, row, bumps, onRamp, score, cleanBest, seeded,
} from "./river.js";
import { drawRiver, drawThing, drawDuck, drawStar } from "./draw.js";

const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchy = matchMedia("(pointer: coarse)").matches;
const TAU = Math.PI * 2;
const INK = "#1d2b4f";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const pick = list => list[Math.random() * list.length | 0];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---------- saved between visits: the best score, sound on or off ----------
const KEY = "duck-duck-duck";
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
let best = cleanBest(saved.best);
let muted = saved.muted === true;
function save() { try { localStorage.setItem(KEY, JSON.stringify({ best, muted })); } catch {} }

// What floats down the river comes from a seeded random when the address has ?seed=, so a run can be
// replayed (the browser tests use this). Splashes and sparkles stay random either way.
const seed = Number(new URLSearchParams(location.search).get("seed"));
const rnd = Number.isInteger(seed) && seed > 0 ? seeded(seed) : Math.random;

// ---------- state ----------
// title → swim → over (no hearts left; the river slows to a stop) → done (the score card) → swim again
let state = "title", stateAt = 0, T = 0;
let duck, things, parts = [];
let swimT, metres, jumps, lives, rows, untilRow, nextMark, steered, hinted;
let scroll = 0, speed = 0, shake = 0, wakeIn = 0;

function setState(s) { state = s; stateAt = T; document.body.dataset.state = s; }

function newRun() {
  // air: seconds left in a jump; hurt: dizzy after a bump; safe: can't be bumped again yet; grace: just landed
  duck = { x: (LANES - 1) / 2, tilt: 0, air: 0, hurt: 0, safe: 0, grace: 0, flap: 0 };
  things = [];
  swimT = 0; metres = 0; jumps = 0; lives = LIVES; rows = 0; untilRow = 0; nextMark = 100;
  steered = false; hinted = false;
}
newRun();

// ---------- sound + voice ----------
let ac, noiseBuf;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
  if (ac?.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
function tone(freq, t0, dur, type = "sine", gain = .18, slide) {
  const a = audio(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + t0 + .02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + .05);
}
function hiss(dur, freq, type = "bandpass", gain = .2, t0 = 0) {
  const a = audio(); if (!a || muted) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  const t = a.currentTime + t0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + .01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
// A buzzy sawtooth through a narrow filter that closes as the pitch falls: that's a quack.
function quack(t0 = 0, pitch = 1) {
  const a = audio(); if (!a || muted) return;
  const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + t0;
  o.type = "sawtooth";
  o.frequency.setValueAtTime(560 * pitch, t); o.frequency.exponentialRampToValueAtTime(380 * pitch, t + .17);
  f.type = "bandpass"; f.Q.value = 2.5;
  f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(800, t + .17);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(.4, t + .015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + .2);
  o.connect(f).connect(g).connect(a.destination); o.start(t); o.stop(t + .25);
}
const sfx = {
  quack: () => quack(0, .9 + Math.random() * .25),
  quacks: () => { quack(0); quack(.22, 1.1); quack(.44, .95); },
  boing: () => tone(180, 0, .45, "triangle", .2, 760),
  whee: () => tone(520, .05, .7, "sine", .1, 1400),
  splash: () => { hiss(.4, 900, "lowpass", .3); tone(300, 0, .15, "sine", .1, 110); },
  bonk: () => { tone(200, 0, .18, "square", .07, 80); hiss(.12, 2000, "bandpass", .15); tone(900, .12, .3, "sine", .06, 600); },
  ding: () => { tone(1319, 0, .5, "triangle", .12); tone(1760, .12, .7, "triangle", .1); },
};
// An original little tune for the end of a swim, and a bigger one for a best score.
function jingle() {
  [[523, 0], [659, .14], [784, .28], [659, .42], [784, .56], [1047, .76]].forEach(([f, d], i, n) => tone(f, d, i === n.length - 1 ? .6 : .16, "triangle", .14));
  [[131, 0], [196, .28], [262, .56]].forEach(([f, d]) => tone(f, d, .35, "sine", .12));
}
function fanfare() {
  [[784, 1.1], [784, 1.25], [784, 1.4], [1047, 1.6], [988, 1.85], [1047, 2.05]].forEach(([f, d], i, n) => tone(f, d, i === n.length - 1 ? .7 : .14, "square", .05));
}

// Speaks, and shows the words in the caption for a few seconds, so nothing depends on hearing.
let captionTimer;
function say(text, delay = 0) {
  const cap = $("caption");
  cap.textContent = text; cap.classList.add("on");
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => cap.classList.remove("on"), 3200);
  if (muted) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = .95; u.pitch = 1.3;
    setTimeout(() => speechSynthesis.speak(u), delay);
  } catch {}
}

// ---------- the canvas ----------
const cv = $("river"), c = cv.getContext("2d");
let L, dpr = 1;
function resize() {
  const W = cv.clientWidth, H = cv.clientHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  L = river(W, H);
}
new ResizeObserver(resize).observe(cv);
resize();
const sx = x => L.left + (x + .5) * L.u;     // lanes across → screen x
const sy = d => L.duckY - d * L.u;           // lanes ahead of the duck → screen y

// ---------- particles: splashes, ripples, sparkles, feathers ----------
function splash(x, y, n = 14) {
  for (let i = 0; i < n; i++) parts.push({ k: "drop", x, y, y0: y, vx: (Math.random() - .5) * 260, vy: -(160 + Math.random() * 220), r: 2.5 + Math.random() * 4, life: 2 });
  parts.push({ k: "ring", x, y, r: L.u * .2, life: .7 });
}
function sparkle(x, y, n, spread = 1) {
  const cols = ["#ffd23f", "#ff6b9d", "#7ddc5a", "#4fc3ff", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = (120 + Math.random() * 220) * spread;
    parts.push({ k: "star", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 5 + Math.random() * 6, rot: Math.random() * TAU, col: cols[i % cols.length], life: 1.2 });
  }
}
function feathers(x, y) {
  for (let i = 0; i < 5; i++) parts.push({ k: "feather", x, y: y - L.u * .2, vx: (Math.random() - .5) * 220, vy: -(80 + Math.random() * 90), rot: Math.random() * TAU, r: L.u * .09, life: 1.4 });
}
function stepParts(dt) {
  const flow = speed * L.u;   // the river carries ripples down the screen
  for (const p of parts) {
    p.life -= dt;
    if (p.k === "drop") { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vy > 0 && p.y > p.y0 + 6) p.life = 0; }
    else if (p.k === "ring") { p.r += L.u * 1.2 * dt; p.y += flow * dt; }
    else if (p.k === "wake") { p.x += p.vx * dt; p.y += flow * dt; p.r += L.u * .35 * dt; }
    else if (p.k === "star") { p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += 4 * dt; }
    else if (p.k === "feather") { p.vy += 140 * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt + Math.sin(p.life * 8) * 30 * dt; p.y += p.vy * dt; p.rot += 3 * dt; }
  }
  parts = parts.filter(p => p.life > 0);
}
// Ripples go under the duck; everything else flies over it.
function drawParts(under) {
  for (const p of parts) {
    if ((p.k === "wake" || p.k === "ring") !== under) continue;
    c.save();
    if (p.k === "wake" || p.k === "ring") {
      c.globalAlpha = Math.max(0, p.life / (p.k === "ring" ? .7 : .9)) * .8; c.strokeStyle = "#fff"; c.lineWidth = 3;
      c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * .45, 0, 0, TAU); c.stroke();
    } else if (p.k === "drop") {
      c.fillStyle = "rgba(220,245,255,.95)"; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
    } else if (p.k === "star") {
      c.globalAlpha = Math.min(1, p.life * 2);
      drawStar(c, p.x, p.y, p.r, p.rot, p.col);
    } else if (p.k === "feather") {
      c.globalAlpha = Math.min(1, p.life * 2); c.translate(p.x, p.y); c.rotate(p.rot);
      c.beginPath(); c.ellipse(0, 0, p.r * .45, p.r, 0, 0, TAU); c.fillStyle = "#fff3b0"; c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.moveTo(0, -p.r); c.lineTo(0, p.r * 1.3); c.stroke();
    }
    c.restore();
  }
}

// ---------- swimming ----------
const keys = new Set();
let finger = null;   // { id, x, at, dx, travel, slid } while a finger (or mouse button) is down

function steer(dt) {
  const was = duck.x;
  const dir = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
  duck.x += dir * STEER * dt;
  if (finger) {
    duck.x += finger.dx / L.u * 1.3;   // a slide moves the duck a little further than the finger went
    finger.dx = 0;
    // a finger held still steers too: the duck paddles over towards it
    if (!finger.slid && T - finger.at > .25) {
      const want = (finger.x - L.left) / L.u - .5;
      duck.x += clamp(want - duck.x, -STEER * .7 * dt, STEER * .7 * dt);
    }
  }
  duck.x = clamp(duck.x, DUCK_MIN, DUCK_MAX);
  if (Math.abs(duck.x - was) > 1e-3) steered = true;
  const lean = dt > 0 ? clamp((duck.x - was) / dt * .1, -.4, .4) : 0;
  duck.tilt = lerp(duck.tilt, lean, Math.min(1, dt * 10));
}

function collide() {
  if (duck.air > 0) return;
  for (const o of things) {
    if (o.hit) continue;
    if (o.kind === "ramp") { if (onRamp(duck.x, o)) return jump(o); }
    else if (bumps(duck.x, o)) {
      o.hit = true;
      if (duck.safe <= 0 && duck.grace <= 0) return bump(o);
    }
  }
}

function jump(o) {
  o.hit = true; o.hitAt = T;
  jumps++;
  duck.air = AIR;
  const x = sx(duck.x);
  sfx.boing(); sfx.whee();
  splash(x, L.duckY, 10);
  sparkle(x, L.duckY - L.u * .4, 10, .6);
  say("Wheee!");
}
function land() {
  duck.air = 0;
  duck.grace = .35;
  // never land on top of something and bump it
  for (const o of things) if (bumps(duck.x, o)) o.hit = true;
  splash(sx(duck.x), L.duckY + L.u * .1, 16);
  sfx.splash();
}
function bump(o) {
  o.hitAt = T;
  lives--;
  duck.hurt = .9; duck.safe = 1.8;
  shake = reduce ? 0 : .3;
  const x = sx(duck.x);
  sfx.bonk(); feathers(x, L.duckY); splash(x, L.duckY, 8);
  if (lives > 0) return say(pick(["Oops!", "Bonk!", "Uh oh!"]));
  setState("over");
  say("Splash!");
}
function milestone(m) {
  sfx.ding();
  sparkle(sx(duck.x), L.duckY - L.u * .6, 14, .7);
  say(`${m} metres!`);
}
function quackNow() {
  sfx.quack();
  duck.flap = 1;
  parts.push({ k: "ring", x: sx(duck.x), y: L.duckY, r: L.u * .3, life: .7 });
}

function update(dt) {
  shake = Math.max(0, shake - dt);
  duck.flap = Math.max(0, duck.flap - dt * 2.5);
  const P = pace(swimT);
  if (state === "swim" || state === "over") {
    const slow = state === "over" ? clamp(1 - (T - stateAt) / 1.2, 0, 1) : 1;
    speed = L.ahead / P.reach * slow;
  } else speed = .5;   // on the title and the score card the river just drifts by
  const step = speed * dt;
  scroll += step;
  for (const o of things) o.d -= step;
  things = things.filter(o => o.d > -L.behind - 1.5);

  if (state === "swim") {
    swimT += dt;
    metres += P.mps * dt;
    steer(dt);
    if ((untilRow -= step) <= 0) {
      for (const o of row(rnd, P.p, rows++)) things.push({ ...o, d: L.ahead + 1 + untilRow, seed: Math.random(), hit: false });
      untilRow += Math.max(2.2, speed * P.every);
    }
    collide();
    if (metres >= nextMark) { milestone(nextMark); nextMark += 100; }
    if (!hinted && !steered && swimT > 5) {
      hinted = true;
      say(touchy ? "Slide your finger to steer the duck!" : "Press the arrow keys to steer the duck!");
    }
  } else if (state === "over" && T - stateAt > 1.6) results();

  if (duck.air > 0 && (duck.air -= dt) <= 0) land();
  duck.hurt = Math.max(0, duck.hurt - dt);
  duck.safe = Math.max(0, duck.safe - dt);
  duck.grace = Math.max(0, duck.grace - dt);
  if (duck.air <= 0 && speed > 1 && (wakeIn -= dt) < 0) {
    wakeIn = .14;
    for (const side of [-1, 1]) parts.push({ k: "wake", x: sx(duck.x) + side * L.u * .16, y: L.duckY + L.u * .32, vx: side * L.u * .4, r: L.u * .08, life: .9 });
  }
  stepParts(dt);
}

// ---------- the score card ----------
function results() {
  const s = score(metres, jumps), m = Math.floor(metres), isBest = s > best;
  if (isBest) { best = s; save(); }
  setState("done");
  $("final").textContent = s;
  $("final-m").textContent = `${m} m`;
  $("final-j").textContent = plural(jumps, "jump");
  $("best").textContent = best;
  $("new-best").hidden = !isBest;
  $("results").hidden = false;
  const again = $("again");
  again.disabled = true;   // a moment's pause, so a tap meant for the duck doesn't skip the card
  setTimeout(() => { again.disabled = false; again.focus({ preventScroll: true }); }, 1000);
  jingle();
  if (isBest) {
    fanfare();
    for (let i = 0; i < 5; i++) setTimeout(() => sparkle(L.W * (.15 + Math.random() * .7), L.H * (.2 + Math.random() * .3), 18), 300 + i * 300);
  }
  say(`Hooray! You swam ${m} metres and did ${plural(jumps, "jump")}!${isBest ? " That's your best ever!" : ""}`);
}

function go() {
  newRun();
  setState("swim");
  sfx.quacks();
  say("Duck, duck, duck! Off we go!");
}

// ---------- input ----------
cv.addEventListener("pointerdown", e => {
  e.preventDefault();
  audio();
  if (finger) return;   // one finger steers at a time
  finger = { id: e.pointerId, x: e.clientX, at: T, dx: 0, travel: 0, slid: false };
  try { cv.setPointerCapture(e.pointerId); } catch {}
});
cv.addEventListener("pointermove", e => {
  if (!finger || e.pointerId !== finger.id) return;
  const dx = e.clientX - finger.x;
  finger.x = e.clientX;
  if (state === "swim") finger.dx += dx;
  if ((finger.travel += Math.abs(dx)) > 10) finger.slid = true;
});
function letGo(e) {
  if (!finger || e.pointerId !== finger.id) return;
  if (!finger.slid && T - finger.at < .3 && state === "swim") quackNow();   // a quick tap: quack!
  finger = null;
}
cv.addEventListener("pointerup", letGo);
cv.addEventListener("pointercancel", letGo);
cv.addEventListener("contextmenu", e => e.preventDefault());

const STEER_KEYS = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
document.addEventListener("keydown", e => {
  if (STEER_KEYS[e.key]) { e.preventDefault(); audio(); keys.add(STEER_KEYS[e.key]); return; }
  if (e.target instanceof HTMLButtonElement) return;
  if (state === "title" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); start(); }
  else if (state === "swim" && (e.key === " " || e.key === "ArrowUp")) { e.preventDefault(); if (!e.repeat) quackNow(); }
});
document.addEventListener("keyup", e => { if (STEER_KEYS[e.key]) keys.delete(STEER_KEYS[e.key]); });
addEventListener("blur", () => { keys.clear(); finger = null; });

// ---------- drawing ----------
function draw() {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (shake > 0) c.translate((Math.random() - .5) * shake * 30, (Math.random() - .5) * shake * 20);
  drawRiver(c, L, scroll, T);
  for (const o of things) {
    const y = sy(o.d);
    if (y > -L.u * 1.5 && y < L.H + L.u * 1.5) drawThing(c, o, sx(o.x), y, L.u, T);
  }
  drawParts(true);
  const x = sx(duck.x), a = duck.air > 0 ? 1 - duck.air / AIR : 0;
  drawDuck(c, x, L.duckY, L.u, {
    t: T,
    tilt: duck.tilt,
    lift: Math.sin(Math.PI * a),
    spin: reduce ? 0 : a * TAU + Math.sin(duck.hurt * 20) * duck.hurt * .5,
    flap: duck.air > 0 ? .5 + .5 * Math.sin(T * 24) : duck.flap,
    hurt: duck.hurt > 0,
    blink: T % 3.7 < .12,
    alpha: duck.safe > 0 && duck.hurt <= 0 && (T * 8 | 0) % 2 ? .5 : 1,
  });
  if (duck.hurt > 0) dizzy(x, L.duckY - L.u * .3);
  drawParts(false);
  if (state === "swim" && !steered) arrows(x);
}

// Stars going round the duck's head after a bump.
function dizzy(x, y) {
  for (let i = 0; i < 3; i++) {
    const a = T * 6 + i * TAU / 3;
    drawStar(c, x + Math.cos(a) * L.u * .32, y + Math.sin(a) * L.u * .12, L.u * .08, a, "#ffd23f");
  }
}

// Arrows either side of the duck until it has been steered, to show it goes side to side.
function arrows(x) {
  const u = L.u, y = L.duckY, push = Math.sin(((T * 1.5) % 1) * Math.PI) * u * .15;
  c.save();
  c.lineCap = c.lineJoin = "round";
  for (const side of [-1, 1]) {
    const ax = x + side * (u * .75 + push);
    c.beginPath(); c.moveTo(ax - side * u * .12, y - u * .2); c.lineTo(ax + side * u * .1, y); c.lineTo(ax - side * u * .12, y + u * .2);
    c.strokeStyle = INK; c.lineWidth = u * .14; c.stroke();
    c.strokeStyle = "#fff"; c.lineWidth = u * .08; c.stroke();
  }
  c.restore();
}

// ---------- the score, the jumps and the hearts ----------
const hearts = [...$("hearts").querySelectorAll("li")];
let hud = "";
function renderHud() {
  const s = score(metres, jumps), now = `${s}/${jumps}/${lives}`;
  if (now === hud) return;
  hud = now;
  $("score").textContent = s;
  $("jumps").textContent = jumps;
  hearts.forEach((li, i) => li.classList.toggle("lost", i >= lives));
  $("hearts").setAttribute("aria-label", plural(lives, "heart") + " left");
}

// ---------- the loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000);   // keeps time on slow devices, without leaping after a pause
  last = now; T += dt;
  update(dt);
  draw();
  renderHud();
  const dx = duck.x.toFixed(2);
  if (cv.dataset.duck !== dx) cv.dataset.duck = dx;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setState("title");

// ---------- title and buttons ----------
const titleCols = ["#ffd93b", "#ff9a2e", "#4fc3ff", "#ff6b9d"];
$("title").innerHTML = ["Duck", "Duck", "Duck"].map((word, j) => `<span class="word">${
  [...word].map((ch, i) => `<span aria-hidden="true" style="color:${titleCols[(i + j) % titleCols.length]};--i:${i + j * 4}">${ch}</span>`).join("")
}</span>`).join(" ");
if (best) { $("title-best").hidden = false; $("title-best-n").textContent = best; }

let lock;
async function wake() { try { lock = await navigator.wakeLock?.request("screen"); } catch {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && state !== "title") wake(); });

function start() {
  if (state !== "title") return;
  audio();
  $("title-screen").hidden = true;
  wake();
  cv.focus({ preventScroll: true });
  go();
}
$("title-screen").addEventListener("click", start);

$("again").addEventListener("click", () => {
  if (state !== "done") return;
  $("results").hidden = true;
  cv.focus({ preventScroll: true });
  go();
});

function setMuted(m) {
  muted = m; save();
  $("mute").setAttribute("aria-pressed", String(muted));
  $("mute").setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  $("wave").style.display = muted ? "none" : "";
  if (muted) try { speechSynthesis.cancel(); } catch {}
}
$("mute").addEventListener("click", () => setMuted(!muted));
setMuted(muted);

if (document.fullscreenEnabled) {
  $("full").hidden = false;
  $("full").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
}
