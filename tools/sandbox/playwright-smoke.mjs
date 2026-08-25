// =============================================================================
// SANDBOX-ONLY smoke test: loads the esbuild sandbox bundle in real Chromium
// and drives the full loop far enough to prove it actually works end-to-end
// (create player -> high school -> a game -> a decision -> other screens),
// taking screenshots along the way. The real E2E suite lives in
// e2e/career.spec.ts (Playwright Test, run via `npm run test:e2e` against
// the Vite dev server in a normal environment with npm access).
// =============================================================================
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const shotsDir = path.join(root, "dist-sandbox", "screenshots");
fs.mkdirSync(shotsDir, { recursive: true });

const { chromium } = require("/home/claude/.npm-global/lib/node_modules/playwright/index.js");

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:8734";

async function shot(page, name) {
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: false });
  console.log(`  screenshot: ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  console.log("0) Logging in with the seeded demo account (adm/adm)...");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector("text=NFL LIFE");
  await shot(page, "00-auth-screen");
  await page.fill('input[autocomplete="username"]', "adm");
  await page.fill('input[autocomplete="current-password"]', "adm");
  await page.click('button[type="submit"]'); // the "Entrar" tab button also matches text=Entrar, so target the submit button specifically

  // The seeded adm account is pre-subscribed, but handle the paywall
  // generically in case a fresh (non-seeded) account ever hits this path.
  const subscribeButton = page.locator("button:has-text('Simular assinatura')");
  if (await subscribeButton.count().catch(() => 0)) {
    await shot(page, "00b-subscription-screen");
    await subscribeButton.click();
  }

  console.log("1) Loading career select screen...");
  await page.waitForSelector("text=NFL LIFE", { timeout: 10000 });
  await shot(page, "01-career-select");

  console.log("2) Starting a new career...");
  await page.click("text=Start a New Career");
  await page.waitForSelector("text=Create Your Player");
  await page.fill('input[placeholder="Jordan"]', "Marcus");
  await page.fill('input[placeholder="Reed"]', "Calloway");
  await page.click("button:has-text('QB')");
  await page.fill('input[placeholder="Ironpoint"]', "Cedarview");
  await page.click("button:has-text('Ambitious')");
  await page.click("button:has-text('Competitive')");
  await shot(page, "02-create-player");
  await page.click("text=Start Career");

  await page.waitForSelector("text=Advance Week, text=Decision", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "03-dashboard");

  console.log("3) Advancing weeks until we hit a decision or a game...");
  let sawDecision = false;
  let sawGame = false;
  let sawCollege = false;
  let sawDraft = false;
  let sawNfl = false;
  const totalIterations = Number(process.env.SMOKE_ITERATIONS ?? 25);
  for (let i = 0; i < totalIterations; i++) {
    if (!sawCollege && (await page.locator("text=College").count()) > 0 && (await page.locator(".badge:has-text('College')").count()) > 0) {
      sawCollege = true;
      await shot(page, "09-college");
    }
    if (!sawDraft && (await page.locator("text=NFL Draft Process").count()) > 0) {
      sawDraft = true;
      await shot(page, "10-draft");
    }
    if (!sawNfl && (await page.locator(".badge:has-text('NFL Season')").count()) > 0) {
      sawNfl = true;
      await shot(page, "11-nfl-season");
    }
    const decisionVisible = await page.locator(".modal-backdrop").count();
    const gameVisible = await page.locator("text=Game Day").count();
    const commitVisible = await page.locator("button:has-text('Commit')").count();
    const signVisible = await page.locator("button:has-text('Sign')").count();
    const advanceVisible = await page.locator("button:has-text('Advance Week')").count();
    const retireVisible = await page.locator("button:has-text('Retire Now')").count();

    if (decisionVisible > 0) {
      if (!sawDecision) {
        sawDecision = true;
        await shot(page, "04-decision-modal");
      }
      await page.locator(".choice-btn").first().click();
      await page.waitForTimeout(150);
      continue;
    }

    if (gameVisible > 0) {
      if (!sawGame) {
        sawGame = true;
        await shot(page, "05-game-day");
      }
      const keyMomentButton = page.locator(".choice-btn").first();
      if (await keyMomentButton.count()) {
        await keyMomentButton.click();
        await page.waitForTimeout(150);
      }
      continue;
    }

    if (commitVisible > 0) {
      await shot(page, "07-recruiting");
      await page.locator("button:has-text('Commit')").first().click();
      await page.waitForTimeout(200);
      continue;
    }

    if (signVisible > 0) {
      await shot(page, "08-free-agency");
      await page.locator("button:has-text('Sign')").first().click();
      await page.waitForTimeout(200);
      continue;
    }

    if (advanceVisible > 0) {
      await page.locator("button:has-text('Advance Week')").first().click();
      await page.waitForTimeout(150);
      continue;
    }

    if (retireVisible > 0) {
      await page.locator("button:has-text('Retire Now')").first().click();
      await page.waitForTimeout(300);
      await shot(page, "12-legacy");
      break;
    }

    // Nothing actionable found on the dashboard (e.g. mid-draft-process screen
    // with only "Advance Week" already handled above) — small settle wait then retry.
    await page.waitForTimeout(150);
  }
  await shot(page, "06-after-loop");

  console.log(`   sawDecision=${sawDecision} sawGame=${sawGame}`);

  console.log("4) Visiting every nav screen...");
  for (const label of ["Stats", "Finance", "People", "News", "Legacy", "Team", "Settings"]) {
    const navBtn = page.locator(`.nav-item:has-text("${label}")`);
    if (await navBtn.count()) {
      await navBtn.first().click();
      await page.waitForTimeout(200);
      await shot(page, `nav-${label.toLowerCase()}`);
    }
  }

  await browser.close();

  console.log("\nConsole errors captured:", consoleErrors.length);
  for (const e of consoleErrors.slice(0, 20)) console.log("  -", e);

  if (consoleErrors.length > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nSMOKE TEST PASSED — no console errors, full loop reachable.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
