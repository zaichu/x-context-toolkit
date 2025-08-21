// ミュートキーワード管理用カスタムフック
import { useState, useEffect, useCallback } from 'react'
import { MuteKeyword } from '../types'
import { getMuteKeywords, addMuteKeyword, removeMuteKeyword, toggleMuteKeyword } from '../utils/storage'

export const useMuteKeywords = () => {
  const [keywords, setKeywords] = useState<MuteKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // キーワードを読み込み
  const loadKeywords = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getMuteKeywords()
      setKeywords(data)
    } catch (err) {
      setError('キーワードの読み込みに失敗しました')
      console.error('Failed to load keywords:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // キーワードを追加
  const addKeyword = useCallback(async (keyword: string) => {
    try {
      setError(null)
      await addMuteKeyword(keyword)
      await loadKeywords() // リロード
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'キーワードの追加に失敗しました'
      setError(errorMessage)
      console.error('Failed to add keyword:', err)
      return false
    }
  }, [loadKeywords])

  // キーワードを削除
  const removeKeyword = useCallback(async (id: string) => {
    try {
      setError(null)
      await removeMuteKeyword(id)
      await loadKeywords() // リロード
      return true
    } catch (err) {
      setError('キーワードの削除に失敗しました')
      console.error('Failed to remove keyword:', err)
      return false
    }
  }, [loadKeywords])

  // キーワードを切り替え
  const toggleKeyword = useCallback(async (id: string) => {
    try {
      setError(null)
      await toggleMuteKeyword(id)
      await loadKeywords() // リロード
      return true
    } catch (err) {
      setError('キーワードの切り替えに失敗しました')
      console.error('Failed to toggle keyword:', err)
      return false
    }
  }, [loadKeywords])

  // エラーをクリア
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 初期読み込み
  useEffect(() => {
    loadKeywords()
  }, [loadKeywords])

  // ストレージの変更を監視
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.muteKeywords) {
        setKeywords(changes.muteKeywords.newValue || [])
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  return {
    keywords,
    loading,
    error,
    addKeyword,
    removeKeyword,
    toggleKeyword,
    loadKeywords,
    clearError
  }
}