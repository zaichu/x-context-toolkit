// コンテンツスクリプト - ミュートキーワード設定ページ用
import { isMuteKeywordPage, fillMuteKeywordForm } from '../utils/xMuteKeywords'

console.log('X Context Toolkit コンテンツスクリプトが読み込まれました')

// ページの初期化
const initialize = () => {
  if (isMuteKeywordPage()) {
    console.log('Xのミュートキーワード設定ページを検出しました')
  }
}

// バックグラウンドスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('コンテンツスクリプトでメッセージを受信:', request)

  if (request.action === 'fillMuteKeyword' && request.keyword) {
    try {
      if (!isMuteKeywordPage()) {
        sendResponse({ success: false, error: 'ミュートキーワード設定ページではありません' })
        return
      }

      // フォームにキーワードを入力
      const success = await fillMuteKeywordForm(request.keyword)

      if (success) {
        console.log(`ミュートキーワード「${request.keyword}」を入力しました`)
        sendResponse({ success: true })
      } else {
        sendResponse({ success: false, error: 'フォームの入力に失敗しました' })
      }

    } catch (error) {
      console.error('ミュートキーワード入力エラー:', error)
      sendResponse({ success: false, error: error instanceof Error ? error.message : '不明なエラー' })
    }
    return true // 非同期レスポンスを有効にする
  }

  sendResponse({ success: false, error: '不明なアクション' })
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