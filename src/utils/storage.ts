// DOM操作でXのミュートキーワードページに追加
import { addMuteKeywordToX } from './xMuteKeywords'

// ミュートキーワードを追加（Xの設定ページに直接追加）
export const addMuteKeyword = async (keyword: string): Promise<void> => {
  const success = await addMuteKeywordToX(keyword)
  
  if (!success) {
    throw new Error('Xのミュートキーワード追加に失敗しました')
  }
}