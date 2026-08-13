# Chrome Web Store 公開チェックリスト

## 成果物

- アップロード用：`release/x-context-toolkit-v1.0.12.zip`
- ローカル動作確認用：`release/x-context-toolkit-v1.0.12/`
- ストアアイコン：`store-assets/icon-128.png`
- 小型プロモ画像：`store-assets/promotional/promo-small-440x280.png`
- スクリーンショット：`store-assets/screenshots/`の3枚
- 掲載文：`docs/store/listing-ja.md`
- Privacy practices：`docs/store/privacy-practices-ja.md`
- プライバシーポリシー：`docs/store/privacy-policy-ja.md`

## 申請前

- [ ] `npm ci && npm test && npm run lint && npm run release`が成功
- [ ] Vivaldi/Chromeで展開済みreleaseフォルダを読み込み、ポップアップ・右クリックミュート・ブロックを実機確認
- [ ] プライバシーポリシーをGitHub Pages等のHTTPS公開URLへ掲載
- [ ] Privacy practicesへ公開URLを入力
- [ ] 説明文、権限理由、データ申告、プライバシーポリシーの内容を一致させる
- [ ] 非公式ツールである旨が掲載文にある
- [ ] Developer Dashboardの開発者メールアドレスを認証
- [ ] 配布地域と公開範囲を選択

## Dashboard入力

- [ ] ZIPをアップロード（展開済みフォルダではない）
- [ ] 日本語を既定言語に設定
- [ ] 詳細説明とカテゴリを入力
- [ ] アイコン、スクリーンショット3枚、小型プロモ画像をアップロード
- [ ] 単一目的と各権限理由を入力
- [ ] リモートコード「使用しない」を選択
- [ ] データ利用を実態どおり申告し、Limited Useを確認
- [ ] プライバシーポリシーURL、ホームページ、サポートURLを入力

## 注意

`dist/`および展開済みreleaseフォルダは手元の動作確認用です。Chrome Web StoreにはZIPをアップロードします。公開ボタンを押す前に、Dashboard上の警告とプレビューを再確認してください。
