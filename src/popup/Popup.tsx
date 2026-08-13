// ポップアップメインコンポーネント
import React, { useState } from 'react'
import { enqueueMuteKeyword } from './enqueueMuteKeyword'

type Status = 'idle' | 'submitting' | 'accepted' | 'error'

export const Popup: React.FC = () => {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const version = chrome.runtime.getManifest().version
  const isSubmitting = status === 'submitting'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 送信中は二重送信を防ぐ
    if (isSubmitting) return

    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      return
    }

    setStatus('submitting')
    setErrorMessage('')

    try {
      // Service Workerへ受付を依頼するのみ。X側への保存完了は待たず、
      // 検証・キュー投入が済んだ時点でのすぐ返ってくる応答だけを待つ
      const response = await enqueueMuteKeyword(trimmedKeyword)

      if (response?.accepted) {
        setKeyword('')
        setStatus('accepted')
      } else {
        setErrorMessage(response?.error ?? 'キーワードの追加に失敗しました')
        setStatus('error')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'キーワードの追加に失敗しました'
      console.error('ミュートキーワード追加エラー:', message)
      setErrorMessage(message)
      setStatus('error')
    }
  }

  return (
    <div className="container-fluid p-3" style={{ width: '350px' }}>
      {/* ヘッダー */}
      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <div>
          <h4 className="mb-0">Xにミュートキーワードを追加</h4>
          <small className="text-secondary">ワンクリックブロック対応版</small>
        </div>
        <span className="badge text-bg-dark border">v{version}</span>
      </div>

      {/* キーワード追加フォーム */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="input-group">
          <input type="text" className="form-control" placeholder="ミュートするキーワードを入力..."
            value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={100}
            disabled={isSubmitting} />
          <button type="submit" className="btn btn-primary" disabled={!keyword.trim() || isSubmitting}>
            {isSubmitting ? '追加中...' : '追加'}
          </button>
        </div>
      </form>

      {status === 'accepted' && (
        <div className="alert alert-success py-2 mb-0" role="status">
          追加を受け付けました。バックグラウンドで処理します
        </div>
      )}
      {status === 'error' && (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  )
}
