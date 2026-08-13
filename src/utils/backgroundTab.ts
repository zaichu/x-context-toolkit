// Xの設定画面を、利用中のウィンドウの非アクティブな一時タブで処理する。
// Chromeにはタブを完全に隠すAPIがないため、フォーカスを奪わず、処理後すぐ閉じる。
export const openBackgroundTab = async (url: string): Promise<number> => {
  const tab = await chrome.tabs.create({ url, active: false })
  if (tab.id === undefined) {
    throw new Error('一時タブの作成に失敗しました')
  }
  return tab.id
}

export const waitForTabLoad = (tabId: number, timeoutMs = 30_000): Promise<void> =>
  new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      chrome.tabs.onUpdated.removeListener(listener)
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    const listener = (changedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') finish()
    }
    const timeout = setTimeout(() => finish(new Error('X設定画面の読み込みがタイムアウトしました')), timeoutMs)

    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish()
      else chrome.tabs.onUpdated.addListener(listener)
    }).catch(() => chrome.tabs.onUpdated.addListener(listener))
  })

export const closeBackgroundTab = async (tabId: number): Promise<void> => {
  try {
    await chrome.tabs.remove(tabId)
  } catch (error) {
    console.error('一時タブのクローズに失敗:', error)
  }
}
