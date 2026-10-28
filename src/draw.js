// Canvas drawings: the river and its banks, the duck, and everything that floats down.
// The river is seen from above; the duck faces up the screen, swimming away from you.

const TAU = Math.PI * 2;
const INK = "#1d2b4f";
const line = u => Math.max(2, u * .035);

// A repeatable 0..1 from any number, so the banks look the same each time they scroll past.
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// A lumpy round shape, for rocks, bushes and treetops.
function blob(c, r, seed, n = 8) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, rr = r * (.82 + hash(seed * 31 + i) * .3);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * .9]);
  }
  const mid = i => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  c.beginPath();
  c.moveTo(...mid(0));
  for (let i = 1; i <= n; i++) c.quadraticCurveTo(pts[i % n][0], pts[i % n][1], ...mid(i));
  c.closePath();
}

export function drawStar(c, x, y, r, rot, col) {
  c.save();
  c.translate(x, y); c.rotate(rot);
  c.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .45 : r, a = i * Math.PI / 5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = col; c.fill();
  c.restore();
}

// ---------- the river and its banks ----------
const TILE = 1.4;   // lanes of bank per scenery slot

export function drawRiver(c, L, scroll, T) {
  const { W, H, u, left, right, rw, duckY } = L;
  const at = y => scroll + (duckY - y) / u;          // screen y → lanes along the river
  const yOf = w => duckY - (w - scroll) * u;         // and back
  const edge = (w, side) => (side < 0 ? left : right) + (Math.sin(w * 1.9 + side) * .05 + Math.sin(w * .63 + side * 2) * .05) * u;

  c.fillStyle = "#74c14d";
  c.fillRect(0, 0, W, H);

  const shore = side => { const pts = []; for (let y = -12; y <= H + 24; y += 12) pts.push([edge(at(y), side), y]); return pts; };
  const lft = shore(-1), rgt = shore(1);
  const trace = (pts, join) => pts.forEach(([x, y], i) => i || join ? c.lineTo(x, y) : c.moveTo(x, y));
  c.lineJoin = c.lineCap = "round";
  // sand along the water's edge
  c.strokeStyle = "#f2d78a"; c.lineWidth = u * .34;
  for (const pts of [lft, rgt]) { c.beginPath(); trace(pts); c.stroke(); }
  // the water
  const g = c.createLinearGradient(left, 0, right, 0);
  g.addColorStop(0, "#66c8f6"); g.addColorStop(.5, "#3aa3e6"); g.addColorStop(1, "#66c8f6");
  c.fillStyle = g;
  c.beginPath(); trace(lft); trace(rgt.slice().reverse(), true); c.closePath(); c.fill();
  c.strokeStyle = "rgba(220,245,255,.9)"; c.lineWidth = Math.max(3, u * .06);
  for (const pts of [lft, rgt]) { c.beginPath(); trace(pts); c.stroke(); }

  // ripples on the water
  c.strokeStyle = "#fff"; c.lineWidth = Math.max(1.5, u * .03);
  for (let i = Math.floor(at(H + 20) / .7); i <= Math.ceil(at(-20) / .7); i++) {
    const x = left + (.08 + .84 * hash(i * 3.1 + .5)) * rw, y = yOf((i + hash(i * 7.7 + 1.3)) * .7);
    const len = u * (.16 + .14 * hash(i * 1.9));
    c.globalAlpha = .35 + .2 * Math.sin(T * 2 + i);
    c.beginPath(); c.moveTo(x - len, y); c.quadraticCurveTo(x, y - len * .5, x + len, y); c.stroke();
  }
  c.globalAlpha = 1;

  // things on the banks, set back from the water so they never cover it
  const room = left;
  for (let i = Math.floor(at(H + u * 2) / TILE); i <= Math.ceil(at(-u * 2) / TILE); i++) for (const side of [-1, 1]) {
    const h = n => hash(i * 17.3 + side * 5.1 + n * 1.7);
    const y = yOf((i + h(1)) * TILE), what = h(3);
    const place = r => { const back = r + u * .2 + h(2) * Math.max(0, room - 2 * r - u * .4); return side < 0 ? left - back : right + back; };
    const big = u * (.45 + h(4) * .25), small = u * .22;
    if (what < .35 && room > 2 * big + u * .3) tree(c, place(big), y, big, h(5));
    else if (what < .55 && room > 2 * small + u * .4) bush(c, place(small * 1.3), y, small * 1.3, h(5));
    else if (what < .8 && room > 2 * small + u * .3) flowers(c, place(small), y, small, h(5));
    else if (room > u * .5) tuft(c, place(small * .6), y, small * .6);
    if (h(6) < .45) {
      const w = (i + h(7)) * TILE;
      reeds(c, edge(w, side) + side * u * .1, yOf(w), u * .3, T, h(8));
    }
  }
}

