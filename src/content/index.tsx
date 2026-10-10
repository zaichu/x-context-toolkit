// コンテンツスクリプト - ミュートキーワード設定ページ・タイムライン用
import {
  isMuteKeywordPage,
  isMuteKeywordsListPage,
  fillMuteKeywordForm,
  prepareAndFillMuteKeywordForm,
} from '../utils/xMuteKeywords'
import { observeTweetArticles } from './blockButton'

console.log('X Context Toolkit コンテンツスクリプトが読み込まれました')

// ページの初期化
const initialize = () => {
  if (isMuteKeywordPage()) {
    console.log('Xのミュートキーワード設定ページを検出しました')
    return
  }

  // タイムライン等のポストへ🚫ブロックボタンを常設する
  observeTweetArticles(document.body)
}

// キーワード入力要求のactionごとの違いは「対象ページ」と「フォームへの到達方法」だけ
const FILL_ACTIONS = {
  fillMuteKeyword: {
    isTargetPage: isMuteKeywordPage,
    wrongPageError: 'ミュートキーワード設定ページではありません',
    fill: fillMuteKeywordForm,
  },
  prepareAndFillMuteKeyword: {
    isTargetPage: isMuteKeywordsListPage,
    wrongPageError: 'ミュートキーワード一覧ページではありません',
    // 追加リンクをクリックしてSPA遷移させてからフォームにキーワードを入力
    fill: prepareAndFillMuteKeywordForm,
  },
} as const

type FillAction = (typeof FILL_ACTIONS)[keyof typeof FILL_ACTIONS]

const respondFillKeyword = async (
  keyword: string,
  action: FillAction,
  sendResponse: (response: unknown) => void,
): Promise<void> => {
  try {
    if (!action.isTargetPage()) {
      sendResponse({ success: false, error: action.wrongPageError })
      return
    }

    const result = await action.fill(keyword)

    if (result.success) {
      console.log(`ミュートキーワード「${keyword}」を入力しました`)
      sendResponse({ success: true, timings: result.timings })
    } else {
      sendResponse({ success: false, error: 'フォームの入力に失敗しました' })
    }
  } catch (error) {
    console.error('ミュートキーワード入力エラー:', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : '不明なエラー' })
  }
}

// バックグラウンドスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('コンテンツスクリプトでメッセージを受信:', request)

  const action = FILL_ACTIONS[request.action as keyof typeof FILL_ACTIONS]
  if (!action || !request.keyword) {
    sendResponse({ success: false, error: '不明なアクション' })
    return true
  }

  // 非同期レスポンスを使うため、asyncリスナー（戻り値がPromiseになり応答ポートが閉じる）ではなく
  // 同期リスナーから応答処理を呼び出して `true` を返す
  void respondFillKeyword(request.keyword, action, sendResponse)
  return true
})

// ページ読み込み完了時の初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

// エクスポート（TypeScriptでの型チェック用）
export { }
