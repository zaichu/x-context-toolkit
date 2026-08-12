// ポップアップメインコンポーネント
import React, { useState } from 'react'
import { addMuteKeyword } from '../utils/storage'

export const Popup: React.FC = () => {
  const [keyword, setKeyword] = useState('')
  const version = chrome.runtime.getManifest().version
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
      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center">
        <div className="me-2">
          <i className="bi bi-shield-check text-primary" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h4 className="mb-0">Xにミュートキーワードを追加</h4>
          <small className="text-secondary">ワンクリックブロック対応版</small>
        </div>
        </div>
        <span className="badge text-bg-dark border">v{version}</span>
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