function tree(c, x, y, r, h) {
  c.save(); c.translate(x, y);
  c.fillStyle = "rgba(30,70,20,.25)"; c.beginPath(); c.arc(r * .2, r * .3, r, 0, TAU); c.fill();
  blob(c, r, h * 100, 9);
  c.fillStyle = "#3f9a3a"; c.fill(); c.strokeStyle = INK; c.lineWidth = Math.max(2, r * .07); c.stroke();
  c.translate(-r * .25, -r * .25); blob(c, r * .5, h * 100 + 5, 7); c.fillStyle = "#5cb84a"; c.fill();
  if (h > .55) {
    c.fillStyle = "#ff5a4e";
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(Math.cos(k * 1.7 + h * 9) * r * .55 + r * .25, Math.sin(k * 1.7 + h * 9) * r * .5 + r * .25, r * .1, 0, TAU); c.fill(); }
  }
  c.restore();
}
function bush(c, x, y, r, h) {
  c.save(); c.translate(x, y);
  blob(c, r, h * 50, 7);
  c.fillStyle = "#4fa844"; c.fill(); c.strokeStyle = INK; c.lineWidth = Math.max(1.5, r * .1); c.stroke();
  c.translate(-r * .2, -r * .25); blob(c, r * .45, h * 50 + 3, 6); c.fillStyle = "#6cc35a"; c.fill();
  c.restore();
}
function flowers(c, x, y, s, h) {
  const cols = ["#ff6b9d", "#ffffff", "#ffd23f", "#b48cff"];
  for (let k = 0; k < 3; k++) {
    const fx = x + (hash(h * 9 + k) - .5) * s * 2, fy = y + (hash(h * 7 + k * 3) - .5) * s * 1.6, r = s * .28;
    c.fillStyle = cols[(k + (h * 4 | 0)) % cols.length];
    for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; c.beginPath(); c.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * .75, 0, TAU); c.fill(); }
    c.fillStyle = "#ffb000"; c.beginPath(); c.arc(fx, fy, r * .6, 0, TAU); c.fill();
  }
}
function tuft(c, x, y, s) {
  c.strokeStyle = "#4e9e36"; c.lineWidth = Math.max(1.5, s * .18); c.lineCap = "round";
  c.beginPath();
  for (const dx of [-.5, 0, .5]) { c.moveTo(x + dx * s * .6, y + s * .3); c.lineTo(x + dx * s * 1.2, y - s * .5); }
  c.stroke();
}
function reeds(c, x, y, s, T, h) {
  c.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    const bx = x + (k - 1) * s * .3, sway = Math.sin(T * 1.6 + h * 10 + k) * s * .08, top = y - s * (.7 + hash(h * 5 + k) * .4);
    c.strokeStyle = "#3f8f2f"; c.lineWidth = Math.max(1.5, s * .1);
    c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx, (y + top) / 2, bx + sway, top); c.stroke();
    c.fillStyle = "#8a5a2b"; c.beginPath(); c.ellipse(bx + sway, top + s * .12, s * .08, s * .2, 0, 0, TAU); c.fill();
  }
}

