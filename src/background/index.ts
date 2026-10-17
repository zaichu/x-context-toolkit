// バックグラウンドサービスワーカー
import { addMuteKeywordToX } from '../utils/xMuteKeywords'
import { createMuteQueue, truncateForNotification } from './muteQueue'

// ミュートキーワード追加の唯一の所有者。Popup・右クリックはどちらもこのキューへenqueueするだけで、
// X側への保存はここで直列に行う。モジュールスコープに保持することで、
// Popupが閉じてonMessageの応答が済んだ後も、処理チェーンはService Worker内で継続する。
const muteQueue = createMuteQueue({
  addMuteKeywordToX,
  notifyFailure: async (keyword) => {
    await notifyFailure(`「${truncateForNotification(keyword)}」の追加に失敗しました`)
  },
})

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
// enqueue関数はPopupからのenqueueMuteKeywordと共通。受付成功時にクリック直後の成功通知は出さない
// （保存の成否はキュー処理側でしか分からないため、失敗時のみ後から通知される）。
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'add-mute-keyword' && info.selectionText) {
    const result = muteQueue.enqueue(info.selectionText)
    if (!result.accepted && result.error) {
      await notifyFailure(result.error)
    }
  }
})

// Popupおよびコンテンツスクリプトからのメッセージ(action)を処理
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('バックグラウンドでメッセージを受信:', request)

  if (request.action === 'enqueueMuteKeyword') {
    // 検証・キュー投入は同期的に完了するため、X側への保存完了を待たずすぐ応答する
    sendResponse(muteQueue.enqueue(request.keyword))
    return false
  }

  if (request.action === 'notifyFailure') {
    notifyFailure(request.message)
    sendResponse({ success: true })
    return true
  }

  return true
})

// 失敗を拡張機能の通知として表示する
const notifyFailure = async (message: string) => {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'エラー',
      message
    })
  } catch (error) {
    console.error('通知の表示に失敗:', error)
  }
}
