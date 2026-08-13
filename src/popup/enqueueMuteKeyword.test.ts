import { afterEach, describe, expect, it, vi } from 'vitest'
import { enqueueMuteKeyword } from './enqueueMuteKeyword'

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

  it('受付応答は100ms未満で解決する（X側への保存完了を別途待たない）', async () => {
    // sendMessageの解決＝「検証・キュー投入が済んだ」という受付のみを表し、
    // Xへの保存が完了するまでの実処理は別途待たない設計であることを、
    // モック自体が即座に解決することと、追加のメッセージ往復が発生しないことで確認する
    const sendMessage = vi.fn().mockResolvedValue({ accepted: true })
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const start = performance.now()
    await enqueueMuteKeyword('テスト')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })
})