// ---------- things in the river ----------
// White water swirling round whatever is sticking out of the river.
function foam(c, rx, ry, T) {
  c.save();
  c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = Math.max(2, ry * .12); c.lineCap = "round";
  c.setLineDash([ry * .35, ry * .25]); c.lineDashOffset = -T * ry;
  c.beginPath(); c.ellipse(0, ry * .1, rx * (1.15 + Math.sin(T * 3) * .03), ry * 1.18, 0, 0, TAU); c.stroke();
  c.restore();
}

// o: { kind, seed, hit, hitAt }. Something that has just been bumped wobbles for a moment.
export function drawThing(c, o, x, y, u, T) {
  const wob = o.hitAt != null && o.kind !== "ramp" ? Math.max(0, 1 - (T - o.hitAt) / .6) : 0;
  c.save();
  c.translate(x + Math.sin(T * 40) * wob * u * .06, y);
  c.lineJoin = "round"; c.lineCap = "round";
  if (o.kind === "rock") rock(c, u, o.seed, T);
  else if (o.kind === "log") log(c, u, o.seed, T);
  else if (o.kind === "hippo") hippo(c, u, T + o.seed * 9, o.hitAt != null);
  else ramp(c, u, T, o.hit);
  c.restore();
}

function rock(c, u, seed, T) {
  const r = u * .34;
  foam(c, r, r * .9, T);
  blob(c, r, seed * 1000, 9);
  c.fillStyle = "#98a3b6"; c.fill(); c.strokeStyle = INK; c.lineWidth = line(u); c.stroke();
  c.save(); c.translate(-r * .22, -r * .25); blob(c, r * .42, seed * 1000 + 3, 7); c.fillStyle = "#c8d0dd"; c.fill(); c.restore();
  c.fillStyle = "#6fae4a"; c.beginPath(); c.ellipse(r * .35, r * .32, r * .22, r * .12, .4, 0, TAU); c.fill();
}

function log(c, u, seed, T) {
  const len = u * 1.55, th = u * .38;
  foam(c, len * .5, th * .72, T);
  c.lineWidth = line(u); c.strokeStyle = INK;
  c.beginPath(); c.roundRect(-len / 2, -th / 2, len, th, th * .3); c.fillStyle = "#a3683a"; c.fill(); c.stroke();
  c.strokeStyle = "#7a4a26"; c.lineWidth = line(u) * .8;
  for (const [k, y] of [[0, -.22], [1, 0], [2, .22]]) {
    const a = -.36 + hash(seed * 50 + k) * .2;
    c.beginPath(); c.moveTo(len * a, th * y); c.lineTo(len * (a + .3 + hash(seed * 70 + k) * .2), th * y); c.stroke();
  }
  for (const side of [-1, 1]) {
    c.beginPath(); c.ellipse(side * len / 2, 0, th * .22, th * .5, 0, 0, TAU);
    c.fillStyle = "#f0cf98"; c.fill(); c.strokeStyle = INK; c.lineWidth = line(u); c.stroke();
    c.beginPath(); c.ellipse(side * len / 2, 0, th * .1, th * .26, 0, 0, TAU); c.strokeStyle = "#c9995a"; c.lineWidth = line(u) * .7; c.stroke();
  }
  // a little leaf growing out of the log
  c.save(); c.translate(len * .12, -th * .5); c.rotate(-.6);
  c.beginPath(); c.ellipse(0, -th * .18, th * .1, th * .2, 0, 0, TAU); c.fillStyle = "#6cc35a"; c.fill(); c.strokeStyle = INK; c.lineWidth = line(u) * .6; c.stroke();
  c.restore();
}

