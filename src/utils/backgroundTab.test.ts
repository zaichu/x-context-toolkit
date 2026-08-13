import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeBackgroundTab, openBackgroundTab, sendMessageUntilReady } from './backgroundTab'

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

  it('タブを閉じる', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { tabs: { remove } })
    await closeBackgroundTab(42)
    expect(remove).toHaveBeenCalledWith(42)
  })

  describe('sendMessageUntilReady', () => {
    it('受信先が最初から準備できていれば即座に結果を返す', async () => {
      const sendMessage = vi.fn().mockResolvedValue({ success: true })
      vi.stubGlobal('chrome', { tabs: { sendMessage } })

      await expect(sendMessageUntilReady(42, { action: 'ping' })).resolves.toEqual({ success: true })
      expect(sendMessage).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledWith(42, { action: 'ping' })
    })

    it('受信先未準備エラーは短い間隔で再試行し、準備できた時点で解決する', async () => {
      const notReady = new Error('Could not establish connection. Receiving end does not exist.')
      const sendMessage = vi.fn()
        .mockRejectedValueOnce(notReady)
        .mockRejectedValueOnce(notReady)
        .mockResolvedValueOnce({ success: true })
      vi.stubGlobal('chrome', { tabs: { sendMessage } })

      vi.useFakeTimers()
      const promise = sendMessageUntilReady(42, { action: 'ping' }, { intervalMs: 50, timeoutMs: 15_000 })
      await vi.runAllTimersAsync()

      await expect(promise).resolves.toEqual({ success: true })
      expect(sendMessage).toHaveBeenCalledTimes(3)
    })

    it('受信先未準備エラー以外は再試行せず即座に失敗する', async () => {
      const otherError = new Error('拡張機能のコンテキストが無効です')
      const sendMessage = vi.fn().mockRejectedValue(otherError)
      vi.stubGlobal('chrome', { tabs: { sendMessage } })

      await expect(sendMessageUntilReady(42, { action: 'ping' })).rejects.toThrow(otherError.message)
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('タイムアウトまで受信先が準備できなければエラーになる', async () => {
      const notReady = new Error('Could not establish connection. Receiving end does not exist.')
      const sendMessage = vi.fn().mockRejectedValue(notReady)
      vi.stubGlobal('chrome', { tabs: { sendMessage } })

      vi.useFakeTimers()
      const promise = sendMessageUntilReady(42, { action: 'ping' }, { intervalMs: 50, timeoutMs: 200 })
      const assertion = expect(promise).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(200)

      await assertion
    })
  })
})
