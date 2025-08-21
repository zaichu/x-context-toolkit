import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './popup.css'

const Popup: React.FC = () => {
  const [message, setMessage] = useState<string>('')

  const handleButtonClick = async () => {
    try {
      // バックグラウンドスクリプトにメッセージを送信
      const response = await chrome.runtime.sendMessage({
        action: 'buttonClicked',
        timestamp: new Date().toISOString()
      })
      
      setMessage(`応答: ${response?.status || 'success'}`)
      console.log('バックグラウンドからの応答:', response)
      
      // 3秒後にポップアップを閉じる
      setTimeout(() => {
        window.close()
      }, 3000)
    } catch (error) {
      console.error('エラー:', error)
      setMessage('エラーが発生しました')
    }
  }

  return (
    <div className="popup-container">
      <h1>X Context Toolkit</h1>
      <div className="content">
        <p>Chrome拡張機能が正常に動作しています。</p>
        <button 
          className="action-button" 
          onClick={handleButtonClick}
          type="button"
        >
          アクション実行
        </button>
        {message && (
          <div className="message">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

// DOM要素を取得してReactアプリをマウント
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}