// キーワード追加フォームコンポーネント
import React, { useState } from 'react'

interface AddKeywordFormProps {
  onAdd: (keyword: string) => Promise<boolean>
  loading?: boolean
}

export const AddKeywordForm: React.FC<AddKeywordFormProps> = ({ onAdd, loading = false }) => {
  const [keyword, setKeyword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      return
    }
    
    setIsSubmitting(true)
    try {
      const success = await onAdd(trimmedKeyword)
      if (success) {
        setKeyword('') // 成功時のみクリア
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value)
  }

  const isDisabled = loading || isSubmitting || !keyword.trim()

  return (
    <form onSubmit={handleSubmit} className="mb-3">
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          placeholder="ミュートするキーワードを入力..."
          value={keyword}
          onChange={handleKeywordChange}
          disabled={loading || isSubmitting}
          maxLength={100}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isDisabled}
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
      {keyword.trim().length > 50 && (
        <div className="form-text text-warning">
          <i className="bi bi-exclamation-triangle me-1"></i>
          長いキーワードは意図しないマッチが発生する可能性があります
        </div>
      )}
    </form>
  )
}