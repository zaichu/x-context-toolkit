import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const addMuteKeywordToXMock = vi.fn()

vi.mock('../utils/xMuteKeywords', () => ({
  addMuteKeywordToX: (keyword: string) => addMuteKeywordToXMock(keyword),
}))

// マイクロタスクキューが尽きるまで待つ
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

type Listener = (request: unknown, sender: unknown, sendResponse: (response: unknown) => void) => unknown

const setupChrome = () => {
  const contextMenuListeners: Array<(info: { menuItemId: string; selectionText?: string }) => unknown> = []
  const messageListeners: Listener[] = []
  const notificationsCreate = vi.fn().mockResolvedValue(undefined)

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: (fn: Listener) => messageListeners.push(fn) },
    },
    contextMenus: {
      removeAll: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      onClicked: { addListener: (fn: (info: { menuItemId: string; selectionText?: string }) => unknown) => contextMenuListeners.push(fn) },
    },
    notifications: {
      create: notificationsCreate,
    },
  })

  return { contextMenuListeners, messageListeners, notificationsCreate }
}

describe('background/index', () => {
  beforeEach(() => {
    vi.resetModules()
    addMuteKeywordToXMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('enqueueMuteKeywordメッセージを受けると検証・キュー投入のみでaccepted:trueを即応答する（保存完了を待たない）', async () => {
    const { messageListeners } = setupChrome()
    addMuteKeywordToXMock.mockReturnValue(new Promise(() => {})) // 完了しない = 待つと詰まる
    await import('./index')

    const sendResponse = vi.fn()
    const [listener] = messageListeners
    listener({ action: 'enqueueMuteKeyword', keyword: 'テスト' }, {}, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({ accepted: true })
  })

  it('sendResponse呼び出し時点で既にaddMuteKeywordToXが呼ばれている（応答直後にService Workerが停止しても処理開始済みを保証する）', async () => {
    const { messageListeners } = setupChrome()
    addMuteKeywordToXMock.mockReturnValue(new Promise(() => {}))
    await import('./index')

    const [listener] = messageListeners
    let calledBeforeResponse = false
    const sendResponse = vi.fn(() => {
      calledBeforeResponse = addMuteKeywordToXMock.mock.calls.length > 0
    })
    listener({ action: 'enqueueMuteKeyword', keyword: 'テスト' }, {}, sendResponse)

    expect(calledBeforeResponse).toBe(true)
  })

  it('同じキーワードのenqueueMuteKeywordが重複してもdeduplicated:trueを返す', async () => {
    const { messageListeners } = setupChrome()
    addMuteKeywordToXMock.mockReturnValue(new Promise(() => {}))
    await import('./index')

    const [listener] = messageListeners
    const sendResponse1 = vi.fn()
    const sendResponse2 = vi.fn()
    listener({ action: 'enqueueMuteKeyword', keyword: '重複' }, {}, sendResponse1)
    listener({ action: 'enqueueMuteKeyword', keyword: '重複' }, {}, sendResponse2)

    expect(sendResponse1).toHaveBeenCalledWith({ accepted: true })
    expect(sendResponse2).toHaveBeenCalledWith({ accepted: true, deduplicated: true })
  })

  it('enqueueMuteKeywordの入力検証エラーはaccepted:falseとerrorを返す', async () => {
    const { messageListeners } = setupChrome()
    await import('./index')

    const [listener] = messageListeners
    const sendResponse = vi.fn()
    listener({ action: 'enqueueMuteKeyword', keyword: '   ' }, {}, sendResponse)

    expect(sendResponse).toHaveBeenCalledWith({ accepted: false, error: '有効なキーワードを選択してください' })
    expect(addMuteKeywordToXMock).not.toHaveBeenCalled()
  })

  it('キュー投入後の保存成功時は通知を出さない（静かに完了）', async () => {
    const { messageListeners, notificationsCreate } = setupChrome()
    addMuteKeywordToXMock.mockResolvedValue(true)
    await import('./index')

    const [listener] = messageListeners
    listener({ action: 'enqueueMuteKeyword', keyword: 'テスト' }, {}, vi.fn())
    await flushMicrotasks()

    expect(notificationsCreate).not.toHaveBeenCalled()
  })

  it('キュー投入後の保存失敗時は40文字に省略した通知を出す', async () => {
    const { messageListeners, notificationsCreate } = setupChrome()
    addMuteKeywordToXMock.mockResolvedValue(false)
    await import('./index')

    const longKeyword = 'あ'.repeat(60)
    const [listener] = messageListeners
    listener({ action: 'enqueueMuteKeyword', keyword: longKeyword }, {}, vi.fn())
    await flushMicrotasks()

    expect(notificationsCreate).toHaveBeenCalledTimes(1)
    const call = notificationsCreate.mock.calls[0][0] as { message: string }
    expect(call.message).toContain('あ'.repeat(40))
    expect(call.message).not.toContain('あ'.repeat(41))
    expect(call.message).toContain('の追加に失敗しました')
  })

  it('右クリックはenqueueと同じ関数を使い、受付成功時は通知を出さない', async () => {
    const { contextMenuListeners, notificationsCreate } = setupChrome()
    addMuteKeywordToXMock.mockReturnValue(new Promise(() => {}))
    await import('./index')

    const [onClicked] = contextMenuListeners
    await onClicked({ menuItemId: 'add-mute-keyword', selectionText: 'テスト' })

    expect(notificationsCreate).not.toHaveBeenCalled()
    expect(addMuteKeywordToXMock).toHaveBeenCalledWith('テスト')
  })

  it('右クリックで無効なキーワード（空文字）の場合は従来どおり通知する', async () => {
    const { contextMenuListeners, notificationsCreate } = setupChrome()
    await import('./index')

    const [onClicked] = contextMenuListeners
    await onClicked({ menuItemId: 'add-mute-keyword', selectionText: '   ' })

    expect(notificationsCreate).toHaveBeenCalledTimes(1)
    const call = notificationsCreate.mock.calls[0][0] as { message: string }
    expect(call.message).toBe('有効なキーワードを選択してください')
    expect(addMuteKeywordToXMock).not.toHaveBeenCalled()
  })

  it('右クリックで保存に失敗した場合は失敗通知を出す', async () => {
    const { contextMenuListeners, notificationsCreate } = setupChrome()
    addMuteKeywordToXMock.mockResolvedValue(false)
    await import('./index')

    const [onClicked] = contextMenuListeners
    await onClicked({ menuItemId: 'add-mute-keyword', selectionText: 'テスト' })
    await flushMicrotasks()

    expect(notificationsCreate).toHaveBeenCalledTimes(1)
    const call = notificationsCreate.mock.calls[0][0] as { message: string }
    expect(call.message).toContain('の追加に失敗しました')
  })
})
