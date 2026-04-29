/**
 * Run with: node scripts/take-screenshots.js
 * Requires: npm install -g playwright && npx playwright install chromium
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE = 'http://localhost:8100';
const OUT  = path.join(__dirname, '..', 'screenshots');
const VIEWPORT = { width: 393, height: 852 }; // iPhone 14 Pro

// Use real Chrome + your existing Google session so sign-in works
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_PROFILE = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.waitForTimeout(1200);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('✓', name);
}

(async () => {
  const ctx = await chromium.launchPersistentContext(CHROME_PROFILE, {
    executablePath: CHROME_PATH,
    headless: false,
    slowMo: 100,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  const page = ctx.pages()[0] ?? await ctx.newPage();

  // 1 — Login screen (before sign in)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await shot(page, '1-login.png');

  // 2 — Onboarding slides (if visible)
  const nextBtn = page.locator('ion-button:has-text("Next"), button:has-text("Next")');
  if (await nextBtn.count()) {
    await shot(page, '2-onboarding-slide1.png');
    await nextBtn.first().click(); await page.waitForTimeout(600);
    await shot(page, '3-onboarding-slide2.png');
    if (await nextBtn.count()) {
      await nextBtn.first().click(); await page.waitForTimeout(600);
      await shot(page, '4-onboarding-slide3.png');
    }
  }

  // ── PAUSE: Sign in with Google in the browser window that just opened ──
  console.log('\n⏸  Please sign in with Google in the browser window.');
  console.log('   Once you can see the Today screen, come back here and press Enter.\n');
  await new Promise(resolve => process.stdin.once('data', resolve));
  process.stdin.resume();

  // 3 — Today (home)
  await page.goto(`${BASE}/tabs/today`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, '5-today.png');

  // 4 — Profiles list
  await page.goto(`${BASE}/tabs/profiles`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '6-profiles.png');

  // 5 — Settings
  await page.goto(`${BASE}/tabs/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '7-settings.png');

  // 6 — Caretaking list (if exists)
  await page.goto(`${BASE}/tabs/caretaking`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, '8-caretaking.png');

  await ctx.close();
  console.log('\n✅ All screenshots saved to:', OUT);
})();
