import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeBackgroundTab, openBackgroundTab, waitForTabLoad } from './backgroundTab'

describe('backgroundTab', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('現在のウィンドウへ非アクティブなタブを作る', async () => {
    const create = vi.fn().mockResolvedValue({ id: 42 })
    vi.stubGlobal('chrome', { tabs: { create } })

    await expect(openBackgroundTab('https://x.com/settings/add_muted_keyword')).resolves.toBe(42)
    expect(create).toHaveBeenCalledWith({
      url: 'https://x.com/settings/add_muted_keyword',
      active: false,
    })
  })

  it('完了済みなら追加待機なしで解決する', async () => {
    const get = vi.fn().mockResolvedValue({ status: 'complete' })
    const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }
    vi.stubGlobal('chrome', { tabs: { get, onUpdated } })

    await expect(waitForTabLoad(42)).resolves.toBeUndefined()
    expect(onUpdated.addListener).not.toHaveBeenCalled()
  })

  it('タブを閉じる', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { tabs: { remove } })
    await closeBackgroundTab(42)
    expect(remove).toHaveBeenCalledWith(42)
  })

  it('読み込み中のタブはcompleteイベントを受けて解決し、リスナーを解除する', async () => {
    const get = vi.fn().mockResolvedValue({ status: 'loading' })
    type UpdatedListener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => void
    let registeredListener: UpdatedListener | undefined
    const onUpdated = {
      addListener: vi.fn((listener: UpdatedListener) => { registeredListener = listener }),
      removeListener: vi.fn(),
    }
    vi.stubGlobal('chrome', { tabs: { get, onUpdated } })

    const promise = waitForTabLoad(42)
    await vi.waitFor(() => expect(onUpdated.addListener).toHaveBeenCalled())
    registeredListener?.(42, { status: 'complete' })

    await expect(promise).resolves.toBeUndefined()
    expect(onUpdated.removeListener).toHaveBeenCalled()
  })

  it('タイムアウトするとエラーになり、リスナーを解除する', async () => {
    const get = vi.fn().mockResolvedValue({ status: 'loading' })
    const onUpdated = { addListener: vi.fn(), removeListener: vi.fn() }
    vi.stubGlobal('chrome', { tabs: { get, onUpdated } })

    vi.useFakeTimers()
    const promise = waitForTabLoad(42, 30_000)
    // rejectハンドラをタイマー発火前に同期的に登録し、unhandled rejectionを防ぐ
    const assertion = expect(promise).rejects.toThrow('X設定画面の読み込みがタイムアウトしました')
    // マイクロタスク(chrome.tabs.get().then(...))を進めてからタイマーを進める
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)

    await assertion
    expect(onUpdated.removeListener).toHaveBeenCalled()
  })
})
