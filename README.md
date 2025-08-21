# X Context Toolkit

X(Twitter)でテキストを選択して右クリックメニューからミュートキーワードに追加するChrome拡張機能です。

## 機能

### 🎯 主要機能
- **右クリックメニュー**: X上でテキストを選択して右クリックでミュートキーワード追加
- **ポップアップUI**: 拡張機能アイコンから手動でキーワード追加
- **自動タブ切り替え**: ミュートキーワード設定ページを自動で開いて入力
- **DOM操作**: Xの公式ミュートキーワード設定に直接追加

### ✨ 特徴
- **公式機能と連携**: Xの標準ミュート機能を使用
- **シンプルなUI**: Bootstrap 5を使用したモダンなデザイン
- **リアルタイム処理**: バックグラウンドで自動処理
- **通知機能**: 処理結果をわかりやすく通知

## インストール

### 1. リポジトリをクローン
```bash
git clone https://github.com/your-username/x-context-toolkit.git
cd x-context-toolkit
```

### 2. 依存関係をインストール
```bash
npm install
```

### 3. ビルド
```bash
npm run build
```

### 4. Chrome拡張機能として読み込み
1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `dist` フォルダを選択

## 使い方

### 方法1: 右クリックメニュー
1. X(Twitter)でミュートしたいテキストを選択
2. 右クリックして「X ミュートキーワードに追加」を選択
3. 自動でミュートキーワード設定ページが開き、入力される

### 方法2: ポップアップ
1. 拡張機能アイコンをクリック
2. キーワードを入力して「追加」ボタンをクリック
3. 自動でミュートキーワード設定ページが開き、入力される

## 技術仕様

### 開発環境
- **Node.js** + **npm**
- **React 19** + **TypeScript**
- **Bootstrap 5** (UI フレームワーク)
- **Vite** + **CRX.js** (ビルドツール)

### プロジェクト構成
```
src/
├── background/         # バックグラウンドサービス
├── content/           # コンテンツスクリプト
├── popup/             # ポップアップUI
└── utils/             # ユーティリティ関数
```

### コマンド
```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント
npm run lint
```

## セキュリティ

この拡張機能は**防御的な用途**のみを目的としています：
- X(Twitter)の公式ミュート機能を使用
- 悪意のあるコードは含まれていません
- ユーザーデータを外部に送信しません

## 対応ブラウザ

- Google Chrome (Manifest V3対応)
- Microsoft Edge
- その他Chromiumベースブラウザ

## 対応サイト

- `https://x.com/*`
- `https://twitter.com/*`

## ライセンス

MIT License

## 貢献

バグ報告や機能提案は [Issues](https://github.com/zaichu/x-context-toolkit/issues) でお願いします。

## 開発者

開発時の注意事項については [.claude/CLAUDE.md](.claude/CLAUDE.md) を参照してください。