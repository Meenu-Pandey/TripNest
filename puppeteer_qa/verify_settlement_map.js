const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\0121784d-f2cc-4fcf-918f-425b4d49e040';
const BASE_URL = 'http://localhost:3000';

const VIEWPORTS = [
  { width: 1440, height: 900, name: '1440x900_desktop' },
  { width: 1024, height: 768, name: '1024x768_tablet_land' },
  { width: 768, height: 1024, name: '768x1024_tablet_port' },
  { width: 412, height: 924, name: '412x924_mobile_large' },
  { width: 390, height: 844, name: '390x844_mobile_medium' },
  { width: 360, height: 800, name: '360x800_mobile_small' },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(page, name) {
  const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Saved screenshot: ${filePath}`);
}

async function getLayoutMetrics(page) {
  return await page.evaluate(() => {
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

(async () => {
  console.log('Launching browser for Settlement & Map QA...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(`[Console Error] ${msg.text()}`);
  });
  page.on('requestfailed', (req) => {
    networkErrors.push(`[Network Failure] ${req.url()} - ${req.failure()?.errorText}`);
  });

  // Login as Arjun
  console.log('Logging in as qa.arjun@tripnest.test...');
  await page.setViewport(VIEWPORTS[0]);
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'qa.arjun@tripnest.test');
    await page.type('input[type="password"]', 'demo-password-not-for-real-use');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);
    console.log('Login successful');
  } catch (err) {
    console.error('Login failed:', err);
    await capture(page, 'qa_login_error');
    process.exit(1);
  }

  // Navigate to trips list and find "Summer in Ladakh QA"
  await page.goto(`${BASE_URL}/trips`, { waitUntil: 'networkidle0' });
  await delay(1000);

  const tripLinks = await page.$$('a[href^="/trips/"]');
  let ladakhTripUrl = null;

  for (const link of tripLinks) {
    const href = await page.evaluate((el) => el.getAttribute('href'), link);
    const text = await page.evaluate((el) => el.textContent, link);
    if (text && text.includes('Summer in Ladakh QA')) {
      ladakhTripUrl = `${BASE_URL}${href}`;
      break;
    }
  }

  if (!ladakhTripUrl && tripLinks.length > 0) {
    const firstHref = await page.evaluate((el) => el.getAttribute('href'), tripLinks[0]);
    ladakhTripUrl = `${BASE_URL}${firstHref}`;
  }

  console.log(`Testing Ladakh QA Trip URL: ${ladakhTripUrl}`);

  const viewportMetrics = {};

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport ${vp.name} (${vp.width}x${vp.height}) ---`);
    await page.setViewport(vp);

    // 1. Test Balances & Settlements Page
    await page.goto(`${ladakhTripUrl}/balances`, { waitUntil: 'networkidle0' });
    await delay(1500);
    const balancesMetrics = await getLayoutMetrics(page);
    viewportMetrics[`balances_${vp.name}`] = balancesMetrics;
    await capture(page, `balances_${vp.name}`);

    // 2. Test Interactive Map Page
    await page.goto(`${ladakhTripUrl}/map`, { waitUntil: 'networkidle0' });
    await delay(2500);
    const mapMetrics = await getLayoutMetrics(page);
    viewportMetrics[`map_${vp.name}`] = mapMetrics;
    await capture(page, `map_${vp.name}`);

    // 3. Test Expenses Page
    await page.goto(`${ladakhTripUrl}/expenses`, { waitUntil: 'networkidle0' });
    await delay(1500);
    const expensesMetrics = await getLayoutMetrics(page);
    viewportMetrics[`expenses_${vp.name}`] = expensesMetrics;
    await capture(page, `expenses_${vp.name}`);
  }

  const reportPath = path.join(ARTIFACT_DIR, 'qa_settlement_map_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ viewportMetrics, consoleLogs, networkErrors }, null, 2),
  );
  console.log(`Saved QA report to ${reportPath}`);

  await browser.close();
  console.log('Puppeteer QA complete.');
})();
