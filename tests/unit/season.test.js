import { test } from "node:test";
import assert from "node:assert/strict";
import { christmas } from "../../src/season.js";

const day = (m, d) => new Date(2026, m - 1, d, 12);

test("Christmas comes by itself from 1 December to 6 January", () => {
  for (const [m, d] of [[12, 1], [12, 24], [12, 25], [12, 31], [1, 1], [1, 6]]) assert.equal(christmas(day(m, d)), true, `${d}/${m}`);
  for (const [m, d] of [[11, 30], [1, 7], [2, 1], [7, 4], [11, 4]]) assert.equal(christmas(day(m, d)), false, `${d}/${m}`);
});

test("?christmas=1 turns it on any day, and ?christmas=0 turns it off", () => {
  assert.equal(christmas(day(7, 4), "?christmas=1"), true);
  assert.equal(christmas(day(12, 25), "?christmas=0"), false);
  assert.equal(christmas(day(12, 25), "?seed=3&christmas=0"), false);
  assert.equal(christmas(day(7, 4), "?seed=3"), false);
  assert.equal(christmas(day(12, 25), "?christmas=maybe"), true);
});

test("the grown-ups' switch beats the date, and the address beats the switch", () => {
  assert.equal(christmas(day(7, 4), "", true), true);
  assert.equal(christmas(day(12, 25), "", false), false);
  assert.equal(christmas(day(12, 25), "", null), true);
  assert.equal(christmas(day(7, 4), "?christmas=0", true), false);
  assert.equal(christmas(day(12, 25), "?christmas=1", false), true);
});
