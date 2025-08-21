// ポップアップメインコンポーネント
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useMuteKeywords } from '../hooks/useMuteKeywords'
import { AddKeywordForm } from '../components/AddKeywordForm'
import 'bootstrap/dist/css/bootstrap.min.css'

const Popup: React.FC = () => {
  const { addKeyword } = useMuteKeywords()

  return (
    <div className="container-fluid p-3" style={{ width: '400px', minHeight: '300px' }}>
      {/* ヘッダー */}
      <div className="d-flex align-items-center mb-3 pb-2 border-bottom">
        <div className="me-2">
          <i className="bi bi-shield-check text-primary" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h4 className="mb-0">X Context Toolkit</h4>
        </div>
      </div>

      {/* キーワード追加フォーム */}
      <AddKeywordForm onAdd={addKeyword} />
    </div>
  )
}

// DOM要素を取得してReactアプリをマウント
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}