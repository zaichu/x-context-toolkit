import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EnqueueResult } from '../background/muteQueue'
import { enqueueMuteKeyword } from './enqueueMuteKeyword'

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('enqueueMuteKeyword', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Service Workerへenqueueメッセージを送る', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ accepted: true })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    await enqueueMuteKeyword('テスト')

    expect(sendMessage).toHaveBeenCalledWith({ action: 'enqueueMuteKeyword', keyword: 'テスト' })
  })

  it('受付応答をそのまま返す（accepted/deduplicated/error）', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ accepted: true, deduplicated: true })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    await expect(enqueueMuteKeyword('テスト')).resolves.toEqual({ accepted: true, deduplicated: true })
  })

  it('受付応答はsendMessageの解決をそのまま返す（X側への保存完了を別途待たない）', async () => {
    // sendMessageの解決＝「検証・キュー投入が済んだ」という受付のみを表す。
    // Xへの保存完了は別途待たない設計であることを、応答が来るまでは返らず、
    // 解決後はその値がそのまま返りメッセージ往復が1回きりであることで確認する
    const deferred = createDeferred<EnqueueResult>()
    const sendMessage = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    let settled = false
    const pending = enqueueMuteKeyword('テスト').then((result) => {
      settled = true
      return result
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    deferred.resolve({ accepted: true })
    await expect(pending).resolves.toEqual({ accepted: true })
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
