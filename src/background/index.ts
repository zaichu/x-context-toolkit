// バックグラウンドサービスワーカー
import { addMuteKeyword } from '../utils/storage'

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(async () => {
  console.log('X Context Toolkit がインストールされました')

  // 右クリックメニューを作成
  await createContextMenu()
})

// 右クリックメニューを作成
const createContextMenu = async () => {
  // 既存のメニューを削除
  await chrome.contextMenus.removeAll()

  // 新しいメニューを追加
  chrome.contextMenus.create({
    id: 'add-mute-keyword',
    title: 'X ﾐｭｰﾄｷｰﾜｰﾄﾞに追加: "%s"',
    contexts: ['selection'],
    documentUrlPatterns: ['https://twitter.com/*', 'https://x.com/*']
  })
}

// 右クリックメニューがクリックされた時の処理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-mute-keyword' && info.selectionText) {
    try {
      const keyword = info.selectionText.trim()

      if (keyword.length > 100) {
        await showNotification('キーワードが長すぎます (最大100文字)', 'error')
        return
      }

      if (keyword.length === 0) {
        await showNotification('有効なキーワードを選択してください', 'error')
        return
      }

      // Xのミュートキーワードページに追加
      await addMuteKeyword(keyword)

      // 成功通知
      await showNotification(`「${keyword}」をXのミュートキーワード設定ページに入力中...`, 'success')

    } catch (error) {
      console.error('ミュートキーワード追加エラー:', error)
      const message = error instanceof Error ? error.message : 'キーワードの追加に失敗しました'
      await showNotification(message, 'error')
    }
  }
})

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('バックグラウンドでメッセージを受信:', request)

  if (request.action === 'fillMuteKeyword') {
    // ミュートキーワード設定ページでのフォーム入力処理
    sendResponse({ success: true })
    return true
  }

  if (request.action === 'showNotification') {
    showNotification(request.message, request.type || 'info')
    sendResponse({ success: true })
  }

  return true
})

// 通知を表示する関数
const showNotification = async (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const iconUrl = 'icons/icon48.png'
  const title = type === 'error' ? 'エラー' : 'X Context Toolkit'

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl,
      title,
      message
    })
  } catch (error) {
    console.error('通知の表示に失敗:', error)
  }
}

// エクスポート（TypeScriptでの型チェック用）
export { }