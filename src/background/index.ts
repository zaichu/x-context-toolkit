// バックグラウンドサービスワーカー
import { getMuteKeywords, addMuteKeyword } from '../utils/storage'

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(async () => {
  console.log('X Context Toolkit がインストールされました')
  
  // 初期設定
  await chrome.storage.local.set({
    installDate: new Date().toISOString(),
    version: chrome.runtime.getManifest().version
  })

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
    title: 'X ミュートキーワードに追加: "%s"',
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
        // 長すぎるキーワードは拒否
        await showNotification('キーワードが長すぎます (最大100文字)', 'error')
        return
      }
      
      await addMuteKeyword(keyword)
      
      // 成功通知
      await showNotification(`「${keyword}」をミュートキーワードに追加しました`, 'success')
      
      // コンテンツスクリプトに更新を通知
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'muteKeywordAdded',
          keyword
        }).catch(() => {
          // エラーは無視（コンテンツスクリプトが読み込まれていない可能性）
        })
      }
      
    } catch (error) {
      console.error('ミュートキーワード追加エラー:', error)
      const message = error instanceof Error ? error.message : 'キーワードの追加に失敗しました'
      await showNotification(message, 'error')
    }
  }
})

// ポップアップや他のスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('バックグラウンドでメッセージを受信:', request)
  
  if (request.action === 'getMuteKeywords') {
    getMuteKeywords().then(keywords => {
      sendResponse({ keywords })
    }).catch(error => {
      sendResponse({ error: error.message })
    })
    return true // 非同期レスポンスを有効にする
  }
  
  if (request.action === 'showNotification') {
    showNotification(request.message, request.type || 'info')
    sendResponse({ success: true })
  }
})

// 通知を表示する関数
const showNotification = async (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const iconUrl = type === 'error' ? 'icons/icon48.png' : 'icons/icon48.png'
  const title = type === 'error' ? 'エラー' : 'X Context Toolkit'
  
  await chrome.notifications.create({
    type: 'basic',
    iconUrl,
    title,
    message
  })
}

// タブが更新された時の処理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // X(Twitter)ページが完全に読み込まれた時
  if (changeInfo.status === 'complete' && tab.url && isTwitterUrl(tab.url)) {
    console.log('X(Twitter)ページが読み込まれました:', tab.url)
    
    // コンテンツスクリプトに初期化を通知
    chrome.tabs.sendMessage(tabId, {
      action: 'pageLoaded',
      url: tab.url
    }).catch(() => {
      // エラーは無視（コンテンツスクリプトがまだ読み込まれていない可能性）
    })
  }
})

// URLがX(Twitter)かチェック
const isTwitterUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === 'twitter.com' || urlObj.hostname === 'x.com'
  } catch {
    return false
  }
}

// 定期的なクリーンアップ（必要に応じて）
chrome.alarms.create('cleanup', { periodInMinutes: 60 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    console.log('定期クリーンアップを実行中...')
    // 必要に応じてクリーンアップ処理を追加
  }
})

// エクスポート（TypeScriptでの型チェック用）
export {}