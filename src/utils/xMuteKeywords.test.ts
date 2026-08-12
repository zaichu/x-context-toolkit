import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADD_MUTE_KEYWORDS_URL, addMuteKeywordToX } from './xMuteKeywords'

const WINDOW_ID = 100
const TAB_ID = 200

const stubChrome = (sendMessageResult: { success: boolean }) => {
  const create = vi.fn().mockResolvedValue({ id: WINDOW_ID, tabs: [{ id: TAB_ID, status: 'complete' }] })
  const get = vi.fn().mockResolvedValue({ id: TAB_ID, status: 'complete' })
  const sendMessage = vi.fn().mockResolvedValue(sendMessageResult)
  const removeWindow = vi.fn().mockResolvedValue(undefined)
  const updateWindow = vi.fn().mockResolvedValue(undefined)
  const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }

  vi.stubGlobal('chrome', {
    windows: { create, remove: removeWindow, update: updateWindow },
    tabs: { get, sendMessage, onUpdated },
  })

  return { create, get, sendMessage, removeWindow, updateWindow, onUpdated }
}

describe('addMuteKeywordToX', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('最小化・非フォーカスの専用ウィンドウでミュートキーワード追加ページを開く', async () => {
    const { create } = stubChrome({ success: true })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    await resultPromise

    expect(create).toHaveBeenCalledWith({
      url: ADD_MUTE_KEYWORDS_URL,
      type: 'popup',
      state: 'minimized',
      focused: false,
    })
  })

  it('成功時は専用ウィンドウを閉じ、通常表示への復元は行わない', async () => {
    const { removeWindow, updateWindow } = stubChrome({ success: true })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(removeWindow).toHaveBeenCalledWith(WINDOW_ID)
    expect(updateWindow).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('失敗時は専用ウィンドウを閉じずに通常表示へ戻す', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { removeWindow, updateWindow } = stubChrome({ success: false })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(removeWindow).not.toHaveBeenCalled()
    expect(updateWindow).toHaveBeenCalledWith(WINDOW_ID, { state: 'normal', focused: true })
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })
})
