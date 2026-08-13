// X(Twitter)のミュートキーワード機能用DOM操作ユーティリティ
import {
  openBackgroundTab,
  sendMessageUntilReady,
  closeBackgroundTab,
} from './backgroundTab'

// ミュートキーワード設定ページのURL
export const ADD_MUTE_KEYWORDS_URL = 'https://x.com/settings/add_muted_keyword'

// コンテンツスクリプトへの接続を再試行する間隔・上限（タブ読み込み完了を待たず、早期登録済みのリスナーに届き次第すぐ送る）
const CONNECT_INTERVAL_MS = 50
const CONNECT_TIMEOUT_MS = 5_000
// 接続後、応答（入力完了）を待つ上限（コンテンツスクリプトが応答しないケースでも永久待機しない）
const RESPONSE_TIMEOUT_MS = 15_000

// ミュートキーワードを追加する関数
export const addMuteKeywordToX = async (keyword: string): Promise<boolean> => {
  let tabId: number | null = null

  try {
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) throw new Error('キーワードが空です')

    // フォーカスを奪わない非アクティブな一時タブでX公式設定画面を開く
    tabId = await openBackgroundTab(ADD_MUTE_KEYWORDS_URL)

    // タブ読み込み完了を待たず、作成直後から短い間隔でコンテンツスクリプトへ送信を再試行する
    const result = await withTimeout(
      sendMessageUntilReady<{ success: boolean }>(
        tabId,
        { action: 'fillMuteKeyword', keyword: trimmedKeyword },
        { intervalMs: CONNECT_INTERVAL_MS, timeoutMs: CONNECT_TIMEOUT_MS },
      ),
      RESPONSE_TIMEOUT_MS,
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
  addButton: 'button[data-testid="settingsDetailSave"]',
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

    // キーワードを一括入力
    inputKeyword(inputField, keyword)

    // 追加ボタンが有効になるまで条件待ちしてから取得
    const addButton = await waitForAddButtonEnabled()
    if (!addButton) {
      throw new Error('追加ボタンが見つかりません')
    }

    // ボタンをクリック
    addButton.click()

    // 通信をキャンセルせず、妥当な成功の兆候（ボタンの再有効化・消失）を有限時間待つ
    await waitForSaveToSettle(addButton)

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

// キーワードを入力（ネイティブsetterで一括設定し、input/changeイベントを1回ずつ発火する）
const inputKeyword = (input: HTMLInputElement, keyword: string): void => {
  input.focus()
  setNativeInputValue(input, keyword)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// React管理下のinputでも変更として認識されるよう、ネイティブsetterを使う。
const setNativeInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
}

// 追加ボタンが有効になるまで条件待ちする（固定スリープではなく、短い間隔でDOM状態を確認する）
const waitForAddButtonEnabled = (timeoutMs = 5_000, intervalMs = 50): Promise<HTMLButtonElement | null> => {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const check = () => {
      const button = findAddButton()
      if (button) {
        resolve(button)
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null)
        return
      }
      setTimeout(check, intervalMs)
    }
    check()
  })
}

// 保存クリック後、通信をキャンセルせず、妥当な成功の兆候（ボタンの再有効化や消失）を有限時間待つ。
// 兆候を検知できなくてもtimeoutMsで必ず打ち切り、永久待機にはしない。
const waitForSaveToSettle = (button: HTMLButtonElement, timeoutMs = 3_000, intervalMs = 50): Promise<void> => {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let sawSubmitting = false
    const check = () => {
      const stillInDom = button.isConnected
      const disabledNow = stillInDom && button.disabled
      if (disabledNow) sawSubmitting = true

      const settled = !stillInDom || (sawSubmitting && !disabledNow)
      if (settled || Date.now() - startedAt >= timeoutMs) {
        resolve()
        return
      }
      setTimeout(check, intervalMs)
    }
    check()
  })
}
