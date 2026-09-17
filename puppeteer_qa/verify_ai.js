const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\1eaa9f2c-3afb-478e-95f9-902ba64b05e8';
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 412, height: 924 },
  { width: 390, height: 844 },
  { width: 360, height: 800 }
];

function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

async function capture(page, name) {
  const file = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`Saved screenshot: ${file}`);
}

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  const consoleLogs = [];
  const networkErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') consoleLogs.push(`[Console Error] ${msg.text()}`);
  });
  page.on('requestfailed', request => {
    networkErrors.push(`[Network Failure] ${request.url()} - ${request.failure().errorText}`);
  });
  page.on('response', response => {
    if (!response.ok() && response.status() !== 304 && !response.url().includes('favicon') && !response.url().includes('11434')) {
      networkErrors.push(`[HTTP ${response.status()}] ${response.url()}`);
    }
  });

  console.log('Navigating to login...');
  await page.setViewport(VIEWPORTS[0]);
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', 'alice@example.test');
    await page.type('input[type="password"]', 'demo-password-not-for-real-use');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]')
    ]);
    console.log('Login successful');
  } catch (err) {
    console.error('Login failed, capturing screen...', err);
    await capture(page, 'login_error');
    process.exit(1);
  }

  await page.goto(`${BASE_URL}/trips`, { waitUntil: 'networkidle0' });
  await delay(1000);
  
  const tripLinks = await page.$$('a[href^="/trips/"]');
  let validLink = null;
  for (const link of tripLinks) {
    const href = await page.evaluate(el => el.getAttribute('href'), link);
    if (href !== '/trips/new') {
       validLink = href;
       break;
    }
  }

  if (!validLink) {
    console.error('No valid trips found.');
    process.exit(1);
  }
  
  const tripUrl = `${BASE_URL}${validLink}`;
  console.log(`Trip Workspace URL: ${tripUrl}`);

  console.log('Navigating to Map page...');
  await page.goto(`${tripUrl}/map`, { waitUntil: 'networkidle0' });
  await delay(2000);

  // 1. Verify Map is visible initially
  let mapCanvas = await page.$('.maplibregl-canvas');
  if (!mapCanvas) {
      console.error('MapLibre canvas not found initially!');
  } else {
      console.log('MapLibre canvas is visible initially.');
  }

  // 2. Open AI Drawer
  console.log('Opening AI Drawer...');
  const aiBtn = await page.$('button[aria-label="Open TripNest AI Assistant"]'); 
  if (aiBtn) {
      await aiBtn.click();
      await delay(1000);
  } else {
      console.error('AI Button not found!');
  }

  // Check Ollama Unavailable status
  const badgeText = await page.evaluate(() => {
      const badgeContainer = document.querySelector('.bg-warning-100, .bg-amber-100, .bg-sand-200'); // Check badge
      return badgeContainer ? badgeContainer.innerText : '';
  });
  if (badgeText.includes('Offline') || badgeText.includes('Missing')) {
      console.log(`Ollama is currently: ${badgeText}`);
      console.log('Testing Ollama unavailable state passed (UI shows offline status).');
      await capture(page, 'ai_unavailable_state');
  }

  console.log('Sending message to AI...');
  const input = await page.$('input[placeholder="Ask about this trip..."]');
  if (input) {
      await input.type('Give me a quick summary with headings and a list of ideas.');
      await page.keyboard.press('Enter');
      
      console.log('Waiting for AI response...');
      // Wait for it to stop loading
      await delay(15000); 
      
      await capture(page, 'formatted_ai_response');

      const responseText = await page.evaluate(() => {
          const proseElements = document.querySelectorAll('.prose');
          if (proseElements.length > 0) {
              return proseElements[proseElements.length - 1].innerText;
          }
          return '';
      });
      console.log('AI Response snippet:', responseText.substring(0, 100).replace(/\n/g, ' '));

      // Verify Markdown tags (h2, ul, etc.)
      const hasMarkdownElements = await page.evaluate(() => {
          const proseElements = document.querySelectorAll('.prose');
          if (proseElements.length === 0) return false;
          const lastProse = proseElements[proseElements.length - 1];
          return lastProse.querySelector('h1, h2, h3, ul, ol, strong') !== null;
      });
      console.log(`Markdown elements rendered: ${hasMarkdownElements}`);
      
      const hasRawMarkdown = responseText.includes('###') || responseText.includes('**');
      console.log(`Raw markdown syntax visible: ${hasRawMarkdown}`);
  }

  // Close AI Drawer
  console.log('Closing AI Drawer...');
  await page.keyboard.press('Escape');
  await delay(1000);
  await capture(page, 'ai_closed_with_working_map');

  // Verify MapLibre map remains visible and interactive
  const mapCanvasAfterClose = await page.$('.maplibregl-canvas');
  if (!mapCanvasAfterClose) {
      console.error('MapLibre canvas vanished after closing AI!');
  } else {
      const bounds = await mapCanvasAfterClose.boundingBox();
      if (bounds.width > 0 && bounds.height > 0) {
          console.log('MapLibre canvas is visible and has dimensions > 0.');
      } else {
          console.error('MapLibre canvas is 0x0!');
      }
  }

  // Reopen AI Drawer
  console.log('Reopening AI Drawer...');
  const aiBtnReopen = await page.$('button[aria-label="Open TripNest AI Assistant"]');
  if (aiBtnReopen) await aiBtnReopen.click();
  await delay(1000);

  // Verify no duplicate map instance
  const mapCount = await page.evaluate(() => document.querySelectorAll('.maplibregl-canvas').length);
  console.log(`MapLibre canvas count after reopen: ${mapCount}`);
  if (mapCount !== 1) {
      console.error(`Duplicate or missing map instances! Count: ${mapCount}`);
  }

  // Test mobile AI drawer
  console.log('Testing mobile AI drawer...');
  await page.setViewport(VIEWPORTS[4]); // 390x844
  await delay(1000);
  await capture(page, 'mobile_ai_drawer');
  
  console.log('\n--- VERIFICATION REPORT ---');
  console.log('Console Errors:', consoleLogs.length);
  if (consoleLogs.length > 0) console.log(consoleLogs.join('\n'));
  
  console.log('Network Failures:', networkErrors.length);
  if (networkErrors.length > 0) console.log(networkErrors.join('\n'));
  
  await browser.close();
  console.log('Verification Complete.');
})();
