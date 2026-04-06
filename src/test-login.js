import { chromium } from 'playwright';

(async () => {
  console.log('🚀 ブラウザを起動します...');
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  console.log('📍 ログインページへ移動します...');
  await page.goto('https://www.green-japan.com/', { waitUntil: 'networkidle' });
  console.log('✅ ブラウザが起動しました。手動でログインしてください。');
  console.log('   ログイン後の「気になる企業リスト」ページの URL を確認してください。');
  console.log('\\n💡 ブラウザを閉じるには、ターミナルで Ctrl+C を押してください。\\n');
  process.on('SIGINT', async () => {
    console.log('\\n👋 ブラウザを閉じています...');
    await browser.close();
    process.exit(0);
  });
})();
