// DOM出現・属性変更をMutationObserverで即時検出しつつ、Observerで拾えない
// URL/CSS/property変化はバックストップpollで保証する汎用の条件待ちユーティリティ
export interface WaitForConditionOptions {
  timeoutMs: number
  pollIntervalMs: number
  observeTarget?: Node | null
  observeOptions?: MutationObserverInit
}

export const waitForCondition = <T>(
  check: () => T | undefined,
  options: WaitForConditionOptions,
): Promise<T | undefined> => {
  const { timeoutMs, pollIntervalMs, observeTarget, observeOptions } = options

  return new Promise((resolve, reject) => {
    let settled = false
    let observer: MutationObserver | undefined

    const cleanup = () => {
      observer?.disconnect()
      if (intervalId !== undefined) clearInterval(intervalId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }

    const settleResolve = (value: T | undefined) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const settleReject = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const runCheck = (): void => {
      if (settled) return
      let value: T | undefined
      try {
        value = check()
      } catch (error) {
        settleReject(error)
        return
      }
      if (value !== undefined) {
        settleResolve(value)
      }
    }

    if (observeTarget) {
      observer = new MutationObserver(() => runCheck())
      observer.observe(observeTarget, observeOptions ?? { childList: true })
    }

    // cleanupがどの完了経路でも同じ3つ（observer/interval/timeout）を扱えるよう、
    // 同期checkより前にinterval/timeoutを用意してから初回checkを行う
    // （登録直後のmutationを落とさないため、observeは初回checkより前に済ませておく）
    const intervalId = setInterval(() => runCheck(), pollIntervalMs)
    const timeoutId = setTimeout(() => {
      runCheck()
      if (!settled) settleResolve(undefined)
    }, timeoutMs)

    runCheck()
  })
}
