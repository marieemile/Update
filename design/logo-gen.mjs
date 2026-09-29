// Run from any folder: `node design/logo-gen.mjs` writes the iteration SVGs and
// the final-*.svg assets into the current directory. Copy final-wordmark*.svg to
// public/wordmark*.svg and final-icon.svg to public/logo.svg to ship them.
// Daily Bite logo generator: letters are polygons on a 100-unit cap height.
// "wobble" nudges vertices deterministically for a hand-cut paper feel.
import fs from "node:fs";

const L = {
  D: { w: 86, outer: [[0,0],[58,0],[78,10],[86,32],[86,68],[78,90],[58,100],[0,100]], holes: [[[27,25],[50,25],[58,34],[58,66],[50,75],[27,75]]] },
  A: { w: 86, outer: [[24,0],[62,0],[86,100],[57,100],[53,82],[33,82],[29,100],[0,100]], holes: [[[37,60],[49,60],[43,28]]] },
  I: { w: 28, outer: [[0,0],[28,0],[28,100],[0,100]], holes: [] },
  L: { w: 66, outer: [[0,0],[28,0],[28,73],[66,73],[66,100],[0,100]], holes: [] },
  Y: { w: 86, outer: [[0,0],[31,0],[43,33],[55,0],[86,0],[57,58],[57,100],[29,100],[29,58]], holes: [] },
  B: { w: 88, outer: [[0,0],[54,0],[74,7],[83,24],[78,43],[88,57],[90,78],[80,94],[58,100],[0,100]], holes: [[[27,21],[48,21],[55,29],[49,38],[27,38]], [[27,58],[53,58],[61,68],[53,79],[27,79]]] },
  T: { w: 84, outer: [[0,0],[84,0],[84,27],[56,27],[56,100],[28,100],[28,27],[0,27]], holes: [] },
  E: { w: 74, outer: [[0,0],[72,0],[72,24],[28,24],[28,40],[64,40],[64,60],[28,60],[28,76],[74,76],[74,100],[0,100]], holes: [] },
};

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;

// Place a letter: x,y offset, sx/sy scale, rotation (deg), wobble amount.
function glyph(ch, { x, y, sx = 1, sy = 1, rot = 0, wob = 0 }) {
  const g = L[ch];
  const cx = (g.w * sx) / 2, cy = (100 * sy) / 2;
  const r = (rot * Math.PI) / 180;
  const tf = ([px, py]) => {
    let X = px * sx + rand() * wob, Y = py * sy + rand() * wob;
    const dx = X - cx, dy = Y - cy;
    return [x + cx + dx * Math.cos(r) - dy * Math.sin(r), y + cy + dx * Math.sin(r) + dy * Math.cos(r)];
  };
  const ring = (pts) => "M" + pts.map(tf).map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(" L") + " Z";
  return [ring(g.outer), ...g.holes.map(ring)].join(" ");
}

// Scalloped bite: a row of overlapping circles along an edge, cut via a mask.
// (cx, cy) sits just outside the letter's edge so the cut reads as teeth marks.
const bite = (cx, cy, r, n = 3, spread = 0.95) =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    return `<circle cx="${(cx + Math.abs(t) * r * 0.35).toFixed(1)}" cy="${(cy + t * r * 2 * spread).toFixed(1)}" r="${(r * (0.62 - Math.abs(t) * 0.1)).toFixed(1)}" fill="#000"/>`;
  }).join("");

// Corner bite: scallops laid along a diagonal across a letter's corner, like a
// bite out of a biscuit. dir = [dx, dy] points from the corner into the letter.
const cornerBite = (x, y, r, dir = [-1, 1], n = 3) => {
  const [dx, dy] = dir.map((v) => v / Math.hypot(...dir));
  const [px, py] = [dy, -dx];
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const cx = x + dx * r * 0.28 + px * t * r * 0.78, cy = y + dy * r * 0.28 + py * t * r * 0.78;
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * (0.5 - Math.abs(t) * 0.06)).toFixed(1)}" fill="#000"/>`;
  }).join("");
};

// Lay out a row of letters to an exact width: letters are scaled horizontally
// so every row lines up, like the Open Mouth block. Each spec: [char, {dy, sy, rot, wob, nest}].
function row(specs, { x, y, width, gap, h = 100 }) {
  const flow = specs.filter(([, o = {}]) => !o.nest);
  const natural = flow.reduce((n, [c, o = {}]) => n + L[c].w * (o.sx ?? 1), 0);
  const k = (width - gap * (flow.length - 1)) / natural;
  let cx = x;
  const out = [];
  for (const [c, o = {}] of specs) {
    if (o.nest) { out.push([c, { ...o, x: o.nest.x, y: o.nest.y, sx: o.nest.sx, sy: o.nest.sy }]); continue; }
    const sx = k * (o.sx ?? 1);
    const sy = (h / 100) * (o.sy ?? 1);
    out.push([c, { x: cx, y: y + (o.dy ?? 0), sx, sy, rot: o.rot ?? 0, wob: o.wob ?? 0 }]);
    o._x = cx; o._w = L[c].w * sx; o._y = y + (o.dy ?? 0); o._h = 100 * sy;
    cx += L[c].w * sx + gap;
  }
  return out;
}

