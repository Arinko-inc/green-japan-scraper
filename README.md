# Green Japan スクレイピングツール

Green Japan サイトの「気になる企業リスト」から企業情報を取得するツールです。

## 環境要件

- Node.js 18.0 以上
- npm 9.0 以上

## インストール

npm install
npx playwright install

## 使用方法

### 1. ログイン確認 (手動操作用)
npm run test-login

ログイン後の「気になる企業リスト」ページの URL を確認してください。

### 2. 環境変数の設定
.env ファイルを作成:
USERNAME=yukihiro@hemmi.osaka
PASSWORD=1208ktfSSt

### 3. データ取得
npm run scrape -- --url "https://www.green-japan.com/..."

## 注意事項
- 個人利用目的でのみ使用してください
- サイトの利用規約を遵守してください
