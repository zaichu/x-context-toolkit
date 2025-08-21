// ミュートキーワード管理用カスタムフック
import { useCallback } from 'react'
import { addMuteKeyword } from '../utils/storage'

export const useMuteKeywords = () => {

  // キーワードを追加
  const addKeyword = useCallback(async (keyword: string) => {
    try {
      await addMuteKeyword(keyword)
      return true
    } catch (err) {
      console.error('Failed to add keyword:', err)
      return false
    }
  }, [])

  return {
    addKeyword,
  }
}