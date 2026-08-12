// バックグラウンドで使う専用ウィンドウ操作ユーティリティ
// 閲覧中のウィンドウにタブを追加せず、フォーカスも変えずにX公式ページを処理するため、
// 最小化・非フォーカスの専用popupウィンドウでページを開閉する。

export interface BackgroundWindowHandle {
  windowId: number
  tabId: number
}

// 閲覧中のウィンドウに影響を与えない、最小化・非フォーカスの専用ウィンドウを開く
export const openBackgroundWindow = async (url: string): Promise<BackgroundWindowHandle> => {
  const createdWindow = await chrome.windows.create({
    url,
    type: 'popup',
    state: 'minimized',
    focused: false,
  })

  const tabId = createdWindow?.tabs?.[0]?.id

  if (!createdWindow?.id || !tabId) {
    throw new Error('専用ウィンドウの作成に失敗しました')
  }

  return { windowId: createdWindow.id, tabId }
}

// タブの読み込み完了を待つ
export const waitForTabLoad = (tabId: number, timeoutMs = 30000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('タブの読み込みがタイムアウトしました'))
    }, timeoutMs)

    const listener = (changedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        clearTimeout(timeout)
        // DOM読み込み完了まで少し待機
        setTimeout(resolve, 2000)
      }
    }

    // 既にタブが読み込み済みかチェック
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        clearTimeout(timeout)
        setTimeout(resolve, 2000)
      } else {
        chrome.tabs.onUpdated.addListener(listener)
      }
    }).catch(() => {
      // tabs.get自体が失敗しても最初のtimeoutは維持し、更新イベントが来なくても
      // 所定時間で必ずreject・listener解除されるようにする
      chrome.tabs.onUpdated.addListener(listener)
    })
  })
}

// 専用ウィンドウを閉じる（クローズ失敗はログのみで処理は継続する）
export const closeBackgroundWindow = async (windowId: number): Promise<void> => {
  try {
    await chrome.windows.remove(windowId)
  } catch (error) {
    console.error('ウィンドウのクローズに失敗:', error)
  }
}

// 失敗時に専用ウィンドウを通常表示へ戻し、ユーザーが原因を確認できるようにする
export const revealBackgroundWindowForInspection = async (windowId: number): Promise<void> => {
  try {
    await chrome.windows.update(windowId, { state: 'normal', focused: true })
  } catch (error) {
    console.error('ウィンドウの復元に失敗:', error)
  }
}