// A sleepy hippo with just its head out of the water. Bump it and it wakes up.
function hippo(c, u, t, awake) {
  const s = u * .36, body = "#a596dc";
  foam(c, s * 1.05, s * 1.05, t);
  c.translate(0, Math.sin(t * 2) * s * .04);
  c.lineWidth = line(u); c.strokeStyle = INK;
  for (const side of [-1, 1]) {
    c.beginPath(); c.ellipse(side * s * .55, -s * .78, s * .17, s * .2, 0, 0, TAU); c.fillStyle = body; c.fill(); c.stroke();
    c.beginPath(); c.ellipse(side * s * .55, -s * .76, s * .08, s * .1, 0, 0, TAU); c.fillStyle = "#ff9cc0"; c.fill();
  }
  c.beginPath(); c.ellipse(0, -s * .25, s * .72, s * .62, 0, 0, TAU); c.fillStyle = body; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, s * .38, s * .88, s * .5, 0, 0, TAU); c.fillStyle = "#bfb2ee"; c.fill(); c.stroke();
  c.fillStyle = INK;
  for (const side of [-1, 1]) { c.beginPath(); c.ellipse(side * s * .32, s * .38, s * .09, s * .12, 0, 0, TAU); c.fill(); }
  for (const side of [-1, 1]) {
    const ex = side * s * .32, ey = -s * .35;
    if (awake) {
      c.beginPath(); c.arc(ex, ey, s * .17, 0, TAU); c.fillStyle = "#fff"; c.fill(); c.stroke();
      c.beginPath(); c.arc(ex, ey + s * .03, s * .08, 0, TAU); c.fillStyle = INK; c.fill();
    } else {
      c.beginPath(); c.arc(ex, ey, s * .13, .15 * Math.PI, .85 * Math.PI); c.stroke();
    }
  }
  if (!awake) {
    c.fillStyle = "#fff"; c.strokeStyle = INK; c.lineWidth = Math.max(1.5, s * .05);
    for (const k of [0, .5]) {
      const p = (t * .5 + k) % 1;
      c.globalAlpha = 1 - p;
      c.font = `800 ${s * (.4 + p * .25)}px "Baloo 2", system-ui, sans-serif`;
      c.strokeText("z", s * .75 + p * s * .4, -s * .9 - p * s * .8);
      c.fillText("z", s * .75 + p * s * .4, -s * .9 - p * s * .8);
    }
    c.globalAlpha = 1;
  }
}

// A floating wooden ramp, lower end towards the duck, with a glow round it so it's easy to spot.
function ramp(c, u, T, used) {
  const w = u * .8, h = u * .95, top = -h / 2, bot = h / 2;
  c.translate(0, Math.sin(T * 3) * u * .015);
  if (!used) {
    const p = (T * .9) % 1;
    c.save();
    c.globalAlpha = .6 * (1 - p); c.strokeStyle = "#fff6a0"; c.lineWidth = u * .06;
    c.beginPath(); c.ellipse(0, 0, w * (.65 + p * .35), h * (.6 + p * .35), 0, 0, TAU); c.stroke();
    c.restore();
  }
  // its shadow on the water, cast by the raised far end
  c.fillStyle = "rgba(20,60,110,.28)";
  c.beginPath(); c.moveTo(-w * .45, bot); c.lineTo(w * .45, bot); c.lineTo(w * .5 + u * .14, top + u * .1); c.lineTo(-w * .5 + u * .14, top + u * .1); c.closePath(); c.fill();
  // the deck
  const g = c.createLinearGradient(0, bot, 0, top);
  g.addColorStop(0, "#ffb347"); g.addColorStop(1, "#ffe08f");
  c.beginPath(); c.moveTo(-w * .45, bot); c.lineTo(w * .45, bot); c.lineTo(w * .5, top); c.lineTo(-w * .5, top); c.closePath();
  c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = line(u); c.stroke();
  c.strokeStyle = "#d98a2b"; c.lineWidth = line(u) * .7;
  for (let k = 1; k < 5; k++) { const y = bot - h * k / 5, ww = w * (.45 + .05 * k / 5); c.beginPath(); c.moveTo(-ww, y); c.lineTo(ww, y); c.stroke(); }
  // arrows pointing the way
  for (const y of [h * .18, -h * .16]) {
    c.beginPath(); c.moveTo(-w * .22, y + u * .09); c.lineTo(0, y - u * .07); c.lineTo(w * .22, y + u * .09);
    c.strokeStyle = "#fff"; c.lineWidth = u * .11; c.stroke();
    c.strokeStyle = "#e8412c"; c.lineWidth = u * .06; c.stroke();
  }
  // the lip at the top, and floats at the bottom corners
  c.beginPath(); c.roundRect(-w * .52, top - u * .06, w * 1.04, u * .1, u * .03); c.fillStyle = "#c4681c"; c.fill(); c.strokeStyle = INK; c.lineWidth = line(u); c.stroke();
  for (const side of [-1, 1]) {
    c.beginPath(); c.arc(side * w * .47, bot - u * .02, u * .085, 0, TAU); c.fillStyle = "#ff5a4e"; c.fill(); c.stroke();
    c.beginPath(); c.arc(side * w * .47, bot - u * .02, u * .035, 0, TAU); c.fillStyle = "#fff"; c.fill();
  }
}

