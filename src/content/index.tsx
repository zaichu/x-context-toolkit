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

// 成功通知を表示する関数
const showSuccessMessage = (keyword: string) => {
  const messageDiv = document.createElement('div')
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1d9bf0;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    z-index: 10000;
    font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    animation: slideIn 0.3s ease-out;
  `
  
  messageDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <span>「${keyword}」をミュートキーワードに追加しました</span>
    </div>
  `
  
  // アニメーションCSS
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `
  document.head.appendChild(style)
  
  document.body.appendChild(messageDiv)
  
  // 3秒後に削除
  setTimeout(() => {
    messageDiv.style.animation = 'slideOut 0.3s ease-in'
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv)
        style.remove()
      }
    }, 300)
  }, 3000)
}

// エクスポート（TypeScriptでの型チェック用）
export {}