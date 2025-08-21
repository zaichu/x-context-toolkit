// ポップアップメインコンポーネント
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { addMuteKeyword } from '../utils/storage'
import 'bootstrap/dist/css/bootstrap.min.css'

const Popup: React.FC = () => {
  const [keyword, setKeyword] = useState('')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      return
    }

    try {
      await addMuteKeyword(trimmedKeyword)
      setKeyword('')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'キーワードの追加に失敗しました'
      console.error('ミュートキーワード追加エラー:', errorMessage)
    }
  }

  return (
    <div className="container-fluid p-3" style={{ width: '350px' }}>
      {/* ヘッダー */}
      <div className="d-flex align-items-center mb-3 pb-2 border-bottom">
        <div className="me-2">
          <i className="bi bi-shield-check text-primary" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h4 className="mb-0">Xにミュートキーワードを追加</h4>
        </div>
      </div>

      {/* キーワード追加フォーム */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="input-group">
          <input type="text" className="form-control" placeholder="ミュートするキーワードを入力..."
            value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={100} />
          <button type="submit" className="btn btn-primary" disabled={!keyword.trim()}>
            <i className="bi bi-plus-lg me-1"></i>
            追加
          </button>
        </div>
      </form>
    </div>
  )
}

// DOM要素を取得してReactアプリをマウント
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}