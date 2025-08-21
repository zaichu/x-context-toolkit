// バックグラウンドサービスワーカー

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Context Toolkit がインストールされました')
  
  // 初期設定
  chrome.storage.local.set({
    extensionEnabled: true,
    installDate: new Date().toISOString()
  })
})

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('メッセージを受信:', request)
  
  if (request.action === 'buttonClicked') {
    console.log('ポップアップからアクション実行の指示を受信しました')
    
    // 現在のアクティブタブを取得してコンテンツスクリプトにメッセージを送信
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'executeAction',
          timestamp: request.timestamp || new Date().toISOString()
        }).then(() => {
          console.log('コンテンツスクリプトにメッセージを送信しました')
        }).catch((error) => {
          console.log('コンテンツスクリプトへのメッセージ送信に失敗:', error)
        })
      }
    })
    
    // ポップアップに応答を返す
    sendResponse({ 
      status: 'success', 
      message: 'アクションを実行しました',
      timestamp: new Date().toISOString()
    })
  }
  
  return true // 非同期レスポンスを有効にする
})

// タブが更新された時の処理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('タブが更新されました:', tab.url)
    
    // 特定のサイトでの追加処理があればここに記述
    if (tab.url.includes('example.com')) {
      // 例: 特定のサイトでの処理
      console.log('Example.comが読み込まれました')
    }
  }
})

// アラームイベント（定期実行など）
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('アラームが発生:', alarm.name)
  
  if (alarm.name === 'periodicCheck') {
    // 定期的なチェック処理
    console.log('定期チェックを実行中...')
  }
})

// エクスポート（TypeScriptでの型チェック用）
export {}