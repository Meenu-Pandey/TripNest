const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\9eb8f685-814c-4c61-b7a0-cdf24fd6ddd1';
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

async function getLayoutMetrics(page) {
  return await page.evaluate(() => {
    return {
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
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
    if (!response.ok() && response.status() !== 304 && !response.url().includes('favicon')) {
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
    console.error('No valid trips found. Run seed script.');
    await capture(page, 'no_trips');
    process.exit(1);
  }
  
  const tripUrl = `${BASE_URL}${validLink}`;
  console.log(`Trip Workspace URL: ${tripUrl}`);

  const results = {};

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting viewport: ${vp.width}x${vp.height}`);
    await page.setViewport(vp);
    
    await page.goto(tripUrl, { waitUntil: 'networkidle0' });
    if (vp.width < 1024) await capture(page, `mobile_closed_${vp.width}`);
    else await capture(page, `desktop_workspace_${vp.width}`);

    if (vp.width < 1024) {
      try {
        const buttons = await page.$$('button');
        let hamburger = null;
        for (const btn of buttons) {
          const innerHTML = await page.evaluate(el => el.innerHTML, btn);
          if (innerHTML.includes('<svg') && !innerHTML.includes('User')) { 
            const label = await page.evaluate(el => el.getAttribute('aria-label') || '', btn);
            if (label.toLowerCase().includes('menu') || label.toLowerCase().includes('open')) {
                hamburger = btn;
                break;
            }
          }
        }
        
        if (hamburger) {
          await hamburger.click();
          await delay(1000);
          await capture(page, `mobile_open_${vp.width}`);
          await page.keyboard.press('Escape');
          await delay(500);
        } else {
          console.log(`[!] Hamburger not found at ${vp.width}px`);
        }
      } catch (e) {
        console.error('Error testing hamburger:', e.message);
      }
    }
    
    let metrics = await getLayoutMetrics(page);
    results[`overview_${vp.width}`] = metrics;
    
    await page.goto(`${tripUrl}/explore`, { waitUntil: 'networkidle0' });
    await delay(2000);
    if (vp.width === 360) await capture(page, 'mobile_Explore_Destination');
    else if (vp.width === 1440) await capture(page, 'desktop_Explore_Destination');
    results[`explore_${vp.width}`] = await getLayoutMetrics(page);
    
    await page.goto(`${tripUrl}/map`, { waitUntil: 'networkidle0' });
    await delay(3000);
    if (vp.width === 360) await capture(page, 'mobile_Map');
    else if (vp.width === 1440) await capture(page, 'desktop_Map');
    results[`map_${vp.width}`] = await getLayoutMetrics(page);

    try {
      const aiBtn = await page.$('button[aria-label="Open Trip AI"]'); 
      if (aiBtn) {
         await aiBtn.click();
         await delay(1000);
         if (vp.width === 360) await capture(page, 'mobile_AI');
         await page.keyboard.press('Escape');
      }
    } catch (e) {}

    await page.goto(`${tripUrl}/places`, { waitUntil: 'networkidle0' });
    if (vp.width === 360) await capture(page, 'mobile_Places');

    await page.goto(`${tripUrl}/expenses`, { waitUntil: 'networkidle0' });
    if (vp.width === 360) await capture(page, 'mobile_Expenses');
  }

  fs.writeFileSync('qa_report.json', JSON.stringify({
    results,
    consoleLogs,
    networkErrors,
  }, null, 2));

  // Test Start Planning routing while logged in
  console.log('Testing logged-in Start Planning routing...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  const startPlanningBtns = await page.$$('a[href="/trips"]');
  if (startPlanningBtns.length > 0) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.evaluate(el => el.click(), startPlanningBtns[0])
    ]);
    if (page.url() !== `${BASE_URL}/trips`) {
       console.error(`Start Planning logged-in routing failed, went to: ${page.url()}`);
       process.exit(1);
    }
  } else {
    console.error('Could not find Start Planning button pointing to /trips');
    process.exit(1);
  }

  // Test mobile navigation clicks
  console.log('Testing mobile navigation routing...');
  await page.setViewport(VIEWPORTS[2]); // 768x1024
  await page.goto(tripUrl, { waitUntil: 'networkidle0' });
  
  // Click hamburger
  let hamburger = await page.$('button[aria-label="Open menu"], button[aria-label="Menu"]');
  if (!hamburger) {
      // Find manually
      const buttons = await page.$$('button');
      for (const btn of buttons) {
          const innerHTML = await page.evaluate(el => el.innerHTML, btn);
          if (innerHTML.includes('<svg') && !innerHTML.includes('User')) { 
              const label = await page.evaluate(el => el.getAttribute('aria-label') || '', btn);
              if (label.toLowerCase().includes('menu') || label.toLowerCase().includes('open') || innerHTML.includes('lucide-menu')) {
                  hamburger = btn;
                  break;
              }
          }
      }
  }

      if (hamburger) {
      await page.evaluate(el => el.click(), hamburger);
      await delay(1000);
      
      // Click Itinerary
      const itineraryLink = await page.$('a[href$="/itinerary"]');
      if (itineraryLink) {
          await Promise.all([
             page.waitForNavigation({ waitUntil: 'networkidle0' }),
             page.evaluate(el => el.click(), itineraryLink)
          ]);
          if (!page.url().endsWith('/itinerary')) {
              console.error('Mobile navigation failed for Itinerary');
              process.exit(1);
          }
      }

      // Test browser back
      await page.goBack({ waitUntil: 'networkidle0' });
      if (!page.url().endsWith(validLink)) {
          console.error('Browser back failed');
          process.exit(1);
      }
      
      // Test Back to My Trips
      // Find hamburger again
      const buttons = await page.$$('button');
      for (const btn of buttons) {
          const innerHTML = await page.evaluate(el => el.innerHTML, btn);
          if (innerHTML.includes('<svg') && !innerHTML.includes('User')) { 
              const label = await page.evaluate(el => el.getAttribute('aria-label') || '', btn);
              if (label.toLowerCase().includes('menu') || label.toLowerCase().includes('open') || innerHTML.includes('lucide-menu')) {
                  hamburger = btn;
                  break;
              }
          }
      }
      await page.evaluate(el => el.click(), hamburger);
      await delay(1000);

      const backToTrips = await page.$('a[href="/trips"]');
      if (backToTrips) {
          await Promise.all([
             page.waitForNavigation({ waitUntil: 'networkidle0' }),
             page.evaluate(el => el.click(), backToTrips)
          ]);
          if (!page.url().endsWith('/trips')) {
              console.error('Back to My Trips failed');
              process.exit(1);
          }
      }
  }

  await browser.close();
  console.log('Done.');
})();
