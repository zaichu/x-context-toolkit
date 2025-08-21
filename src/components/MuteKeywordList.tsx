// ミュートキーワード一覧コンポーネント
import React from 'react'
import { MuteKeyword } from '../types'

interface MuteKeywordListProps {
  keywords: MuteKeyword[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  loading?: boolean
}

export const MuteKeywordList: React.FC<MuteKeywordListProps> = ({
  keywords,
  onToggle,
  onRemove,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="d-flex justify-content-center p-3">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">読み込み中...</span>
        </div>
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div className="text-center p-3 text-muted">
        <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}></i>
        ミュートキーワードがありません
      </div>
    )
  }

  return (
    <div className="list-group">
      {keywords.map((keyword) => (
        <div
          key={keyword.id}
          className={`list-group-item d-flex justify-content-between align-items-center ${
            !keyword.isActive ? 'bg-light text-muted' : ''
          }`}
        >
          <div className="d-flex align-items-center flex-grow-1">
            <div className="form-check me-3">
              <input
                className="form-check-input"
                type="checkbox"
                id={`keyword-${keyword.id}`}
                checked={keyword.isActive}
                onChange={() => onToggle(keyword.id)}
              />
            </div>
            <div className="flex-grow-1">
              <div className={`fw-semibold ${!keyword.isActive ? 'text-decoration-line-through' : ''}`}>
                {keyword.keyword}
              </div>
              <small className="text-muted">
                {new Date(keyword.createdAt).toLocaleDateString('ja-JP')}
              </small>
            </div>
          </div>
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm ${keyword.isActive ? 'btn-warning' : 'btn-success'}`}
              onClick={() => onToggle(keyword.id)}
              title={keyword.isActive ? '無効にする' : '有効にする'}
            >
              <i className={`bi ${keyword.isActive ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => onRemove(keyword.id)}
              title="削除する"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}