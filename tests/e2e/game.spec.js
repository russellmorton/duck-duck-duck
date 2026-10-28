import { test, expect } from "@playwright/test";
import { LANES, JUMP_POINTS } from "../../src/river.js";

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

const state = page => page.evaluate(() => document.body.dataset.state);
const duckX = page => page.locator("#river").evaluate(el => Number(el.dataset.duck));
const num = async loc => Number((await loc.textContent()).match(/\d+/)[0]);

// The seed makes the same things float down the river every time.
async function play(page, seed = 1) {
  await page.goto(`/?seed=${seed}`);
  await page.locator("#title-screen").click();
  await expect(page.locator("#title-screen")).toBeHidden();
  await expect.poll(() => state(page)).toBe("swim");
}

test("the title shows until you tap, then the duck sets off", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#title")).toHaveAttribute("aria-label", "Duck Duck Duck");
  await expect.poll(() => state(page)).toBe("title");
  await expect(page.locator("#title-best")).toBeHidden();
  await play(page);
  await expect(page.locator("#caption")).toHaveText("Duck, duck, duck! Off we go!");
  await expect(page.locator("#score")).toHaveText(/^\d+$/);
  await expect(page.locator("#hearts li:not(.lost)")).toHaveCount(3);
  expect(await duckX(page)).toBe((LANES - 1) / 2);
});

test("the arrow keys steer the duck, but not out of the river", async ({ page }) => {
  await play(page);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowLeft");
  expect(await duckX(page)).toBeLessThan(1.5);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1600);
  await page.keyboard.up("ArrowRight");
  const x = await duckX(page);
  expect(x).toBeGreaterThan(LANES - 1);
  expect(x).toBeLessThan(LANES - .5);
});

test("sliding a finger steers the duck", async ({ page, isMobile }) => {
  await play(page);
  const v = page.viewportSize(), y = v.height * .6, x0 = v.width / 2;
  if (isMobile) {
    // real touch events, the way a phone sends them
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    await touch("touchStart", x0);
    for (let i = 1; i <= 10; i++) { await touch("touchMove", x0 - i * 12); await page.waitForTimeout(16); }
    await touch("touchEnd");
  } else {
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x0 - 150, y, { steps: 10 });
    await page.mouse.up();
  }
  await expect.poll(() => duckX(page)).toBeLessThan(1.2);
});

test("the first thing down the river is a ramp, and the duck jumps it", async ({ page }) => {
  await play(page);
  await expect(page.locator("#jumps")).toHaveText("1", { timeout: 8000 });
  await expect(page.locator("#caption")).toHaveText("Wheee!");
  expect(await num(page.locator("#score"))).toBeGreaterThanOrEqual(JUMP_POINTS);
});

test("three bumps end the swim, the score adds up, and you can go again", async ({ page }) => {
  test.setTimeout(150_000);
  await play(page, 3);
  // left in the middle of the river, the duck soon bumps into things
  await expect(page.locator("#hearts li.lost")).toHaveCount(1, { timeout: 60_000 });
  await expect.poll(() => state(page), { timeout: 90_000 }).toBe("done");
  const card = page.getByRole("dialog", { name: "Hooray!" });
  await expect(card).toBeVisible();
  const final = await num(page.locator("#final")), m = await num(page.locator("#final-m")), j = await num(page.locator("#final-j"));
  expect(m).toBeGreaterThan(0);
  expect(final).toBe(m + j * JUMP_POINTS);
  await expect(page.locator("#score")).toHaveText(String(final));
  await expect(page.locator("#new-best")).toBeVisible();
  await expect(page.locator("#best")).toHaveText(String(final));
  await expect(page.locator("#caption")).toContainText(`Hooray! You swam ${m} metres`);

  const again = page.getByRole("button", { name: "Play again" });
  await expect(again).toBeEnabled();
  await expect(again).toBeFocused();
  await again.click({ force: true });   // it pulses, so it's never "stable"
  await expect.poll(() => state(page)).toBe("swim");
  await expect(card).toBeHidden();
  await expect(page.locator("#hearts li:not(.lost)")).toHaveCount(3);
  await expect(page.locator("#jumps")).toHaveText("0");

  // the best score is remembered
  await page.reload();
  await expect(page.locator("#title-best")).toBeVisible();
  await expect(page.locator("#title-best-n")).toHaveText(String(final));
});

test("sound can be turned off, and stays off", async ({ page }) => {
  await page.goto("/");
  const mute = page.locator("#mute");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveAttribute("aria-label", "Sound off");
  await page.reload();
  await expect(page.locator("#mute")).toHaveAttribute("aria-pressed", "true");
});

test("Enter starts the game from the title", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page)).toBe("swim");
});

test("nothing spills off the side of the screen", async ({ page }) => {
  await play(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  const hud = await page.locator(".hud").boundingBox();
  const right = await page.locator(".btns").boundingBox();
  expect(right.x + right.width).toBeLessThanOrEqual(hud.width);
  const stats = await page.locator(".pills").boundingBox();
  expect(stats.x + stats.width).toBeLessThan(right.x);
});
