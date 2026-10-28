一時的な文書。シリーズの最後の PR で消す

# リファクタリング調査 (2026-10, Issue #34 段階1)

調査のみ。製品コード・テスト・マニフェスト・権限は変えていない。
投稿者の識別・誤ブロック防止を弱める提案は含めない。

## 結論

- 誤ブロックにつながる確定済みの実害は見つからなかった。全体は fail-closed(特定・操作に失敗したら通知して何もしない)で統一されている。
- 安全に関わる要実機確認が2件、信頼性の要実機確認が1件ある。いずれも次の段階で小さな PR にできる。
- それ以外の観点(責務分担・MutationObserver・タブ管理・エラー復旧)は実害なし。触らない。

## 調査表

おすすめ順に並べた。重要度は実害ベース(高・中は利用者の実害が出るものに限る)。

| 順 | 問題 | ファイルパスと行 | 根拠 | 重要度 | 影響範囲 | 変更リスク | 期待効果 |
|---|---|---|---|---|---|---|---|
| 1 | ブロック項目の data-testid 高速経路が解除ラベルを見ない | `src/utils/xAccountActions.ts:78-82` (対: 除外判定 `src/utils/xAccountActions.ts:73`, フォールバック経路 `src/utils/xAccountActions.ts:91-93`) | フォールバック経路は `isUndoActionLabel` で解除項目を除外するが、高速経路(`[data-testid="block"]` 発見時は即 return)は文言を見ない。X が同一 testid を解除状態でも付ける仕様なら誤解除クリックになる。実機 DOM 未確認 | 中(要実機確認) | ブロック解除の誤実行 | 低 (高速経路にも解除判定を1条件足すだけ。既存テスト `src/utils/xAccountActions.test.ts:83-88` が保護する) | 誤操作防止の穴を塞ぐ |
| 2 | 確認ボタンの絶対 XPath が脆く、結果検証なしに成功扱いする | `src/utils/xAccountActions.ts:119-128` (XPath)、`src/content/blockButton.ts:88-94` (クリック直後に `resolve(true)`) | `#layers/div[2]/.../button[1]` の位置指定は X の配置変更で別ボタン(キャンセル等)を指しうる。指したボタンを押した直後に無条件で成功(`✅`)になるため、未完了なのに完了表示になるfalse-successがありうる。testid 経路(`src/utils/xAccountActions.ts:111-116`)と文言経路(`src/utils/xAccountActions.ts:130-144`)があるため到達は稀。実機未確認 | 中(要実機確認) | ブロック未完了の誤表示 | 中 (XPath 削除か優先順位入替。実機 DOM での確認が必須) | 誤表示の防止、X 変更への耐性向上 |
| 3 | caret→メニュー→確認の2段 rAF が X の非同期描画より早いと間欠失敗する | `src/content/blockButton.ts:73-96` | 2つの `requestAnimationFrame` で同一描画前に操作する前提だが、caret クリック後のメニュー描画が React 更新で遅れると1段目で項目が見つからず `resolve(false)` になる。失敗時は再操作可能に戻し通知する(`src/content/blockButton.ts:160-162`)ので fail-closed で誤操作にはならないが、体感の失敗通知が増える。実機のタイミング未計測 | 低 | ブロック操作の間欠失敗(再試行で回復) | 中 (待ち方を変えると描画前完了の利点が失われる。実機計測なしの変更はしない) | 操作成功率の向上 |

## 確認した範囲(誤ブロック防止)

- `src/content/blockButton.ts:15-36` 投稿者抽出はアバター→氏名欄の順で、`closest('article')` により引用ポスト側リンクを除外する。見つからなければ `src/content/blockButton.ts:144-147` で通知して何もしない。
- `src/utils/xAccountActions.ts:41-70` URL 判定は https・許可ホスト・15文字以内・予約パス除外(小文字比較)・不明サブパス拒否。不正 URL は null。
- `src/content/blockButton.ts:149-152` 自分自身は比較(大小無視)して操作しない。取得不可時も解除項目の除外(`src/utils/xAccountActions.ts:73`)と対象言及の必須化(`src/utils/xAccountActions.ts:99`)が二重に守る。
- `src/content/blockButton.ts:52-58,78-95` caret が対象 article に属し有効な場合のみ進み、項目・確認ボタンがなければ失敗通知して再操作可能に戻す。黙って進まない。
- 非日英ロケールではキーワード不一致で null になる方向(操作しない方向)に倒れる。緩和提案はなし。

## やらないと決めたもの

| 対象 | 理由 |
|---|---|
| `src/utils/xMuteKeywords.ts` のタブ orchestration とフォーム DOM 操作の同居(`src/utils/xMuteKeywords.ts:1-8` が background/context 両方に束ねられる) | 動作上の実害なし(未使用側は実行されない)。分割はファイル数だけ増やす。YAGNI |
| `observeTweetArticles` の body 全体監視(`src/content/blockButton.ts:282`)と自挿入による再発火 | 初回スキャン+追加追従に必要。重複は `hasBlockButton`(`src/content/blockButton.ts:203-205`)で止まり、テスト(`src/content/blockButton.test.ts:116-125,293-304`)が保護する |
| `waitForCondition` の observer+poll 二重化 | poll は URL 変化等のバックストップで意図的。全経路で cleanup(`src/utils/waitForCondition.ts:20-24`)され、タイムアウトは有限。リークなし |
| タブ再利用の完全一致クエリ(`src/utils/backgroundTab.ts:59-72`)による再利用逃し | 新規タブで正常処理されリークしない(`src/utils/xMuteKeywords.ts:152-155` で必ず閉じる)。ワイルドカード化は誤タブ掴みの危険があり割に合わない |
| 既存タブ失敗時に新規タブへ再試行しない(`src/utils/xMuteKeywords.ts:105-111`) | 二重登録防止の意図的設計。安全優先で正しい |
| Popup の空文字早期 return と `validateMuteKeyword` の重複 | 無害な往復削減。統一のための変更は不要 |
| `isMuteKeywordPage` の `includes` 判定(`src/utils/xMuteKeywords.ts:202-204`) | X 管理 URL 内の部分一致で実害なし。厳密化の利益なし |
| observer 戻り値の破棄(`src/content/index.tsx:21`) | ページ寿命の常設監視が意図。disconnect 不要 |
| 成功後の ✅ 固定(再有効化しない) | リロードで戻る表示上の状態。挙動の実害なし |

## 次段階の提案(小さな PR 単位)

1. 実機でブロックメニューの解除状態の testid を確認し、順位1の解除判定を追加する(要: 実機 DOM の証跡)。
2. 実機で確認シートの DOM を確認し、順位2の XPath 扱い(削除か後順位化)を決める。
3. 順位3は実機計測なしに触らない。失敗通知の発生頻度を見てから判断する。
