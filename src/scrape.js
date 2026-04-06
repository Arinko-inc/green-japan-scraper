import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';

const CONFIG = {
  url: 'https://www.green-japan.com/favorites/received',
  storageState: 'auth-state.json',
  outputDir: 'output',
  outputFile: 'companies.json',
  selectors: {
    jobLink: '#__next a[href*="/company/"]',
    companyTab: 'a:has-text("企業"), [data-tab="company"], li[role="tab"]:has-text("企業")',
    companyName: '.company-name, h1.company, [class*="companyName"], h1:has-text("株式会社"), h1:has-text("合同会社")',
    industry: '[class*="industry"], .industry-tag',
    location: '[class*="location"], .office-location',
    description: '[class*="description"], .company-desc, p:has-text("事業内容")'
  }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function restoreAuth(context) {
  logger.info('Checking for auth state: ' + CONFIG.storageState);
  if (fs.existsSync(CONFIG.storageState)) {
    const state = JSON.parse(fs.readFileSync(CONFIG.storageState, 'utf-8'));
    await context.restoreStorageState(state);
    logger.authState(true, CONFIG.storageState);
    logger.debug('Auth state restored with cookies: ' + (state.cookies ? state.cookies.length : 0));
    return true;
  }
  logger.authState(false, CONFIG.storageState);
  return false;
}

async function scrapeCompanyInfo(page, index, total) {
  logger.info('[' + (index + 1) + '/' + total + '] Extracting company info');
  
  const companyData = {
    name: 'N/A',
    industry: 'N/A',
    location: 'N/A',
    description: 'N/A',
    url: page.url(),
    timestamp: new Date().toISOString()
  };
  
  try {
    // Company name
    const nameEl = await page.$(CONFIG.selectors.companyName);
    if (nameEl) {
      companyData.name = await nameEl.textContent();
      companyData.name = companyData.name.trim();
      logger.elementFound(CONFIG.selectors.companyName, 1);
    } else {
      logger.elementNotFound(CONFIG.selectors.companyName);
      // Save page source for debugging
      fs.writeFileSync('company-page-source.html', await page.content());
      logger.warn('Page source saved to: company-page-source.html');
    }
    
    // Industry
    const industryEls = await page.$$(CONFIG.selectors.industry);
    if (industryEls.length > 0) {
      companyData.industry = industryEls.map(el => el.textContent().then(t => t.trim())).filter(Boolean).join(', ');
      logger.elementFound(CONFIG.selectors.industry, industryEls.length);
    } else {
      logger.elementNotFound(CONFIG.selectors.industry);
    }
    
    // Location
    const locationEls = await page.$$(CONFIG.selectors.location);
    if (locationEls.length > 0) {
      companyData.location = locationEls.map(el => el.textContent().then(t => t.trim())).filter(Boolean).join(', ');
      logger.elementFound(CONFIG.selectors.location, locationEls.length);
    } else {
      logger.elementNotFound(CONFIG.selectors.location);
    }
    
    // Description
    const descEl = await page.$(CONFIG.selectors.description);
    if (descEl) {
      companyData.description = (await descEl.textContent()).trim().substring(0, 500);
      logger.elementFound(CONFIG.selectors.description, 1);
    } else {
      logger.elementNotFound(CONFIG.selectors.description);
    }
    
    logger.info('Extracted: ' + companyData.name);
  } catch (error) {
    logger.error('Error extracting company info', error);
  }
  
  return companyData;
}

async function navigateToCompanyTab(page) {
  logger.debug('Looking for company tab');
  const selectors = ['a:has-text("企業")', '[data-tab="company"]', 'li[role="tab"]:has-text("企業")'];
  
  for (const sel of selectors) {
    const tab = await page.$(sel);
    if (tab) {
      logger.info('Found company tab: ' + sel);
      await tab.click();
      await sleep(2000);
      logger.info('Navigated to company tab');
      return true;
    }
  }
  
  logger.warn('Company tab not found with any selector');
  return false;
}

async function processJobCard(page, jobLink, index, total) {
  const title = await jobLink.textContent();
  logger.scrapeItem(index, total, title);
  
  const href = await jobLink.getAttribute('href');
  logger.debug('Job link: ' + href);
  
  const [newPage] = await Promise.all([
    page.context().waitForEvent('popup'),
    jobLink.click()
  ]);
  
  const startTime = Date.now();
  try {
    await newPage.waitForLoadState('networkidle', { timeout: 15000 });
    const loadTime = Date.now() - startTime;
    logger.http('GET', newPage.url(), 200, loadTime);
    await sleep(2000);
    
    await navigateToCompanyTab(newPage);
    const data = await scrapeCompanyInfo(newPage, index, total);
    
    await newPage.close();
    return data;
  } catch (error) {
    logger.error('Error processing job ' + (index + 1), error);
    await newPage.close().catch(() => {});
    return null;
  }
}

async function main() {
  logger.start();
  logger.scrapeStart(CONFIG.url);
  
  let browser;
  let page;
  const results = [];
  
  try {
    logger.info('Launching browser...');
    browser = await chromium.launch({ headless: false, slowMo: 300 });
    logger.info('Browser launched');
    
    logger.info('Creating context...');
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    logger.info('Context created');
    
    page = await context.newPage();
    logger.info('New page created');
    
    const hasSession = await restoreAuth(context);
    if (!hasSession) {
      logger.error('No auth state found. Please run: npm run test-login');
      process.exit(1);
    }
    
    logger.info('Navigating to: ' + CONFIG.url);
    const navStart = Date.now();
    await page.goto(CONFIG.url, { waitUntil: 'load', timeout: 60000 });
    const navTime = Date.now() - navStart;
    logger.pageLoad(CONFIG.url, 200, navTime);
    await sleep(3000);
    
    logger.info('Looking for job postings...');
    const jobLinks = await page.$$(CONFIG.selectors.jobLink);
    logger.elementFound(CONFIG.selectors.jobLink, jobLinks.length);
    
    if (jobLinks.length === 0) {
      logger.error('No job postings found');
      logger.warn('Saving page source for debugging...');
      fs.writeFileSync('page-source.html', await page.content());
      process.exit(1);
    }
    
    logger.info('Found ' + jobLinks.length + ' job postings');
    
    for (let i = 0; i < jobLinks.length; i++) {
      const href = await jobLinks[i].getAttribute('href');
      if (!href) {
        logger.warn('[' + (i + 1) + '/' + jobLinks.length + '] Invalid link, skipping');
        continue;
      }
      
      const data = await processJobCard(page, jobLinks[i], i, jobLinks.length);
      if (data) results.push(data);
      await sleep(2000);
    }
    
    logger.scrapeComplete(results.length);
    
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(CONFIG.outputDir, CONFIG.outputFile),
      JSON.stringify(results, null, 2)
    );
    
    logger.info('Saved to: ' + path.join(CONFIG.outputDir, CONFIG.outputFile));
    logger.info('Retrieved ' + results.length + ' companies');
    
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  } finally {
    logger.stop();
    if (browser) await browser.close();
  }
}

main();
