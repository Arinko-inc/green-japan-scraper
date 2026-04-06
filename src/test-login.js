import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  console.log('🚀 Starting login session...\n');
  
  let browser;
  let page;
  let context;
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 500
    });
    
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    console.log('📍 Navigate to: https://www.green-japan.com/');
    await page.goto('https://www.green-japan.com/', {
      waitUntil: 'load',
      timeout: 60000
    });
    
    console.log('\n================================================');
    console.log('✅ Browser opened. Please login manually.');
    console.log('   After login, navigate to:');
    console.log('   https://www.green-japan.com/favorites/received');
    console.log('\n   When done, press Ctrl+C to save auth state.');
    console.log('================================================\n');
    
    // Set up SIGINT handler to save auth state
    process.on('SIGINT', async () => {
      console.log('\n\n⏸  Saving auth state...\n');
      
      try {
        const state = await context.storageState();
        fs.writeFileSync('auth-state.json', JSON.stringify(state, null, 2));
        console.log('✅ Auth state saved to: auth-state.json\n');
      } catch (err) {
        console.error('❌ Error saving auth state:', err.message);
      }
      
      if (browser) {
        await browser.close();
      }
      process.exit(0);
    });
    
    // Keep the process running, wait for Ctrl+C
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
