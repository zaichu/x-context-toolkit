import { describe, expect, it, vi } from 'vitest'
import { createMuteQueue, truncateForNotification, validateMuteKeyword } from './muteQueue'

// 解決タイミングを外側から制御できるdeferred
const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

// マイクロタスクキューが尽きるまで待つ（.then連鎖の段数を数えなくてよいようにする）
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('validateMuteKeyword', () => {
  it('空文字はエラーになる', () => {
    expect(validateMuteKeyword('   ')).toEqual({ error: '有効なキーワードを選択してください' })
  })

  it('101文字以上はエラーになる', () => {
    const tooLong = 'あ'.repeat(101)
    expect(validateMuteKeyword(tooLong)).toEqual({ error: 'キーワードが長すぎます (最大100文字)' })
  })

  it('前後の空白をtrimしたキーワードを返す', () => {
    expect(validateMuteKeyword('  テスト  ')).toEqual({ keyword: 'テスト' })
  })
})

describe('truncateForNotification', () => {
  it('40文字以下はそのまま返す', () => {
    const keyword = 'あ'.repeat(40)
    expect(truncateForNotification(keyword)).toBe(keyword)
  })

  it('41文字以上は40文字に省略し末尾を示す', () => {
    const keyword = 'あ'.repeat(50)
    const result = truncateForNotification(keyword)
    expect(result.length).toBeLessThanOrEqual(41)
    expect(result.startsWith('あ'.repeat(40))).toBe(true)
  })
})

describe('createMuteQueue', () => {
  it('受付時点ではaddMuteKeywordToXの完了を待たずaccepted:trueを返す', async () => {
    const deferred = createDeferred<boolean>()
    const addMuteKeywordToX = vi.fn().mockReturnValue(deferred.promise)
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    const result = queue.enqueue('テスト')

    // enqueueの戻り値自体は、実処理(addMuteKeywordToX)の完了を待たず即座に得られる
    expect(result).toEqual({ accepted: true })

    await flushMicrotasks()
    expect(addMuteKeywordToX).toHaveBeenCalledWith('テスト')

    deferred.resolve(true)
    await flushMicrotasks()
  })

  it('enqueue呼出しから戻る前にaddMuteKeywordToXが同期的に呼び出されている（Service Workerが応答直後に停止しても処理開始済みを保証する）', () => {
    const addMuteKeywordToX = vi.fn().mockReturnValue(new Promise(() => {}))
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    // awaitやflushMicrotasksを一切挟まず、enqueueの戻り値を受け取った直後の時点で
    // すでにaddMuteKeywordToXが呼ばれている必要がある（マイクロタスク経由の遅延起動は不可）
    queue.enqueue('テスト')

    expect(addMuteKeywordToX).toHaveBeenCalledWith('テスト')
  })

  it('受付は100ms未満で完了する（同期的に返る）', () => {
    const addMuteKeywordToX = vi.fn().mockReturnValue(new Promise(() => {}))
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    const start = performance.now()
    const result = queue.enqueue('テスト')
    const elapsed = performance.now() - start

    expect(result.accepted).toBe(true)
    expect(elapsed).toBeLessThan(100)
  })

  it('バリデーションエラー時はキューに積まずaccepted:falseとerrorを返す', () => {
    const addMuteKeywordToX = vi.fn()
    const notifyFailure = vi.fn()
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    const result = queue.enqueue('   ')

    expect(result).toEqual({ accepted: false, error: '有効なキーワードを選択してください' })
    expect(addMuteKeywordToX).not.toHaveBeenCalled()
  })

  it('複数キーワードをFIFOで直列実行する（同時実行しない）', async () => {
    const order: string[] = []
    let active = 0
    let maxActive = 0
    const deferredA = createDeferred<boolean>()
    const deferredB = createDeferred<boolean>()
    const addMuteKeywordToX = vi.fn().mockImplementation(async (keyword: string) => {
      active++
      maxActive = Math.max(maxActive, active)
      order.push(keyword)
      const deferred = keyword === 'A' ? deferredA : deferredB
      const result = await deferred.promise
      active--
      return result
    })
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    queue.enqueue('A')
    queue.enqueue('B')

    // Aがまだ解決していないのでBはまだ開始していないはず
    await flushMicrotasks()
    expect(order).toEqual(['A'])

    deferredA.resolve(true)
    await flushMicrotasks()

    expect(order).toEqual(['A', 'B'])
    expect(maxActive).toBe(1)

    deferredB.resolve(true)
    await flushMicrotasks()
  })

  it('同じキーワードがキュー中・処理中の間は重複enqueueせずdeduplicated:trueを返す', async () => {
    const deferred = createDeferred<boolean>()
    const addMuteKeywordToX = vi.fn().mockReturnValue(deferred.promise)
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    const first = queue.enqueue('重複キーワード')
    const second = queue.enqueue('重複キーワード')

    expect(first).toEqual({ accepted: true })
    expect(second).toEqual({ accepted: true, deduplicated: true })

    await flushMicrotasks()
    expect(addMuteKeywordToX).toHaveBeenCalledTimes(1)

    deferred.resolve(true)
    await flushMicrotasks()
  })

  it('完了後は同じキーワードを再度追加できる', async () => {
    const addMuteKeywordToX = vi.fn().mockResolvedValue(true)
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    queue.enqueue('再追加')
    await flushMicrotasks()

    const second = queue.enqueue('再追加')
    expect(second).toEqual({ accepted: true })

    await flushMicrotasks()
    expect(addMuteKeywordToX).toHaveBeenCalledTimes(2)
  })

  it('成功時は通知しない', async () => {
    const addMuteKeywordToX = vi.fn().mockResolvedValue(true)
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    queue.enqueue('成功キーワード')
    await flushMicrotasks()

    expect(notifyFailure).not.toHaveBeenCalled()
  })

  it('失敗時のみ失敗を通知する', async () => {
    const addMuteKeywordToX = vi.fn().mockResolvedValue(false)
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    queue.enqueue('失敗キーワード')
    await flushMicrotasks()

    expect(notifyFailure).toHaveBeenCalledWith('失敗キーワード')
  })

  it('呼び出し元がPromiseを待たなくても、キュー内の処理は継続する（Popupが閉じても続く設計）', async () => {
    const addMuteKeywordToX = vi.fn().mockResolvedValue(true)
    const notifyFailure = vi.fn().mockResolvedValue(undefined)
    const queue = createMuteQueue({ addMuteKeywordToX, notifyFailure })

    // enqueueの戻り値を一切参照・awaitしない（Popupが閉じて呼び出し元が消えた状況を模す）
    queue.enqueue('放置されるキーワード')

    // マイクロタスクを回すだけで、クロージャに保持された処理チェーンが進むはず
    await flushMicrotasks()

    expect(addMuteKeywordToX).toHaveBeenCalledWith('放置されるキーワード')
  })
})
