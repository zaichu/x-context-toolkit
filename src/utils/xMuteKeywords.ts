// X(Twitter)のミュートキーワード機能用DOM操作ユーティリティ
import {
  openBackgroundTab,
  sendMessageUntilReady,
  closeBackgroundTab,
  findExistingTab,
} from './backgroundTab'

// ミュートキーワード設定ページのURL
export const ADD_MUTE_KEYWORDS_URL = 'https://x.com/settings/add_muted_keyword'
// ミュートキーワード一覧ページのURL（ここから追加リンクをクリックしてもフォームに到達できる）
export const MUTED_KEYWORDS_URL = 'https://x.com/settings/muted_keywords'

// コンテンツスクリプトへの接続を再試行する間隔・上限（タブ読み込み完了を待たず、早期登録済みのリスナーに届き次第すぐ送る）
const CONNECT_INTERVAL_MS = 50
const CONNECT_TIMEOUT_MS = 5_000
// 接続後、応答（入力完了）を待つ上限（コンテンツスクリプトが応答しないケースでも永久待機しない）
const RESPONSE_TIMEOUT_MS = 15_000

// content側で計測した処理区間（キーワード本文は含めない）
export interface SaveTimings {
  inputFoundMs: number
  saveClickedMs: number
  settledMs: number
}

interface FillMuteKeywordResponse {
  success: boolean
  timings?: SaveTimings
}

type ExistingTabKind = 'add_muted_keyword' | 'muted_keywords'

// 既存タブ再利用経路の直列化用キュー。
// 同時に複数呼ばれた場合でも同じ既存タブへ同時に送信しないよう、
// 「既存タブを探す〜応答を受け取る」までを1本のキューで直列実行する。
// （新規一時タブ方式は呼び出しごとに独立したタブを使うため対象外）
let reuseQueue: Promise<unknown> = Promise.resolve()
const runExclusive = <T>(task: () => Promise<T>): Promise<T> => {
  const run = reuseQueue.then(task, task)
  reuseQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

interface TimingMarks {
  tabCreated?: number
  contentReady?: number
  responded?: number
}

type ReuseResult =
  | { handled: true; success: boolean; timings?: SaveTimings }
  | { handled: false }

// 既存のX設定タブ（add_muted_keyword優先、次点でmuted_keywords）を再利用できるか試みる。
// 既存タブが見つからない、またはメッセージ送信自体が届かない（受信不能・タイムアウト）場合はhandled:falseを返し、
// 呼び出し元が新規一時タブ方式へフォールバックする。
// 一方、既存タブへメッセージは届いたがフォーム処理自体が失敗した場合はhandled:trueかつsuccess:falseを返す。
// これは、二重登録を避けるため新規タブへの再試行をしないことを呼び出し元へ伝えるため。
const tryReuseExistingTab = (keyword: string, marks: TimingMarks): Promise<ReuseResult> =>
  runExclusive(async () => {
    let existing: { tabId: number; kind: ExistingTabKind } | null
    try {
      existing = await findExistingTab<ExistingTabKind>([
        { kind: 'add_muted_keyword', url: ADD_MUTE_KEYWORDS_URL },
        { kind: 'muted_keywords', url: MUTED_KEYWORDS_URL },
      ])
    } catch {
      return { handled: false }
    }
    if (!existing) return { handled: false }

    marks.tabCreated = performance.now()
    const action = existing.kind === 'add_muted_keyword' ? 'fillMuteKeyword' : 'prepareAndFillMuteKeyword'

    try {
      const result = await withTimeout(
        sendMessageUntilReady<FillMuteKeywordResponse>(
          existing.tabId,
          { action, keyword },
          {
            intervalMs: CONNECT_INTERVAL_MS,
            timeoutMs: CONNECT_TIMEOUT_MS,
            onAttempt: () => { marks.contentReady = performance.now() },
          },
        ),
        RESPONSE_TIMEOUT_MS,
        'X設定画面からの応答がタイムアウトしました',
      )
      marks.responded = performance.now()
      return { handled: true, success: !!result?.success, timings: result?.timings }
    } catch {
      // 既存タブへ届かなかった（受信不能・タイムアウト）ケース。フォーム処理には至っていないため
      // 新規タブへのフォールバックで二重登録にはならない。
      return { handled: false }
    }
  })

// ミュートキーワードを追加する関数
// 既存のX設定タブ（再利用経路）はキューで直列化しているが、新規一時タブ方式の呼び出し同士は
// 互いに独立（tabId・計測値はすべてローカル変数）なため、同時に複数回呼ばれても競合しない。
export const addMuteKeywordToX = async (keyword: string): Promise<boolean> => {
  let tabId: number | null = null
  const t0 = performance.now()
  const marks: TimingMarks = {}
  let contentTimings: SaveTimings | undefined
  let reusedTab = false

  try {
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) throw new Error('キーワードが空です')

    // 既存のX設定タブがあれば再利用する（cold loadの回避）。
    // 既存タブが見つからない/メッセージが届かない場合のみ新規一時タブ方式にフォールバックする。
    const reuseResult = await tryReuseExistingTab(trimmedKeyword, marks)
    if (reuseResult.handled) {
      reusedTab = true
      contentTimings = reuseResult.timings
      if (reuseResult.success) {
        console.log(`ミュートキーワード「${keyword}」を追加しました`)
        return true
      } else {
        // 既存タブ内のフォーム処理自体が失敗している。二重登録を避けるため新規タブへは再試行しない。
        throw new Error('キーワードの入力に失敗しました')
      }
    }

    // フォーカスを奪わない非アクティブな一時タブでX公式設定画面を開く
    tabId = await openBackgroundTab(ADD_MUTE_KEYWORDS_URL)
    marks.tabCreated = performance.now()

    // タブ読み込み完了を待たず、作成直後から短い間隔でコンテンツスクリプトへ送信を再試行する
    const result = await withTimeout(
      sendMessageUntilReady<FillMuteKeywordResponse>(
        tabId,
        { action: 'fillMuteKeyword', keyword: trimmedKeyword },
        {
          intervalMs: CONNECT_INTERVAL_MS,
          timeoutMs: CONNECT_TIMEOUT_MS,
          // 成功した（=受信先未準備エラーにならなかった）試行の直前時刻を、
          // コンテンツスクリプトが応答可能になった目安として記録する
          onAttempt: () => { marks.contentReady = performance.now() },
        },
      ),
      RESPONSE_TIMEOUT_MS,
      'X設定画面からの応答がタイムアウトしました',
    )
    marks.responded = performance.now()
    contentTimings = result?.timings

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
    logSaveTimings(t0, marks, contentTimings, reusedTab)
    if (tabId !== null) await closeBackgroundTab(tabId)
  }
}

