// コンテンツスクリプト - ミュートキーワード設定ページ・タイムライン用
import {
  isMuteKeywordPage,
  isMuteKeywordsListPage,
  fillMuteKeywordForm,
  prepareAndFillMuteKeywordForm,
} from '../utils/xMuteKeywords'
import type { FillMuteKeywordResponse } from '../utils/xMuteKeywords'
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
    fill: fillMuteKeywordForm,
  },
  prepareAndFillMuteKeyword: {
    isTargetPage: isMuteKeywordsListPage,
    // 追加リンクをクリックしてSPA遷移させてからフォームにキーワードを入力
    fill: prepareAndFillMuteKeywordForm,
  },
} as const

type FillAction = (typeof FILL_ACTIONS)[keyof typeof FILL_ACTIONS]

const respondFillKeyword = async (
  keyword: string,
  action: FillAction,
  sendResponse: (response: FillMuteKeywordResponse) => void,
): Promise<void> => {
  try {
    if (!action.isTargetPage()) {
      sendResponse({ success: false })
      return
    }

    const result = await action.fill(keyword)

    if (result.success) {
      console.log(`ミュートキーワード「${keyword}」を入力しました`)
      sendResponse({ success: true, timings: result.timings })
    } else {
      sendResponse({
        success: false,
        unconfirmed: result.unconfirmed,
        timings: result.timings,
      })
    }
  } catch (error) {
    console.error('ミュートキーワード入力エラー:', error)
    sendResponse({ success: false })
  }
}

// バックグラウンドスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('コンテンツスクリプトでメッセージを受信:', request)

  const action = FILL_ACTIONS[request.action as keyof typeof FILL_ACTIONS]
  if (!action || !request.keyword) {
    sendResponse({ success: false })
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
