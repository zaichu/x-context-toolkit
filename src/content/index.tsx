// コンテンツスクリプト - X(Twitter)ページに注入される
import React from 'react'
import { createRoot } from 'react-dom/client'
import { getMuteKeywords } from '../utils/storage'
import { getTweetElements, containsMuteKeyword, hideTweet, showTweet, isTwitterPage } from '../utils/dom'
import { MuteKeyword } from '../types'

console.log('X Context Toolkit コンテンツスクリプトが読み込まれました')

// ミュートキーワードをキャッシュ
let muteKeywords: string[] = []
let isInitialized = false

// 初期化
const initialize = async () => {
  if (!isTwitterPage()) {
    console.log('X(Twitter)以外のページなので処理をスキップします')
    return
  }
  
  try {
    // ミュートキーワードを読み込み
    const keywords = await getMuteKeywords()
    muteKeywords = keywords.filter(k => k.isActive).map(k => k.keyword)
    
    console.log(`${muteKeywords.length}個のアクティブなミュートキーワードを読み込みました:`, muteKeywords)
    
    // 初回チェック
    checkAndHideTweets()
    
    // DOM変更を監視してリアルタイムでチェック
    startMutationObserver()
    
    // スクロールイベントでも定期チェック（パフォーマンス考慮）
    let scrollTimeout: NodeJS.Timeout
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(checkAndHideTweets, 500)
    })
    
    isInitialized = true
    console.log('X Context Toolkit の初期化が完了しました')
    
  } catch (error) {
    console.error('初期化エラー:', error)
  }
}

// ツイートをチェックして該当するものを非表示にする
const checkAndHideTweets = () => {
  if (muteKeywords.length === 0) return
  
  const tweets = getTweetElements()
  let hiddenCount = 0
  
  tweets.forEach(({ tweet, text }) => {
    // 既にミュート済みかチェック
    if (tweet.getAttribute('data-muted') === 'true') return
    
    // ミュートキーワードをチェック
    if (containsMuteKeyword(text, muteKeywords)) {
      hideTweet(tweet)
      hiddenCount++
    }
  })
  
  if (hiddenCount > 0) {
    console.log(`${hiddenCount}件のツイートを非表示にしました`)
  }
}

// DOM変更を監視
const startMutationObserver = () => {
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false
    
    mutations.forEach((mutation) => {
      // 新しいノードが追加された場合のみチェック
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            // ツイート関連の要素が追加された場合
            if (element.matches('[data-testid="tweet"]') || 
                element.querySelector('[data-testid="tweet"]')) {
              shouldCheck = true
              break
            }
          }
        }
      }
    })
    
    if (shouldCheck) {
      // パフォーマンス考慮で少し遅延
      setTimeout(checkAndHideTweets, 100)
    }
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// バックグラウンドスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('コンテンツスクリプトでメッセージを受信:', request)
  
  if (request.action === 'pageLoaded') {
    if (!isInitialized) {
      await initialize()
    }
    sendResponse({ status: 'initialized' })
  }
  
  if (request.action === 'muteKeywordAdded') {
    // 新しいキーワードが追加された時の処理
    const keywords = await getMuteKeywords()
    muteKeywords = keywords.filter(k => k.isActive).map(k => k.keyword)
    
    // 即座にチェック
    checkAndHideTweets()
    
    sendResponse({ status: 'updated' })
  }
  
  return true
})

// ストレージの変更を監視
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.muteKeywords) {
    console.log('ミュートキーワードが更新されました')
    const keywords: MuteKeyword[] = changes.muteKeywords.newValue || []
    muteKeywords = keywords.filter(k => k.isActive).map(k => k.keyword)
    
    // すべてのツイートを再表示してから再チェック
    const tweets = getTweetElements()
    tweets.forEach(({ tweet }) => {
      if (tweet.getAttribute('data-muted') === 'true') {
        showTweet(tweet)
      }
    })
    
    // 少し遅延してから再チェック
    setTimeout(checkAndHideTweets, 100)
  }
})

// ページ読み込み完了時の初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

// 通知コンポーネント（必要に応じて使用）
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toastId = 'x-context-toolkit-toast-' + Date.now()
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0" role="alert" aria-live="assertive" aria-atomic="true" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `
  
  document.body.insertAdjacentHTML('beforeend', toastHtml)
  
  const toastElement = document.getElementById(toastId)
  if (toastElement) {
    // Bootstrap のトーストを初期化（CDN読み込み後）
    setTimeout(() => {
      // @ts-ignore
      if (typeof bootstrap !== 'undefined') {
        // @ts-ignore
        const toast = new bootstrap.Toast(toastElement)
        toast.show()
        
        // 自動削除
        setTimeout(() => {
          toastElement.remove()
        }, 5000)
      } else {
        // Bootstrap が読み込まれていない場合は手動で削除
        setTimeout(() => {
          toastElement.remove()
        }, 3000)
      }
    }, 100)
  }
}

// エクスポート（TypeScriptでの型チェック用）
export {}