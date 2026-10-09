# Claude 設定

## プロジェクト概要
X(Twitter)上で、右クリックメニュー・ポップアップからのミュートキーワード追加と、各ポストの🚫ボタンによる投稿者ブロックを行うChrome拡張機能。Xの公式UIをDOM操作で直接利用する。機能概要・使い方はREADME.mdを参照。

## 主要コマンド
```bash
npm run dev    # 開発サーバー起動
npm run build  # ビルド
npm run lint   # リント
npm test       # テスト (vitest)
```

## プロジェクト構成
```
src/
├── background/              # バックグラウンドService Worker
│   ├── index.ts             # 右クリックメニュー、通知、メッセージ処理
│   └── muteQueue.ts         # ミュートキーワード追加のFIFOキュー
├── content/                 # コンテンツスクリプト
│   ├── index.tsx            # メッセージ処理、🚫ボタン常設のエントリ
│   └── blockButton.ts       # 🚫ブロックボタンの挿入・ブロック操作
├── popup/                   # ポップアップUI
│   ├── index.html           # HTMLテンプレート
│   ├── popup.tsx            # エントリーポイント
│   ├── Popup.tsx            # Reactコンポーネント
│   └── enqueueMuteKeyword.ts
└── utils/                   # ユーティリティ関数
    ├── backgroundTab.ts     # 非アクティブ一時タブ・既存タブ探索
    ├── waitForCondition.ts  # MutationObserver＋pollの条件待ち
    ├── xAccountActions.ts   # ブロック用DOM操作・ユーザー名抽出
    └── xMuteKeywords.ts     # ミュートキーワード用DOM操作
```

## 主要機能の実装

### 1. ミュートキーワード追加（右クリック・ポップアップ共通）
- 受付はService Workerの`muteQueue`へenqueueし、X側への保存はキュー内で直列に処理する
- 既に開いているX設定タブ（`add_muted_keyword`/`muted_keywords`）があれば再利用し、なければ`active: false`の非アクティブ一時タブで`https://x.com/settings/add_muted_keyword`を開く
- フォームへの入力・保存はコンテンツスクリプトがDOM操作で行い、一時タブは成否にかかわらず処理後に閉じる
- 失敗時は通知で知らせる

### 2. 🚫ブロックボタン
- タイムライン上の各ポストの投稿ヘッダー（Grokボタンの隣）に🚫ボタンを常設
- クリックすると現在ページ内でX公式メニュー（caret→ブロック→確認シート）を自動操作する。別タブ・別ウィンドウは開かない
- MutationObserverで動的に追加されるポストにも追従

## 技術的な実装詳細

### Manifest V3 権限
`manifest.json` の `permissions`: `tabs`, `contextMenus`, `notifications`

### DOM操作のセレクター
- キーワード入力: `input[name="keyword"]`
- 保存ボタン: `button[data-testid="settingsDetailSave"]`

### タブ管理
- `chrome.tabs.create({ active: false })` で非アクティブ一時タブを作成
- `chrome.tabs.query()` で既存のX設定タブを探索・再利用
- `chrome.tabs.sendMessage()` でコンテンツスクリプト連携（受信先未準備エラーのみ短い間隔で再試行）
- `chrome.tabs.remove()` で一時タブを閉じる

## 開発時の注意

### セキュリティ
- **防御的な用途のみ**: X公式のミュート・ブロック機能を活用
- **外部送信なし**: ユーザーデータを外部に送信しない
- コンテンツスクリプトは `https://x.com/*`・`https://twitter.com/*` 全般で動作する（設定ページのフォーム入力とタイムラインへの🚫ボタン挿入）

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
