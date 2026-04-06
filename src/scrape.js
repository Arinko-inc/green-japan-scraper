import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  url: 'https://www.green-japan.com/favorites/received',
  storageState: 'auth-state.json',
  outputDir: 'output',
  outputFile: 'companies.json',
  selectors: {
    jobCard: '.job-card, li.job, article.job, [class*="job"]', // 求人記事のカード
    jobLink: 'a[href*="/company/"]', // 求人記事へのリンク
    companyTab: 'a[data-tab="company"], a:has-text("企業"), li[role="tab"]:has-text("企業")', // 企業タブ
    companyName: '.company-name, h1.company, .company-header h1, [class*="companyName"]', // 企業名
    industry: '.industry, .industry-tag, [class*="industry"]', // 業種
    location: '.location, .office-location, [class*="location"]', // 所在地
    description: '.description, .company-desc, [class*="description"]' // 説明
  }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveAuthState(context) {
  const state = await context.storageState();
  fs.writeFileSync(CONFIG.storageState, JSON.stringify(state, null, 2));
  console.log('✅ セッション状態を保存しました:', CONFIG.storageState);
}

async function restoreAuth(context) {
  if (fs.existsSync(CONFIG.storageState)) {
    const state = JSON.parse(fs.readFileSync(CONFIG.storageState, 'utf-8'));
    await context.restoreStorageState(state);
    console.log('✅ セッション状態を復元しました');
    return true;
  }
  return false;
}

async function scrapeCompanyInfo(page) {
  const companyData = {};
  
  try {
    // 企業名
    companyData.name = await page.$eval(CONFIG.selectors.companyName, el => el.textContent.trim()).catch(() => '取得できませんでした');
    
    // 業種
    const industryElements = await page.$$(CONFIG.selectors.industry);
    companyData.industry = industryElements.map(el => el.textContent.trim()).join(', ') || '取得できませんでした';
    
    // 所在地
    const locationElements = await page.$$(CONFIG.selectors.location);
    companyData.location = locationElements.map(el => el.textContent.trim()).join(', ') || '取得できませんでした';
    
    // 説明
    const descriptionElement = await page.$(CONFIG.selectors.description);
    companyData.description = descriptionElement ? descriptionElement.textContent.trim().slice(0, 500) : '取得できませんでした';
    
    // ページの HTML を保存（後で分析用）
    companyData.url = page.url();
    companyData.timestamp = new Date().toISOString();
    
    console.log(`   企業名：${companyData.name}`);
  } catch (error) {
    console.log(`   ❌ 企業情報の取得に失敗しました: ${error.message}`);
  }
  
  return companyData;
}

async function navigateToCompanyTab(page) {
  try {
    // 企業タブを探す
    const companyTab = await page.$(CONFIG.selectors.companyTab);
    
    if (companyTab) {
      await companyTab.click();
      await sleep(2000);
      console.log('   → 企業タブへ移動しました');
      return true;
    } else {
      console.log('   ⚠️ 企業タブが見つかりませんでした');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ タブ遷移に失敗しました: ${error.message}`);
    return false;
  }
}

async function processJobCard(page, jobLink, index, total) {
  console.log(`\n[${index + 1}/${total}] 求人記事を開いています...`);
  
  // リンクを取得
  const href = await jobLink.getProperty('href').then(prop => prop.jsonValue());
  const title = await jobLink.textContent();
  
  console.log(`   タイトル：${title?.slice(0, 50)}`);
  
  // 新しいタブで開く
  const [newPage] = await Promise.all([
    page.context().waitForEvent('popup'),
    jobLink.click()
  ]);
  
  try {
    await newPage.waitForLoadState('networkidle', { timeout: 15000 });
    await sleep(2000);
    
    // 企業タブへ移動
    const hasCompanyTab = await navigateToCompanyTab(newPage);
    
    // 企業情報を抽出
    const companyData = await scrapeCompanyInfo(newPage);
    
    await newPage.close();
    
    return companyData;
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    try {
      await newPage.close();
    } catch (e) {}
    return null;
  }
}

async function main() {
  console.log('🚀 スクレイピングを開始します...\n');
  
  let browser;
  let page;
  const results = [];
  
  try {
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 300
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    page = await context.newPage();
    
    // セッション復元
    const hasSession = await restoreAuth(context);
    
    if (!hasSession) {
      console.log('❌ セッション状態が見つかりません。まずログインしてください。\n');
      console.log('実行方法: npm run test-login');
      process.exit(1);
    }
    
    // favorites/received ページへ移動
    console.log(`📍 ${CONFIG.url} へ移動します...`);
    await page.goto(CONFIG.url, { 
      waitUntil: 'load',
      timeout: 60000 
    });
    await sleep(3000);
    
    // 求人一覧の要素を取得
    const jobLinks = await page.$$(CONFIG.selectors.jobLink);
    console.log(`📋 取得した求人記事リンク数：${jobLinks.length}\n`);
    
    if (jobLinks.length === 0) {
      console.log('⚠️ 求人記事が見つかりませんでした。セレクタを確認してください。');
      console.log('HTML 構造を確認するために、ページソースを保存します...');
      fs.writeFileSync('page-source.html', await page.content());
      process.exit(1);
    }
    
    // 各求人記事を処理
    for (let i = 0; i < jobLinks.length; i++) {
      // リンクがまだ有効か確認
      const href = await jobLinks[i].getAttribute('href');
      if (!href) {
        console.log(`[${i + 1}/${jobLinks.length}] リンクが無効です。スキップ...`);
        continue;
      }
      
      const companyData = await processJobCard(page, jobLinks[i], i, jobLinks.length);
      
      if (companyData) {
        results.push(companyData);
      }
      
      // 次の項目への過度な負荷を避ける
      await sleep(2000);
    }
    
    // 結果を保存
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(CONFIG.outputDir, CONFIG.outputFile),
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\n✅ 完了！ ${results.length}件の企業データを保存しました.`);
    console.log(`📁 保存先：${path.join(CONFIG.outputDir, CONFIG.outputFile)}`);
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
