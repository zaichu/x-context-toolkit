// X(Twitter)のミュートキーワード機能用DOM操作ユーティリティ
import {
  type BackgroundWindowHandle,
  openBackgroundWindow,
  waitForTabLoad,
  closeBackgroundWindow,
  revealBackgroundWindowForInspection,
} from './backgroundWindow'

// ミュートキーワード設定ページのURL
export const ADD_MUTE_KEYWORDS_URL = 'https://x.com/settings/add_muted_keyword'

// ミュートキーワードを追加する関数
export const addMuteKeywordToX = async (keyword: string): Promise<boolean> => {
  let handle: BackgroundWindowHandle | null = null

  try {
    // 閲覧中のウィンドウに影響を与えない専用ウィンドウでミュートキーワード追加ページを開く
    handle = await openBackgroundWindow(ADD_MUTE_KEYWORDS_URL)

    // ページが読み込まれるまで待機
    await waitForTabLoad(handle.tabId)

    // コンテンツスクリプトにキーワード入力を指示
    const result = await chrome.tabs.sendMessage(handle.tabId, {
      action: 'fillMuteKeyword',
      keyword: keyword.trim()
    })

    if (result?.success) {
      console.log(`ミュートキーワード「${keyword}」を追加しました`)
      await closeBackgroundWindow(handle.windowId)
      return true
    } else {
      throw new Error('キーワードの入力に失敗しました')
    }

  } catch (error) {
    console.error('ミュートキーワード追加エラー:', error)
    if (handle) {
      // 失敗時は原因を確認できるよう専用ウィンドウを通常表示へ戻す
      await revealBackgroundWindowForInspection(handle.windowId)
    }
    return false
  }
}

// 現在のページがミュートキーワード設定ページかチェック
export const isMuteKeywordPage = (): boolean => {
  return window.location.href.includes(ADD_MUTE_KEYWORDS_URL)
}

// ミュートキーワード入力フォームのセレクター
const SELECTORS = {
  // キーワード入力フィールド
  keywordInput: 'input[name="keyword"]',
  // キーワード入力フィールド（代替）
  keywordInputAlt: 'input[placeholder*="キーワード"], input[placeholder*="keyword"]',
  // 追加ボタン
  addButton: 'button[data-testid="settingsDetailSave"',
  // 追加ボタン（代替）
  addButtonAlt: 'button[type="submit"], button:contains("追加")',
  // フォーム
  form: 'form',
  // メインコンテナ
  container: '[data-testid="primaryColumn"]'
}

// DOM操作でミュートキーワードを入力・追加
export const fillMuteKeywordForm = async (keyword: string): Promise<boolean> => {
  try {
    // ページが完全に読み込まれるまで待機
    await waitForElements()

    // キーワード入力フィールドを取得
    const inputField = findKeywordInput()
    if (!inputField) {
      throw new Error('キーワード入力フィールドが見つかりません')
    }

    // キーワードを入力
    await inputKeyword(inputField, keyword)

    // 少し待機してから追加ボタンをクリック
    await sleep(500)

    // 追加ボタンを取得してクリック
    const addButton = findAddButton()
    if (!addButton) {
      throw new Error('追加ボタンが見つかりません')
    }

    // ボタンをクリック
    addButton.click()

    // 追加完了まで待機
    await sleep(1000)

    console.log(`ミュートキーワード「${keyword}」を入力しました`)
    return true

  } catch (error) {
    console.error('フォーム入力エラー:', error)
    return false
  }
}

// 要素が読み込まれるまで待機
const waitForElements = (): Promise<void> => {
  return new Promise((resolve) => {
    let attempts = 0

    const checkInterval = setInterval(() => {
      attempts++
      const keywordInput = findKeywordInput()

      // より厳密な条件でチェック
      if (keywordInput && keywordInput.offsetParent && !keywordInput.disabled) {
        clearInterval(checkInterval)
        console.log(`要素検出成功: ${attempts}回目の試行で発見`)
        resolve()
      }

    }, 100)
  })
}

// キーワード入力フィールドを検索
const findKeywordInput = (): HTMLInputElement | null => {
  const selectors = [
    SELECTORS.keywordInput
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLInputElement
    if (element && element.offsetParent) { // 表示されている要素のみ
      return element
    }
  }

  return null
}

// 追加ボタンを検索
const findAddButton = (): HTMLButtonElement | null => {
  const selectors = [
    SELECTORS.addButton,
    'button[type="submit"]',
    'button:not([disabled])'
  ]

  for (const selector of selectors) {
    const buttons = document.querySelectorAll(selector) as NodeListOf<HTMLButtonElement>
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || ''
      if (text.includes('保存') && button.offsetParent && !button.disabled) {
        return button
      }
    }
  }

  return null
}

// キーワードを入力
const inputKeyword = async (input: HTMLInputElement, keyword: string): Promise<void> => {
  // フォーカスを当てる
  input.focus()

  // 既存の値をクリア
  input.value = ''

  // イベントをトリガー
  input.dispatchEvent(new Event('focus', { bubbles: true }))
  input.dispatchEvent(new Event('input', { bubbles: true }))

  // 文字を一文字ずつ入力（Reactの仮想DOMに対応）
  for (let i = 0; i < keyword.length; i++) {
    input.value = keyword.substring(0, i + 1)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(50) // 少し待機
  }

  // 最終的なイベント
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.dispatchEvent(new Event('blur', { bubbles: true }))
}

// 待機用ユーティリティ
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}