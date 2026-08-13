import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForCondition } from './waitForCondition'

describe('waitForCondition', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('poll intervalを進める前にDOM node追加がMutationObserver経由で即時resolveする', async () => {
    vi.useFakeTimers()
    const target = document.createElement('div')
    document.body.appendChild(target)

    const check = () => (target.querySelector('span') as HTMLSpanElement | null) ?? undefined

    const promise = waitForCondition(check, {
      timeoutMs: 5_000,
      pollIntervalMs: 1_000,
      observeTarget: target,
      observeOptions: { childList: true },
    })

    const span = document.createElement('span')
    target.appendChild(span)

    // pollIntervalMs(1000ms)のtimerを一切進めず、MutationObserverのmicrotaskだけをflushする
    await Promise.resolve()
    await Promise.resolve()

    const result = await promise
    expect(result).toBe(span)
  })

  it('DOM mutationを伴わない外部変数の変化はバックストップpollでresolveする', async () => {
    vi.useFakeTimers()
    const state: { value?: string } = {}

    const promise = waitForCondition(() => state.value, {
      timeoutMs: 5_000,
      pollIntervalMs: 100,
    })

    state.value = 'ready'
    await vi.advanceTimersByTimeAsync(100)

    const result = await promise
    expect(result).toBe('ready')
  })

  it('timeout境界で最後のcheckが成立すれば値を返し、完了後に追加timerが動かない', async () => {
    vi.useFakeTimers()
    let value: string | undefined
    let checkCallCount = 0
    const check = () => {
      checkCallCount++
      return value
    }

    const promise = waitForCondition(check, {
      timeoutMs: 300,
      pollIntervalMs: 1_000,
    })

    setTimeout(() => { value = 'final' }, 299)
    await vi.advanceTimersByTimeAsync(300)

    const result = await promise
    expect(result).toBe('final')

    const countAtResolution = checkCallCount
    await vi.advanceTimersByTimeAsync(5_000)
    expect(checkCallCount).toBe(countAtResolution)
  })

  it('checkがthrowしたらrejectし、observer/timerがcleanupされる', async () => {
    vi.useFakeTimers()
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const target = document.createElement('div')
    document.body.appendChild(target)

    const error = new Error('boom')
    const check = (): string | undefined => { throw error }

    const promise = waitForCondition(check, {
      timeoutMs: 5_000,
      pollIntervalMs: 100,
      observeTarget: target,
      observeOptions: { childList: true },
    })

    await expect(promise).rejects.toThrow('boom')

    expect(disconnectSpy).toHaveBeenCalled()
    expect(clearIntervalSpy).toHaveBeenCalled()
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('既に成立している条件は同期的にresolveし、timerを進める必要がない', async () => {
    vi.useFakeTimers()
    let checkCallCount = 0

    const promise = waitForCondition(() => {
      checkCallCount++
      return 'already'
    }, {
      timeoutMs: 5_000,
      pollIntervalMs: 100,
    })

    const result = await promise
    expect(result).toBe('already')
    const countAtResolution = checkCallCount
    await vi.advanceTimersByTimeAsync(5_000)
    expect(checkCallCount).toBe(countAtResolution)
  })

  it('observeTargetが存在しない場合でもバックストップpollとtimeoutは動作する', async () => {
    vi.useFakeTimers()

    const promise = waitForCondition(() => undefined, {
      timeoutMs: 200,
      pollIntervalMs: 50,
      observeTarget: null,
    })

    await vi.advanceTimersByTimeAsync(200)
    const result = await promise
    expect(result).toBeUndefined()
  })

  it('observeTargetだけを指定した場合はchildList監視を既定値として使う', async () => {
    vi.useFakeTimers()
    const target = document.createElement('div')
    document.body.appendChild(target)

    const promise = waitForCondition(
      () => target.querySelector('span') ?? undefined,
      { timeoutMs: 5_000, pollIntervalMs: 1_000, observeTarget: target },
    )

    const span = document.createElement('span')
    target.appendChild(span)
    await Promise.resolve()
    await Promise.resolve()

    await expect(promise).resolves.toBe(span)
  })

  it('document_startでbodyが未生成でもdocument監視により要素出現を即時検知する', async () => {
    vi.useFakeTimers()
    document.documentElement.remove()
    expect(document.body).toBeNull()

    const promise = waitForCondition(
      () => document.querySelector('button') ?? undefined,
      {
        timeoutMs: 5_000,
        pollIntervalMs: 1_000,
        observeTarget: document,
        observeOptions: { childList: true, subtree: true },
      },
    )

    const html = document.createElement('html')
    const body = document.createElement('body')
    const button = document.createElement('button')
    body.appendChild(button)
    html.appendChild(body)
    document.appendChild(html)
    await Promise.resolve()
    await Promise.resolve()

    await expect(promise).resolves.toBe(button)
  })
})
