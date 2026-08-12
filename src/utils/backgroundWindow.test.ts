import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  openBackgroundWindow,
  waitForTabLoad,
  closeBackgroundWindow,
  revealBackgroundWindowForInspection,
} from './backgroundWindow'

describe('openBackgroundWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('最小化・非フォーカスの専用popupウィンドウを開く', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 100,
      tabs: [{ id: 200, status: 'complete' }],
    })
    vi.stubGlobal('chrome', { windows: { create } })

    const handle = await openBackgroundWindow('https://x.com/testuser')

    expect(create).toHaveBeenCalledWith({
      url: 'https://x.com/testuser',
      type: 'popup',
      state: 'minimized',
      focused: false,
    })
    expect(handle).toEqual({ windowId: 100, tabId: 200 })
  })

  it('ウィンドウIDが取得できない場合はエラーを投げる', async () => {
    const create = vi.fn().mockResolvedValue({ id: undefined, tabs: [{ id: 200, status: 'complete' }] })
    vi.stubGlobal('chrome', { windows: { create } })

    await expect(openBackgroundWindow('https://x.com/testuser')).rejects.toThrow()
  })

  it('タブIDが取得できない場合はエラーを投げる', async () => {
    const create = vi.fn().mockResolvedValue({ id: 100, tabs: [] })
    vi.stubGlobal('chrome', { windows: { create } })

    await expect(openBackgroundWindow('https://x.com/testuser')).rejects.toThrow()
  })
})

describe('waitForTabLoad', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('tabs.getが失敗しても、更新イベントが来なければ所定時間でタイムアウトしlistenerを解除する', async () => {
    vi.useFakeTimers()
    const get = vi.fn().mockRejectedValue(new Error('取得失敗'))
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal('chrome', {
      tabs: { get, onUpdated: { addListener, removeListener } },
    })

    const promise = waitForTabLoad(1, 1000)
    const assertion = expect(promise).rejects.toThrow('タブの読み込みがタイムアウトしました')

    await vi.runAllTimersAsync()
    await assertion

    expect(addListener).toHaveBeenCalledTimes(1)
    expect(removeListener).toHaveBeenCalledTimes(1)
    expect(removeListener).toHaveBeenCalledWith(addListener.mock.calls[0][0])
  }, 2000)
})

describe('closeBackgroundWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('chrome.windows.removeでウィンドウを閉じる', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { windows: { remove } })

    await closeBackgroundWindow(100)

    expect(remove).toHaveBeenCalledWith(100)
  })

  it('クローズに失敗しても例外を投げない', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const remove = vi.fn().mockRejectedValue(new Error('失敗'))
    vi.stubGlobal('chrome', { windows: { remove } })

    await expect(closeBackgroundWindow(100)).resolves.toBeUndefined()

    consoleErrorSpy.mockRestore()
  })
})

describe('revealBackgroundWindowForInspection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('失敗時にウィンドウを通常表示へ戻しフォーカスする', async () => {
    const update = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { windows: { update } })

    await revealBackgroundWindowForInspection(100)

    expect(update).toHaveBeenCalledWith(100, { state: 'normal', focused: true })
  })

  it('復元に失敗しても例外を投げない', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const update = vi.fn().mockRejectedValue(new Error('失敗'))
    vi.stubGlobal('chrome', { windows: { update } })

    await expect(revealBackgroundWindowForInspection(100)).resolves.toBeUndefined()

    consoleErrorSpy.mockRestore()
  })
})
