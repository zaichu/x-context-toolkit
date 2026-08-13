// Xの設定画面を、利用中のウィンドウの非アクティブな一時タブで処理する。
// Chromeにはタブを完全に隠すAPIがないため、フォーカスを奪わず、処理後すぐ閉じる。
export const openBackgroundTab = async (url: string): Promise<number> => {
  const tab = await chrome.tabs.create({ url, active: false })
  if (tab.id === undefined) {
    throw new Error('一時タブの作成に失敗しました')
  }
  return tab.id
}

// タブ作成直後はコンテンツスクリプトがまだ読み込まれておらず、
// sendMessageは「受信先未準備」エラーになりうる。そのエラーだけを短い間隔で再試行し、
// 受信可能になった時点ですぐに処理を始める（読み込み完了を待ってから送るより速い）。
const RECEIVING_END_MISSING_MESSAGE = 'Could not establish connection. Receiving end does not exist.'

const isReceivingEndMissingError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(RECEIVING_END_MISSING_MESSAGE)
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const sendMessageUntilReady = async <T>(
  tabId: number,
  message: unknown,
  options: { intervalMs?: number; timeoutMs?: number; onAttempt?: () => void } = {},
): Promise<T> => {
  const { intervalMs = 50, timeoutMs = 15_000, onAttempt } = options
  const startedAt = Date.now()

  for (; ;) {
    try {
      onAttempt?.()
      return await chrome.tabs.sendMessage(tabId, message) as T
    } catch (error) {
      if (!isReceivingEndMissingError(error)) {
        throw error
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error('X設定画面のコンテンツスクリプトが応答しませんでした')
      }
      await sleep(intervalMs)
    }
  }
}

export const closeBackgroundTab = async (tabId: number): Promise<void> => {
  try {
    await chrome.tabs.remove(tabId)
  } catch (error) {
    console.error('一時タブのクローズに失敗:', error)
  }
}
