const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_DIR_DOCS = path.resolve(__dirname, '../../docs/screenshots');
const TARGET_DIR_ARTIFACTS = 'C:\\Users\\gaura\\.gemini\\antigravity\\brain\\a10a50c3-7bda-4144-8b5a-ca64f121a980\\screenshots';

fs.mkdirSync(TARGET_DIR_DOCS, { recursive: true });
fs.mkdirSync(TARGET_DIR_ARTIFACTS, { recursive: true });

async function saveScreenshot(page, filename) {
  const p1 = path.join(TARGET_DIR_DOCS, filename);
  const p2 = path.join(TARGET_DIR_ARTIFACTS, filename);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log(`Saved screenshot: ${filename}`);
}

async function closeOverlay(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('button svg.lucide-x')?.closest('button');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 800));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,960'],
    defaultViewport: { width: 1440, height: 960 }
  });

  const page = await browser.newPage();

  console.log('Navigating to landing page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await saveScreenshot(page, '01_landing_page.png');

  // Log in as Alice (sender)
  console.log('Logging in as Alice (Sender)...');
  await page.type('input[type="email"]', 'sender@demo.local');
  await page.type('input[type="password"]', 'DemoSender123!');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  // Navigate to Demo Workspace
  console.log('Navigating to Demo Workspace...');
  await page.goto('http://localhost:5173/demo', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  await saveScreenshot(page, '02_demo_workspace_inputs.png');

  // Click Start Interactive Demonstration
  console.log('Starting interactive demonstration...');
  const startBtn = await page.waitForSelector('button ::-p-text(Start Interactive Demonstration)', { timeout: 8000 });
  if (startBtn) {
    await startBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    await saveScreenshot(page, '03_execution_telemetry_hud.png');

    // Click Next Stage 3 times to show RSA-OAEP Wrap (Stage 4)
    const nextBtn = await page.$('button ::-p-text(Next Stage →)');
    if (nextBtn) {
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 800));
      await saveScreenshot(page, '04_hybrid_asymmetric_wrap.png');
    }

    await closeOverlay(page);
  }

  // Trigger Eve Attack
  console.log('Testing Eve Intruder access...');
  const eveBtn = await page.$('button ::-p-text(1. Simulate Eve Unauthorized Access (403))');
  if (eveBtn) {
    await eveBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    // Click Next Stage 3 times to show HTTP 403 Forbidden
    const nextBtn = await page.$('button ::-p-text(Next Stage →)');
    if (nextBtn) {
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }
    await saveScreenshot(page, '05_eve_unauthorized_barrier.png');
    await closeOverlay(page);
  }

  // Trigger Tamper Attack
  console.log('Testing 1-Bit Payload Tamper...');
  const tamperBtn = await page.$('button ::-p-text(2. Simulate Bit-Flip Tamper Rejection)');
  if (tamperBtn) {
    await tamperBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    const nextBtn = await page.$('button ::-p-text(Next Stage →)');
    if (nextBtn) {
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 400));
      await nextBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }
    await saveScreenshot(page, '06_tamper_detection_gmac.png');
    await closeOverlay(page);
  }

  // Navigate to Cloud Directory
  console.log('Navigating to Cloud Directory...');
  await page.goto('http://localhost:5173/directory', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await saveScreenshot(page, '07_cloud_directory_catalog.png');

  // Switch to Eve in Cloud Directory and click Attempt Decrypt
  console.log('Switching to Eve in Cloud Directory...');
  const eveSwitchBtn = await page.$('button ::-p-text(Eve (Intruder))');
  if (eveSwitchBtn) {
    await eveSwitchBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    const attemptBtn = await page.$('button ::-p-text(Attempt Decrypt)');
    if (attemptBtn) {
      await attemptBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      await saveScreenshot(page, '08_directory_access_denied_modal.png');
      await page.evaluate(() => {
        const ack = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Acknowledge Security Proof'));
        if (ack) ack.click();
      });
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // Navigate to Security Center
  console.log('Navigating to Security Center...');
  await page.goto('http://localhost:5173/security', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await saveScreenshot(page, '09_tamper_evident_audit_ledger.png');

  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
  await browser.close();
}

run().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