// ---------- the duck ----------
// o: { t, tilt, lift (0 on the water, 1 at the top of a jump), spin, flap (0..1), hurt, blink, alpha }
export function drawDuck(c, x, y, u, o = {}) {
  const s = u * .62, lift = o.lift || 0, k = 1 + lift * .55, Y = "#ffd93b", WING = "#f5b800";
  c.save();
  if (lift > 0) {
    const sh = 1 - lift * .25;
    c.fillStyle = "rgba(20,60,110,.3)";
    c.beginPath(); c.ellipse(x + lift * u * .18, y + s * .15, s * .48 * sh, s * .55 * sh, 0, 0, TAU); c.fill();
  } else {
    c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = Math.max(2, s * .05);
    c.beginPath(); c.ellipse(x, y + s * .2, s * (.62 + Math.sin(o.t * 4) * .03), s * .6, 0, 0, TAU); c.stroke();
  }
  c.translate(x, y - lift * u * .4);
  c.rotate((o.tilt || 0) + (o.spin || 0));
  c.scale(k, k);
  c.globalAlpha = o.alpha ?? 1;
  c.lineWidth = line(u); c.strokeStyle = INK; c.lineJoin = "round"; c.lineCap = "round";
  // tail
  c.beginPath(); c.moveTo(-s * .2, s * .55); c.quadraticCurveTo(0, s * 1.02, s * .2, s * .55); c.fillStyle = Y; c.fill(); c.stroke();
  // wings
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * s * .36, s * .12); c.rotate(side * (.2 + (o.flap || 0) * 1.1));
    c.beginPath(); c.ellipse(side * s * .1, s * .05, s * .17, s * .34, 0, 0, TAU); c.fillStyle = WING; c.fill(); c.stroke();
    c.restore();
  }
  // body
  c.beginPath(); c.ellipse(0, s * .18, s * .46, s * .54, 0, 0, TAU); c.fillStyle = Y; c.fill(); c.stroke();
  // beak, then the head over its root
  c.beginPath(); c.ellipse(0, -s * .7, s * .17, s * .12, 0, 0, TAU); c.fillStyle = "#ff8a1f"; c.fill(); c.stroke();
  c.beginPath(); c.arc(0, -s * .36, s * .32, 0, TAU); c.fillStyle = Y; c.fill(); c.stroke();
  // eyes
  for (const side of [-1, 1]) {
    const ex = side * s * .13, ey = -s * .44, r = s * .075;
    if (o.hurt) {
      c.lineWidth = line(u) * .8;
      c.beginPath(); c.moveTo(ex - r, ey - r); c.lineTo(ex + r, ey + r); c.moveTo(ex + r, ey - r); c.lineTo(ex - r, ey + r); c.stroke();
    } else if (o.blink) {
      c.lineWidth = line(u) * .8;
      c.beginPath(); c.moveTo(ex - r, ey); c.lineTo(ex + r, ey); c.stroke();
    } else {
      c.fillStyle = INK; c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fill();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(ex - r * .3, ey - r * .35, r * .35, 0, TAU); c.fill();
    }
  }
  c.fillStyle = "rgba(255,120,150,.6)";
  for (const side of [-1, 1]) { c.beginPath(); c.arc(side * s * .24, -s * .3, s * .055, 0, TAU); c.fill(); }
  c.restore();
}
