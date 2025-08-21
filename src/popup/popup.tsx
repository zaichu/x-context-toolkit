// ポップアップメインコンポーネント
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { addMuteKeyword } from '../utils/storage'
import 'bootstrap/dist/css/bootstrap.min.css'

const Popup: React.FC = () => {
  const [keyword, setKeyword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      return
    }
    
    setIsSubmitting(true)
    setMessage('')
    
    try {
      await addMuteKeyword(trimmedKeyword)
      setMessage(`「${trimmedKeyword}」をXのミュートキーワードに追加中...`)
      setKeyword('')
      
      // 数秒後にポップアップを閉じる
      setTimeout(() => {
        window.close()
      }, 2000)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'キーワードの追加に失敗しました'
      setMessage(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container-fluid p-3" style={{ width: '350px', minHeight: '200px' }}>
      {/* ヘッダー */}
      <div className="d-flex align-items-center mb-3 pb-2 border-bottom">
        <div className="me-2">
          <i className="bi bi-shield-check text-primary" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h4 className="mb-0">X Context Toolkit</h4>
          <small className="text-muted">ミュートキーワード追加</small>
        </div>
      </div>

      {/* キーワード追加フォーム */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="ミュートするキーワードを入力..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={isSubmitting}
            maxLength={100}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !keyword.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                追加中...
              </>
            ) : (
              <>
                <i className="bi bi-plus-lg me-1"></i>
                追加
              </>
            )}
          </button>
        </div>
      </form>

      {/* メッセージ表示 */}
      {message && (
        <div className={`alert ${message.includes('失敗') || message.includes('エラー') ? 'alert-danger' : 'alert-success'} mb-3`}>
          <small>{message}</small>
        </div>
      )}

      {/* 使用方法 */}
      <div className="text-center">
        <small className="text-muted">
          <i className="bi bi-info-circle me-1"></i>
          X上でテキストを選択して右クリックでも追加可能
        </small>
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