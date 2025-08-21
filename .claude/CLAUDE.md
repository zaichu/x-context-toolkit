# Claude 設定

## プロジェクト概要
文字を選択後、右クリックメニューからXのミュートキーワードに追加するChrome拡張機能

## 開発環境
- Node.js + npm
- React 19 + TypeScript
- Bootstrap 5
- Vite + CRX.js

## 主要コマンド
```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint

# テスト
npm run test
```

## プロジェクト構成
```
src/
├── background/       # バックグラウンドサービス
├── content/         # コンテンツスクリプト
├── popup/           # ポップアップUI
├── components/      # React コンポーネント
├── hooks/           # カスタムフック
├── types/           # TypeScript型定義
└── utils/           # ユーティリティ関数
```

## 主要機能
- X のミュートキーワード追加

## 開発時の注意
- X でのみ動作
- セキュリティ上、防御的な用途のみ
- DOM操作は慎重に実装