function svg({ bg, rows, bites = [], w, h, round = 7, id, pad = 0 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}">
  <defs><mask id="m${id}"><rect x="${-pad}" y="${-pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" fill="#fff"/>${bites.join("")}</mask></defs>
  ${bg ? `<rect x="${-pad}" y="${-pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" rx="36" fill="${bg}"/>` : ""}
  <g mask="url(#m${id})" stroke-linejoin="round">
  ${rows.map(({ fill, parts }) => `<path fill-rule="evenodd" fill="${fill}" stroke="${fill}" stroke-width="${round}" d="${parts.map(([c, o]) => glyph(c, o)).join(" ")}"/>`).join("\n  ")}
  </g></svg>`;
}

const NAVY = "#0b1c30", COBALT = "#0066ff";
const W = 440, GAP = 8;

// 1. Cut paper: Open Mouth-style. Hand-cut wobble, uneven heights and tilts,
//    rows justified to the same width, a small I tucked under the T's arm,
//    and a bite out of the B. Navy on warm paper.
seed = 11;
{
  const B = ["B", { dy: 4, sy: 1.02, rot: 2, wob: 5 }];
  const T = ["T", { dy: -6, sy: 1.14, rot: 1, wob: 5, sx: 1.45 }];
  const top = row([["D", { dy: 2, sy: 1.04, rot: -3, wob: 5 }], ["A", { dy: 8, sy: 0.96, rot: 2, wob: 5 }], ["I", { dy: -4, sy: 1.1, rot: -2, wob: 4 }], ["L", { dy: 10, sy: 0.94, rot: 3, wob: 5 }], ["Y", { dy: -6, sy: 1.12, rot: -3, wob: 5 }]], { x: 0, y: 0, width: W, gap: GAP, h: 118 });
  const bot = row([B, T, ["E", { dy: 6, sy: 1.0, rot: -3, wob: 5 }]], { x: 0, y: 150, width: W, gap: GAP, h: 118 });
  // nest a small I under the T's left arm (the arm is ~27% of T height)
  const tb = T[1];
  const armH = tb._h * 0.3, stemX = tb._x + tb._w * (28 / 84);
  // leave a clear channel (~12 units) between the small I, the T's arm and its stem
  bot.splice(1, 0, ["I", { x: tb._x + 6, y: tb._y + armH + 14, sx: ((stemX - tb._x - 26) / 28), sy: (tb._h - armH - 18) / 100, rot: -4, wob: 3 }]);
  const b = B[1];
  const cut = svg({ id: 1, bg: "#f3ecdd", round: 9, w: W, h: 290, pad: 44, rows: [{ fill: NAVY, parts: [...top, ...bot] }],
    bites: [cornerBite(b._x + b._w * 0.86, b._y + 12, 40)] });
  fs.writeFileSync("1-cut-paper.svg", cut);
}

// 2. Clean block: a tidier take on the current logo. Straight edges, equal
//    spacing with no collisions, rows justified, DAILY navy / BITE cobalt,
//    and a clear bite out of the B.
seed = 3;
{
  const B = ["B", {}];
  const top = row([["D"], ["A"], ["I"], ["L"], ["Y"]], { x: 0, y: 0, width: W, gap: 10, h: 112 });
  const bot = row([B, ["I"], ["T"], ["E"]], { x: 0, y: 132, width: W, gap: 10, h: 112 });
  const b = B[1];
  const clean = svg({ id: 2, bg: "#f8f9ff", round: 4, w: W, h: 244, pad: 44, rows: [{ fill: NAVY, parts: top }, { fill: COBALT, parts: bot }],
    bites: [cornerBite(b._x + b._w * 0.86, b._y + 2, 38)] });
  fs.writeFileSync("2-clean-block.svg", clean);
}

// 3. Chomp: gently wobbly letters, cobalt on white, and one big bite out of
//    the wordmark's top-right corner (through the Y).
seed = 29;
{
  const Y = ["Y", { dy: -2, sy: 1.04, rot: -2, wob: 4 }];
  const top = row([["D", { rot: -2, wob: 4 }], ["A", { dy: 3, rot: 2, wob: 4 }], ["I", { dy: -2, rot: -1, wob: 3 }], ["L", { dy: 4, rot: 2, wob: 4 }], Y], { x: 0, y: 0, width: W, gap: 8, h: 116 });
  const bot = row([["B", { rot: 1, wob: 4 }], ["I", { dy: 2, rot: -2, wob: 3 }], ["T", { dy: -2, rot: 2, wob: 4 }], ["E", { dy: 2, rot: -2, wob: 4 }]], { x: 0, y: 134, width: W, gap: 8, h: 116 });
  const y = Y[1];
  const chomp = svg({ id: 3, bg: "#ffffff", round: 8, w: W, h: 250, pad: 44, rows: [{ fill: COBALT, parts: [...top, ...bot] }],
    bites: [cornerBite(y._x + y._w + 2, y._y + 2, 62, [-1, 1], 3)] });
  fs.writeFileSync("3-chomp.svg", chomp);
}
// App icons: the bitten B on a rounded square (navy/paper and cobalt/white).
for (const [name, bg, fill, wob, rnd] of [["icon-cut", "#f3ecdd", NAVY, 6, 10], ["icon-clean", "#0066ff", "#ffffff", 0, 5]]) {
  seed = 5;
  const B = ["B", { rot: wob ? 3 : 0, wob }];
  const parts = row([B], { x: 0, y: 0, width: 250, gap: 0, h: 280 });
  const b = B[1];
  fs.writeFileSync(`${name}.svg`, svg({ id: name, bg, round: rnd * 2.4, w: 250, h: 280, pad: 70, rows: [{ fill, parts }], bites: [cornerBite(b._x + b._w * 0.86, b._y + 10, 104)] })
    .replace(/rx="36"/, 'rx="96"'));
}
console.log("ok");

// ---- Final assets: cut-paper wordmark in the Cobalt Pulse palette ----
function cutWordmark(inkTop, inkBottom, id) {
  seed = 11;
  const B = ["B", { dy: 4, sy: 1.02, rot: 2, wob: 5 }];
  const T = ["T", { dy: -6, sy: 1.14, rot: 1, wob: 5, sx: 1.45 }];
  const top = row([["D", { dy: 2, sy: 1.04, rot: -3, wob: 5 }], ["A", { dy: 8, sy: 0.96, rot: 2, wob: 5 }], ["I", { dy: -4, sy: 1.1, rot: -2, wob: 4 }], ["L", { dy: 10, sy: 0.94, rot: 3, wob: 5 }], ["Y", { dy: -6, sy: 1.12, rot: -3, wob: 5 }]], { x: 0, y: 0, width: W, gap: GAP, h: 118 });
  const bot = row([B, T, ["E", { dy: 6, sy: 1.0, rot: -3, wob: 5 }]], { x: 0, y: 150, width: W, gap: GAP, h: 118 });
  const tb = T[1];
  const armH = tb._h * 0.3, stemX = tb._x + tb._w * (28 / 84);
  const small = ["I", { x: tb._x + 6, y: tb._y + armH + 14, sx: (stemX - tb._x - 26) / 28, sy: (tb._h - armH - 18) / 100, rot: -4, wob: 3 }];
  const b = B[1];
  // Tight viewBox (small pad for the rounded stroke and wobble) so it sits flush in the header.
  return svg({ id, round: 9, w: W, h: 290, pad: 14, rows: [{ fill: inkTop, parts: top }, { fill: inkBottom, parts: [bot[0], small, ...bot.slice(1)] }],
    bites: [cornerBite(b._x + b._w * 0.86, b._y + 12, 40)] });
}
fs.writeFileSync("final-wordmark.svg", cutWordmark("#0b1c30", "#0066ff", "w"));
fs.writeFileSync("final-wordmark-dark.svg", cutWordmark("#e8efff", "#3d86ff", "wd"));

// Square app icon / favicon: white bitten B on cobalt.
{
  seed = 5;
  const B = ["B", {}];
  const parts = row([B], { x: 0, y: 0, width: 232, gap: 0, h: 262 });
  const b = B[1];
  const S = 420, ox = (S - 232) / 2 - 6, oy = (S - 262) / 2;
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <defs><mask id="mi"><rect width="${S}" height="${S}" fill="#fff"/><g transform="translate(${ox} ${oy})">${cornerBite(b._x + b._w * 0.86, b._y + 10, 98)}</g></mask></defs>
  <rect width="${S}" height="${S}" rx="96" fill="#0066ff"/>
  <g mask="url(#mi)"><path transform="translate(${ox} ${oy})" fill-rule="evenodd" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round" d="${glyph("B", parts[0][1])}"/></g></svg>`;
  fs.writeFileSync("final-icon.svg", icon);
}
console.log("final assets ok");
