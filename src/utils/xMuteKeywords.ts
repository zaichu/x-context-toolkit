// X(Twitter)のミュートキーワード機能用DOM操作ユーティリティ

// ミュートキーワード設定ページのURL
export const MUTE_KEYWORDS_URL = 'https://x.com/settings/add_muted_keyword'

// ミュートキーワードを追加する関数
export const addMuteKeywordToX = async (keyword: string): Promise<boolean> => {
  try {
    // 新しいタブでミュートキーワード追加ページを開く
    const tab = await chrome.tabs.create({
      url: MUTE_KEYWORDS_URL,
      active: false // バックグラウンドで開く
    })

    if (!tab.id) {
      throw new Error('タブの作成に失敗しました')
    }

    // ページが読み込まれるまで待機
    await waitForTabLoad(tab.id)

    // コンテンツスクリプトにキーワード入力を指示
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'fillMuteKeyword',
      keyword: keyword.trim()
    })

    if (result?.success) {
      console.log(`ミュートキーワード「${keyword}」を追加しました`)

      // 数秒後にタブを閉じる（ユーザーが確認できるように少し待機）
      setTimeout(() => {
        chrome.tabs.remove(tab.id!)
      }, 2000)

      return true
    } else {
      throw new Error('キーワードの入力に失敗しました')
    }

  } catch (error) {
    console.error('ミュートキーワード追加エラー:', error)
    return false
  }
}

// タブの読み込み完了を待つ
const waitForTabLoad = (tabId: number): Promise<void> => {
  return new Promise((resolve) => {
    const listener = (changedTabId: number, changeInfo: any) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        // DOM読み込み完了まで少し待機
        setTimeout(resolve, 1000)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

// 現在のページがミュートキーワード設定ページかチェック
export const isMuteKeywordPage = (): boolean => {
  const url = window.location.href
  return url.includes('/settings/add_muted_keyword') ||
    url.includes('/settings/muted_keywords')
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
    const checkInterval = setInterval(() => {
      if (findKeywordInput() || document.querySelector(SELECTORS.container)) {
        clearInterval(checkInterval)
        resolve()
      }
    }, 100)

    // 最大10秒で諦める
    setTimeout(() => {
      clearInterval(checkInterval)
      resolve()
    }, 10000)
  })
}

// キーワード入力フィールドを検索
const findKeywordInput = (): HTMLInputElement | null => {
  const selectors = [
    SELECTORS.keywordInput,
    SELECTORS.keywordInputAlt,
    'input[type="text"]',
    'textarea'
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