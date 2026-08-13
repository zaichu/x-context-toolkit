// ミュートキーワード追加のFIFOキュー。
// Popupはenqueueの受付（検証・キュー投入）のみを待ち、X側への保存完了は待たない。
// 実処理はService Worker内で直列に進み、Popupが閉じても継続する。

export const MAX_KEYWORD_LENGTH = 100
export const NOTIFICATION_KEYWORD_MAX_LENGTH = 40

export interface EnqueueResult {
  accepted: boolean
  deduplicated?: boolean
  error?: string
}

export interface MuteQueueDeps {
  addMuteKeywordToX: (keyword: string) => Promise<boolean>
  notifyFailure: (keyword: string) => Promise<void>
}

export interface MuteQueue {
  enqueue: (rawKeyword: string) => EnqueueResult
}

export const validateMuteKeyword = (raw: string): { keyword: string } | { error: string } => {
  const keyword = (raw ?? '').trim()

  if (keyword.length === 0) {
    return { error: '有効なキーワードを選択してください' }
  }
  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return { error: `キーワードが長すぎます (最大${MAX_KEYWORD_LENGTH}文字)` }
  }

  return { keyword }
}

export const truncateForNotification = (keyword: string): string =>
  keyword.length > NOTIFICATION_KEYWORD_MAX_LENGTH
    ? `${keyword.slice(0, NOTIFICATION_KEYWORD_MAX_LENGTH)}…`
    : keyword

export const createMuteQueue = (deps: MuteQueueDeps): MuteQueue => {
  const queue: string[] = []
  // キュー投入済み・処理中のキーワード（完了後は削除し再追加を許可する）
  const pending = new Set<string>()
  // 処理ループが二重起動しないようにするbusy flag。
  // enqueueからprocessNextを同期呼び出しするため、Promiseチェーンではなくこのフラグで直列性を保証する
  let processing = false

  // 呼び出し元（enqueue）から同期的に呼び出すことで、戻る前に
  // addMuteKeywordToXの呼び出し（＝最初の非同期Chrome API呼び出し）を開始させる。
  // これによりsendResponse後・呼び出し元終了後にService Workerが「保留中の処理なし」と
  // 判断されて停止するのを防ぐ。
  const processNext = (): void => {
    if (processing) return

    const keyword = queue.shift()
    if (keyword === undefined) return

    processing = true

    const finish = (): void => {
      pending.delete(keyword)
      processing = false
      processNext()
    }

    let started: Promise<boolean>
    try {
      started = Promise.resolve(deps.addMuteKeywordToX(keyword))
    } catch (error) {
      started = Promise.reject(error)
    }

    started
      .then(
        (success) => success,
        () => false
      )
      .then(async (success) => {
        if (!success) {
          await deps.notifyFailure(keyword)
        }
      })
      .catch(() => {})
      .finally(finish)
  }

  const enqueue = (rawKeyword: string): EnqueueResult => {
    const validated = validateMuteKeyword(rawKeyword)
    if ('error' in validated) {
      return { accepted: false, error: validated.error }
    }
    const { keyword } = validated

    if (pending.has(keyword)) {
      return { accepted: true, deduplicated: true }
    }

    pending.add(keyword)
    queue.push(keyword)
    // sendResponse前に同期的に処理を開始させる（詳細は上のprocessNextコメント参照）
    processNext()

    return { accepted: true }
  }

  return { enqueue }
}
