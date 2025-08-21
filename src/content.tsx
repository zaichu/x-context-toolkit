// コンテンツスクリプト - ウェブページに注入される

import React from 'react'
import { createRoot } from 'react-dom/client'

console.log('X Context Toolkit コンテンツスクリプトが読み込まれました')

// 通知コンポーネント
const Notification: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '16px 20px',
        borderRadius: '8px',
        zIndex: 10000,
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        maxWidth: '300px',
        cursor: 'pointer',
        animation: 'slideIn 0.3s ease-out'
      }}
      onClick={onClose}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        X Context Toolkit
      </div>
      <div>{message}</div>
      <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
        クリックして閉じる
      </div>
    </div>
  )
}

// バックグラウンドスクリプトからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeAction') {
    console.log('バックグラウンドからアクション実行の指示を受信しました')
    
    // ページに対してアクションを実行
    executePageAction(request.timestamp)
    
    sendResponse({ 
      status: 'completed',
      url: window.location.href,
      title: document.title
    })
  }
})

function executePageAction(timestamp?: string) {
  // ページ情報を取得
  const pageInfo = {
    title: document.title,
    url: window.location.href,
    timestamp: timestamp || new Date().toISOString()
  }
  
  console.log('ページアクションを実行:', pageInfo)
  
  // 通知を表示
  showNotification(`現在のページ: ${pageInfo.title}`)
  
  // ページに何らかの処理を実行（例）
  highlightLinks()
}

function showNotification(message: string) {
  // 既存の通知があれば削除
  const existingNotification = document.getElementById('x-context-toolkit-notification')
  if (existingNotification) {
    existingNotification.remove()
  }
  
  // 通知用のコンテナを作成
  const container = document.createElement('div')
  container.id = 'x-context-toolkit-notification'
  document.body.appendChild(container)
  
  // CSS アニメーションを追加
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `
  document.head.appendChild(style)
  
  // React コンポーネントをレンダリング
  const root = createRoot(container)
  root.render(
    <Notification 
      message={message} 
      onClose={() => {
        root.unmount()
        container.remove()
        style.remove()
      }} 
    />
  )
  
  // 5秒後に自動で削除
  setTimeout(() => {
    if (container.parentNode) {
      root.unmount()
      container.remove()
      style.remove()
    }
  }, 5000)
}

function highlightLinks() {
  // ページ内のリンクをハイライト（例）
  const links = document.querySelectorAll('a[href]')
  links.forEach((link) => {
    const element = link as HTMLElement
    element.style.outline = '2px solid #667eea'
    element.style.outlineOffset = '2px'
    
    // 3秒後にハイライトを削除
    setTimeout(() => {
      element.style.outline = ''
      element.style.outlineOffset = ''
    }, 3000)
  })
  
  console.log(`${links.length}個のリンクをハイライトしました`)
}

// ページ読み込み完了時の処理
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMが読み込まれました')
  })
} else {
  console.log('ページが既に読み込まれています')
}

// エクスポート（TypeScriptでの型チェック用）
export {}