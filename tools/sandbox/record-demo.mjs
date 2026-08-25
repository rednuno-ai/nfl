// =============================================================================
// SANDBOX-ONLY: records real gameplay footage (login -> create player ->
// weekly decisions -> a Game Day key moment -> recruiting) with Playwright's
// built-in video recorder, for use as the homepage demo video (public/demo.webm).
// =============================================================================
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const recordDir = path.join(root, "dist-sandbox", "recording");
fs.mkdirSync(recordDir, { recursive: true });

const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright/index.js");

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:8734";
const VIEWPORT = { width: 1280, height: 800 };

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: recordDir, size: VIEWPORT } });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("text=NFL LIFE");
  await page.waitForTimeout(1200);

  await page.fill('input[autocomplete="username"]', "adm");
  await page.fill('input[autocomplete="current-password"]', "adm");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Start a New Career", { timeout: 10000 });
  await page.waitForTimeout(800);

  await page.click("text=Start a New Career");
  await page.waitForSelector("text=Create Your Player");
  await page.waitForTimeout(500);
  await page.fill('input[placeholder="Jordan"]', "Marcus");
  await page.fill('input[placeholder="Reed"]', "Calloway");
  await page.click("button:has-text('QB')");
  await page.fill('input[placeholder="Ironpoint"]', "Cedarview");
  await page.click("button:has-text('Ambitious')");
  await page.click("button:has-text('Competitive')");
  await page.waitForTimeout(700);
  await page.click("text=Start Career");
  await page.waitForTimeout(1000);

  // Walk forward a handful of weeks, pausing on anything interactive long
  // enough for a viewer to read it, so the recording actually shows the
  // decision -> execution -> consequence loop instead of a blur of clicks.
  for (let i = 0; i < 14; i++) {
    const modalBackdrop = page.locator(".modal-backdrop");
    const advanceBtn = page.locator("button:has-text('Advance Week')");
    const commitBtn = page.locator("button:has-text('Commit')");

    if (await modalBackdrop.count()) {
      await page.waitForTimeout(1400);
      await page.locator(".choice-btn").first().click();
      await page.waitForTimeout(900);
      continue;
    }
    if (await commitBtn.count()) {
      await page.waitForTimeout(1200);
      await commitBtn.first().click();
      await page.waitForTimeout(1200);
      continue;
    }
    if (await advanceBtn.count()) {
      await advanceBtn.first().click();
      await page.waitForTimeout(500);
      continue;
    }
    await page.waitForTimeout(400);
  }

  await page.waitForTimeout(1000);
  await context.close();
  await browser.close();

  // Playwright names the file by an internal id; find the newest .webm and
  // move it to a predictable path.
  const files = fs.readdirSync(recordDir).filter((f) => f.endsWith(".webm"));
  const newest = files
    .map((f) => ({ f, t: fs.statSync(path.join(recordDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0];
  if (!newest) throw new Error("No recording produced.");

  const publicDir = path.join(root, "public");
  fs.mkdirSync(publicDir, { recursive: true });
  const dest = path.join(publicDir, "demo.webm");
  fs.copyFileSync(path.join(recordDir, newest.f), dest);
  console.log(`Demo video written to ${dest} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
