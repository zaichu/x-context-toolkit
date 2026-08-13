// X(Twitter)のミュートキーワード機能用DOM操作ユーティリティ
import {
  openBackgroundTab,
  waitForTabLoad,
  closeBackgroundTab,
} from './backgroundTab'

// ミュートキーワード設定ページのURL
export const ADD_MUTE_KEYWORDS_URL = 'https://x.com/settings/add_muted_keyword'

// ミュートキーワードを追加する関数
export const addMuteKeywordToX = async (keyword: string): Promise<boolean> => {
  let tabId: number | null = null

  try {
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) throw new Error('キーワードが空です')

    // フォーカスを奪わない非アクティブな一時タブでX公式設定画面を開く
    tabId = await openBackgroundTab(ADD_MUTE_KEYWORDS_URL)

    // ページが読み込まれるまで待機
    await waitForTabLoad(tabId)

    // コンテンツスクリプトにキーワード入力を指示
    const result = await withTimeout(
      chrome.tabs.sendMessage(tabId, { action: 'fillMuteKeyword', keyword: trimmedKeyword }),
      15_000,
      'X設定画面からの応答がタイムアウトしました',
    )

    if (result?.success) {
      console.log(`ミュートキーワード「${keyword}」を追加しました`)
      return true
    } else {
      throw new Error('キーワードの入力に失敗しました')
    }

  } catch (error) {
    console.error('ミュートキーワード追加エラー:', error)
    return false
  } finally {
    if (tabId !== null) await closeBackgroundTab(tabId)
  }
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(
      (value) => { clearTimeout(timeout); resolve(value) },
      (error) => { clearTimeout(timeout); reject(error) },
    )
  })

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
const waitForElements = (timeoutMs = 15_000): Promise<void> => {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const startedAt = Date.now()

    const checkInterval = setInterval(() => {
      attempts++
      const keywordInput = findKeywordInput()

      // より厳密な条件でチェック
      if (keywordInput && keywordInput.offsetParent && !keywordInput.disabled) {
        clearInterval(checkInterval)
        console.log(`要素検出成功: ${attempts}回目の試行で発見`)
        resolve()
        return
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(checkInterval)
        reject(new Error('ミュートキーワード入力欄が見つかりませんでした'))
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
  setNativeInputValue(input, '')

  // イベントをトリガー
  input.dispatchEvent(new Event('focus', { bubbles: true }))
  input.dispatchEvent(new Event('input', { bubbles: true }))

  // 文字を一文字ずつ入力（Reactの仮想DOMに対応）
  for (let i = 0; i < keyword.length; i++) {
    setNativeInputValue(input, keyword.substring(0, i + 1))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(50) // 少し待機
  }

  // 最終的なイベント
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.dispatchEvent(new Event('blur', { bubbles: true }))
}

// React管理下のinputでも変更として認識されるよう、ネイティブsetterを使う。
const setNativeInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
}

// 待機用ユーティリティ
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
