// ポップアップメインコンポーネント
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useMuteKeywords } from '../hooks/useMuteKeywords'
import { MuteKeywordList } from '../components/MuteKeywordList'
import { AddKeywordForm } from '../components/AddKeywordForm'
import 'bootstrap/dist/css/bootstrap.min.css'

const Popup: React.FC = () => {
  const {
    keywords,
    loading,
    error,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    clearError
  } = useMuteKeywords()

  return (
    <div className="container-fluid p-3" style={{ width: '400px', minHeight: '300px' }}>
      {/* ヘッダー */}
      <div className="d-flex align-items-center mb-3 pb-2 border-bottom">
        <div className="me-2">
          <i className="bi bi-shield-check text-primary" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h4 className="mb-0">X Context Toolkit</h4>
          <small className="text-muted">ミュートキーワード管理</small>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={clearError}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* キーワード追加フォーム */}
      <AddKeywordForm onAdd={addKeyword} loading={loading} />

      {/* 統計情報 */}
      <div className="row g-2 mb-3">
        <div className="col">
          <div className="card bg-light">
            <div className="card-body text-center p-2">
              <div className="fw-bold text-primary">{keywords.length}</div>
              <small className="text-muted">総数</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card bg-light">
            <div className="card-body text-center p-2">
              <div className="fw-bold text-success">
                {keywords.filter(k => k.isActive).length}
              </div>
              <small className="text-muted">有効</small>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card bg-light">
            <div className="card-body text-center p-2">
              <div className="fw-bold text-warning">
                {keywords.filter(k => !k.isActive).length}
              </div>
              <small className="text-muted">無効</small>
            </div>
          </div>
        </div>
      </div>

      {/* キーワード一覧 */}
      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">
            <i className="bi bi-list-ul me-2"></i>
            ミュートキーワード一覧
          </h6>
          {keywords.length > 0 && (
            <small className="text-muted">
              クリックで切り替え
            </small>
          )}
        </div>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <MuteKeywordList
            keywords={keywords}
            onToggle={toggleKeyword}
            onRemove={removeKeyword}
            loading={loading}
          />
        </div>
      </div>

      {/* フッター */}
      <div className="text-center mt-3 pt-2 border-top">
        <small className="text-muted">
          <i className="bi bi-info-circle me-1"></i>
          X(Twitter)でテキストを選択して右クリックでキーワード追加
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