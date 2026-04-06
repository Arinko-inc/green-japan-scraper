import { chromium } from 'playwright';

(async () => {
  console.log('🚀 ブラウザを起動します...');
  
  let browser;
  let page;
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 500
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    console.log('📍 ログインページへ移動します...');
    // networkidle は時間がかかるため、load に変更し、タイムアウトも延長
    await page.goto('https://www.green-japan.com/', {
      waitUntil: 'load',
      timeout: 60000
    });
    
    console.log('✅ ページが読み込まれました。手動でログインしてください。');
    console.log('   ログイン後の「気になる企業リスト」ページの URL を確認してください。');
    console.log('\n💡 ブラウザを閉じるには、ターミナルで Ctrl+C を押してください。\n');
    
    process.on('SIGINT', async () => {
      console.log('\n👋 ブラウザを閉じています...');
      await browser.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    
    if (error.message.includes('Timeout')) {
      console.log('\n💡 ヒント: 以下の原因が考えられます');
      console.log('   1. インターネット接続を確認してください');
      console.log('   2. サイトが不安定な場合があります。再度お試しください');
      console.log('   3. プロキシを使用している場合は設定を確認してください');
    }
    
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
})();
