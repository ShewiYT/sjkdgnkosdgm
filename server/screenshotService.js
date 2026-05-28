import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Screenshots directory
const screenshotsDir = join(__dirname, '..', 'data', 'screenshots');
if (!existsSync(screenshotsDir)) {
  mkdirSync(screenshotsDir, { recursive: true });
}

let browser = null;

// Initialize browser
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });
  }
  return browser;
}

// Generate screenshot from HTML with replaced URL
export async function generateScreenshot(htmlContent, targetUrl, placeholderUrl = 'https://example.com') {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });

    // Replace placeholder URL with target URL
    const modifiedHtml = htmlContent.replace(
      new RegExp(escapeRegExp(placeholderUrl), 'g'),
      targetUrl
    );

    // Set content
    await page.setContent(modifiedHtml, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait a bit for any animations
    await new Promise(r => setTimeout(r, 500));

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    await page.close();

    // Save to file
    const filename = `screen_${Date.now()}.png`;
    const filepath = join(screenshotsDir, filename);
    writeFileSync(filepath, screenshot);

    // Return as base64
    const base64 = screenshot.toString('base64');
    
    return {
      success: true,
      base64: `data:image/png;base64,${base64}`,
      filename,
      filepath,
    };
  } catch (error) {
    console.error('[Screenshot] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Helper to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Close browser on shutdown
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit();
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit();
});
