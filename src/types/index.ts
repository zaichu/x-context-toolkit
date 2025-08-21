// 型定義ファイル

// ミュートキーワード関連の型
export interface MuteKeyword {
  id: string
  keyword: string
  createdAt: string
  isActive: boolean
}

// ストレージ関連の型
export interface StorageData {
  muteKeywords: MuteKeyword[]
  settings: Settings
}

// 設定関連の型
export interface Settings {
  autoSync: boolean
  showNotifications: boolean
  theme: 'light' | 'dark' | 'auto'
}

// メッセージ関連の型
export interface Message {
  action: string
  data?: any
}

export interface MuteKeywordMessage extends Message {
  action: 'addMuteKeyword' | 'removeMuteKeyword' | 'getMuteKeywords'
  data?: {
    keyword?: string
    id?: string
    keywords?: MuteKeyword[]
  }
}

// コンテンツスクリプト関連の型
export interface SelectedTextInfo {
  text: string
  element: HTMLElement
  position: { x: number; y: number }
}

// X(Twitter)関連の型
export interface TwitterElement {
  tweet: HTMLElement
  text: string
  author: string
}