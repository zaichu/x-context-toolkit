import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADD_MUTE_KEYWORDS_URL, addMuteKeywordToX } from './xMuteKeywords'

const TAB_ID = 200

const stubChrome = (sendMessageResult: { success: boolean }) => {
  const create = vi.fn().mockResolvedValue({ id: TAB_ID, status: 'complete' })
  const get = vi.fn().mockResolvedValue({ id: TAB_ID, status: 'complete' })
  const sendMessage = vi.fn().mockResolvedValue(sendMessageResult)
  const remove = vi.fn().mockResolvedValue(undefined)
  const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }

  vi.stubGlobal('chrome', {
    tabs: { create, get, sendMessage, remove, onUpdated },
  })

  return { create, get, sendMessage, remove, onUpdated }
}

describe('addMuteKeywordToX', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('現在のウィンドウの非アクティブな一時タブでミュートキーワード追加ページを開く', async () => {
    const { create } = stubChrome({ success: true })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    await resultPromise

    expect(create).toHaveBeenCalledWith({ url: ADD_MUTE_KEYWORDS_URL, active: false })
  })

  it('成功時は一時タブを閉じる', async () => {
    const { remove } = stubChrome({ success: true })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(true)
  })

  it('失敗時も一時タブを閉じる', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { remove } = stubChrome({ success: false })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('ページ読み込みがタイムアウトしても一時タブを閉じ、falseで解決する（永久に「追加中」にならない）', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const create = vi.fn().mockResolvedValue({ id: TAB_ID })
    const get = vi.fn().mockResolvedValue({ id: TAB_ID, status: 'loading' })
    const sendMessage = vi.fn()
    const remove = vi.fn().mockResolvedValue(undefined)
    const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }
    vi.stubGlobal('chrome', { tabs: { create, get, sendMessage, remove, onUpdated } })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(sendMessage).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('コンテンツスクリプトの応答がタイムアウトしても一時タブを閉じ、falseで解決する（永久に「追加中」にならない）', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const create = vi.fn().mockResolvedValue({ id: TAB_ID })
    const get = vi.fn().mockResolvedValue({ id: TAB_ID, status: 'complete' })
    // sendMessageが永久に解決しないケース（コンテンツスクリプトが応答しない）を再現
    const sendMessage = vi.fn().mockReturnValue(new Promise(() => {}))
    const remove = vi.fn().mockResolvedValue(undefined)
    const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }
    vi.stubGlobal('chrome', { tabs: { create, get, sendMessage, remove, onUpdated } })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })
})
