# Claude 設定

## プロジェクト概要
X(Twitter)でテキストを選択後、右クリックメニューからミュートキーワードに追加するChrome拡張機能。Xの公式ミュートキーワード設定ページにDOM操作で直接追加する。

## 開発環境
- Node.js + npm
- React 19 + TypeScript 
- Bootstrap 5 (UI フレームワーク)
- Vite + CRX.js (ビルドツール)

## 主要コマンド
```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント  
npm run lint
```

## プロジェクト構成
```
src/
├── background/           # バックグラウンドサービス
│   └── index.ts         # 右クリックメニュー、通知機能
├── content/             # コンテンツスクリプト
│   └── index.tsx        # DOM操作、フォーム入力自動化
├── popup/               # ポップアップUI
│   ├── index.html       # HTMLテンプレート
│   └── popup.tsx        # Reactポップアップコンポーネント
└── utils/               # ユーティリティ関数
    ├── storage.ts       # ストレージ操作（簡略化）
    └── xMuteKeywords.ts # Xミュートキーワード操作
```

## 主要機能

### 1. 右クリックメニュー
- X上でテキスト選択 → 右クリック → 「X ミュートキーワードに追加」
- バックグラウンドで処理、通知で結果表示

### 2. ポップアップUI  
- 拡張機能アイコンクリック → キーワード入力フォーム
- Bootstrap 5によるモダンなデザイン

### 3. 自動タブ切り替え・DOM操作
- `https://x.com/settings/add_muted_keyword` を新しいタブで開く
- タブを自動的にアクティブ化・前面表示
- DOM操作でフォームにキーワードを自動入力
- 保存ボタンを自動クリック

## 技術的な実装詳細

### Manifest V3 権限
```json
{
  "permissions": ["activeTab", "tabs", "contextMenus", "notifications"],
  "host_permissions": ["https://twitter.com/*", "https://x.com/*"]
}
```

### DOM操作のセレクター
- キーワード入力: `input[name="keyword"]`
- 保存ボタン: `button[data-testid="settingsDetailSave"]`

### タブ管理
- `chrome.tabs.create()` でタブ作成
- `chrome.tabs.update()` と `chrome.windows.update()` でアクティブ化
- `chrome.tabs.sendMessage()` でコンテンツスクリプト連携

## 開発時の注意

### セキュリティ
- **防御的な用途のみ**: X公式のミュート機能を活用
- **外部送信なし**: ユーザーデータを外部に送信しない
- **DOM操作限定**: https://x.com/settings/* でのみ動作

### 対応サイト
- `https://x.com/*`
- `https://twitter.com/*`

### ビルド・デプロイ
- CRX.jsがManifest V3に自動変換
- `dist/`フォルダをChrome拡張機能として読み込み
- アイコンファイル（16px, 48px, 128px）が必要

## トラブルシューティング

### よくある問題
1. **DOM要素が見つからない**: X のUI変更により要素が変わった場合
2. **タブ権限エラー**: manifest.json の permissions 設定確認
3. **CRX.js ビルドエラー**: アイコンファイルの存在確認

### デバッグ方法
- Chrome DevTools の Console でエラー確認
- `chrome://extensions/` でエラーログ確認  
- バックグラウンドスクリプトのログ確認