// ストレージユーティリティ関数
import { StorageData, MuteKeyword, Settings } from '../types'

// デフォルト設定
const DEFAULT_SETTINGS: Settings = {
  autoSync: true,
  showNotifications: true,
  theme: 'auto'
}

// ストレージからミュートキーワードを取得
export const getMuteKeywords = async (): Promise<MuteKeyword[]> => {
  const result = await chrome.storage.local.get('muteKeywords')
  return result.muteKeywords || []
}

// ミュートキーワードを追加
export const addMuteKeyword = async (keyword: string): Promise<void> => {
  const keywords = await getMuteKeywords()
  const newKeyword: MuteKeyword = {
    id: generateId(),
    keyword: keyword.trim(),
    createdAt: new Date().toISOString(),
    isActive: true
  }
  
  // 重複チェック
  const exists = keywords.some(k => k.keyword.toLowerCase() === keyword.toLowerCase())
  if (exists) {
    throw new Error('このキーワードは既に追加されています')
  }
  
  keywords.push(newKeyword)
  await chrome.storage.local.set({ muteKeywords: keywords })
}

// ミュートキーワードを削除
export const removeMuteKeyword = async (id: string): Promise<void> => {
  const keywords = await getMuteKeywords()
  const filtered = keywords.filter(k => k.id !== id)
  await chrome.storage.local.set({ muteKeywords: filtered })
}

// ミュートキーワードを切り替え
export const toggleMuteKeyword = async (id: string): Promise<void> => {
  const keywords = await getMuteKeywords()
  const keyword = keywords.find(k => k.id === id)
  if (keyword) {
    keyword.isActive = !keyword.isActive
    await chrome.storage.local.set({ muteKeywords: keywords })
  }
}

// 設定を取得
export const getSettings = async (): Promise<Settings> => {
  const result = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...result.settings }
}

// 設定を保存
export const saveSettings = async (settings: Partial<Settings>): Promise<void> => {
  const currentSettings = await getSettings()
  const newSettings = { ...currentSettings, ...settings }
  await chrome.storage.local.set({ settings: newSettings })
}

// IDを生成
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// ストレージをクリア
export const clearStorage = async (): Promise<void> => {
  await chrome.storage.local.clear()
}