// 実機でのボトルネック調査用に、各区間の所要時間だけを1行で出す（キーワード本文は含めない）
const logSaveTimings = (
  t0: number,
  marks: TimingMarks,
  contentTimings: SaveTimings | undefined,
  reusedTab: boolean,
): void => {
  // タブ作成前・既存タブ再利用開始前に失敗した場合（空キーワード等）は計測対象外
  if (marks.tabCreated === undefined) return

  const now = performance.now()
  const round = (ms: number) => Math.round(ms)

  const tabCreatedMs = marks.tabCreated - t0
  const contentReadyMs = (marks.contentReady ?? marks.tabCreated) - marks.tabCreated
  const inputFoundMs = contentTimings?.inputFoundMs ?? 0
  const saveClickedMs = contentTimings?.saveClickedMs ?? 0
  const settledMs = contentTimings?.settledMs ?? 0
  const totalMs = (marks.responded ?? now) - t0

  console.info(
    `[muteKeyword] timings(ms) tabCreated=${round(tabCreatedMs)} contentReady=${round(contentReadyMs)} ` +
    `inputFound=${round(inputFoundMs)} saveClicked=${round(saveClickedMs)} settled=${round(settledMs)} total=${round(totalMs)} ` +
    `reusedTab=${reusedTab}`,
  )
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

// 現在のページがミュートキーワード一覧ページかチェック
export const isMuteKeywordsListPage = (): boolean => {
  return window.location.href.includes(MUTED_KEYWORDS_URL)
}

// ミュートキーワード一覧ページにある追加リンク
const ADD_KEYWORD_LINK_SELECTOR = 'a[aria-label="ミュートする単語またはフレーズを追加"]'

// ミュートキーワード一覧ページから追加リンクをクリックし、SPA遷移後にフォームへ入力する
export const prepareAndFillMuteKeywordForm = async (keyword: string): Promise<FillMuteKeywordResponse> => {
  try {
    const link = await waitForAddKeywordLink()
    if (!link) {
      throw new Error('ミュートキーワード追加リンクが見つかりません')
    }
    link.click()
  } catch (error) {
    console.error('ミュートキーワード追加リンクの操作エラー:', error)
    return { success: false }
  }

  // クリック後はfillMuteKeywordFormのwaitForElementsがSPA遷移によるフォーム出現を待つ
  return fillMuteKeywordForm(keyword)
}

const waitForAddKeywordLink = (timeoutMs = 5_000, intervalMs = 50): Promise<HTMLAnchorElement | null> => {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const check = () => {
      const link = document.querySelector(ADD_KEYWORD_LINK_SELECTOR) as HTMLAnchorElement | null
      if (link) {
        resolve(link)
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
export const fillMuteKeywordForm = async (keyword: string): Promise<FillMuteKeywordResponse> => {
  const tStart = performance.now()
  try {
    // ページが完全に読み込まれるまで待機
    await waitForElements()

    // キーワード入力フィールドを取得
    const inputField = findKeywordInput()
    if (!inputField) {
      throw new Error('キーワード入力フィールドが見つかりません')
    }
    const tInputFound = performance.now()

    // キーワードを一括入力
    inputKeyword(inputField, keyword)

    // 追加ボタンが有効になるまで条件待ちしてから取得
    const addButton = await waitForAddButtonEnabled()
    if (!addButton) {
      throw new Error('追加ボタンが見つかりません')
    }

    // ボタンをクリック
    addButton.click()
    const tSaveClicked = performance.now()

    // 通信をキャンセルせず、妥当な成功の兆候（URL遷移・フォーム消失・ボタンの再有効化や消失）を有限時間待つ
    await waitForSaveToSettle(addButton, inputField)
    const tSettled = performance.now()

    console.log(`ミュートキーワード「${keyword}」を入力しました`)
    return {
      success: true,
      timings: {
        inputFoundMs: tInputFound - tStart,
        saveClickedMs: tSaveClicked - tInputFound,
        settledMs: tSettled - tSaveClicked,
      },
    }

  } catch (error) {
    console.error('フォーム入力エラー:', error)
    return { success: false }
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

// 兆候を何も検知できなかった場合の安全待機の上限。
// Xのミュートキーワード保存はXHR/fetchによる単純な書き込みで、通常のネットワークでは
// 数百ms（目安300ms前後）で応答が返る。その2倍弱にあたる500msあれば大半のケースを
// カバーでき、かつ以前の3,000ms固定待機に比べて大幅に短い。
// この待機はあくまで保存リクエストの完了を待つための猶予であり、タブは
// waitForSaveToSettleの解決後にのみ閉じるため、猶予中にリクエストがキャンセルされることはない。
const SAVE_SETTLE_FALLBACK_TIMEOUT_MS = 500

// 保存クリック後、通信をキャンセルせず、妥当な成功の兆候を有限時間待つ。
// 次のいずれかを検知でき次第、即座に完了する:
//   1. URLがミュートキーワード追加ページから離れた（保存後の画面遷移）
//   2. キーワード入力欄がDOMから消えた（フォームの再描画・破棄）
//   3. 保存ボタンがdisabledを経て再度有効化された、またはDOMから消えた
// どれも観測できない場合でも、SAVE_SETTLE_FALLBACK_TIMEOUT_MSで必ず打ち切り、永久待機にはしない。
const waitForSaveToSettle = (
  button: HTMLButtonElement,
  input: HTMLInputElement,
  timeoutMs = SAVE_SETTLE_FALLBACK_TIMEOUT_MS,
  intervalMs = 50,
): Promise<void> => {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const startUrl = window.location.href
    let sawSubmitting = false

    const check = () => {
      const buttonInDom = button.isConnected
      const disabledNow = buttonInDom && button.disabled
      if (disabledNow) sawSubmitting = true

      const navigatedAway = window.location.href !== startUrl
      const formGone = !input.isConnected
      const buttonSettled = !buttonInDom || (sawSubmitting && !disabledNow)

      const settled = navigatedAway || formGone || buttonSettled
      if (settled || Date.now() - startedAt >= timeoutMs) {
        resolve()
        return
      }
      setTimeout(check, intervalMs)
    }
    check()
  })
}
