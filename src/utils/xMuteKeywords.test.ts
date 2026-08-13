import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADD_MUTE_KEYWORDS_URL, addMuteKeywordToX, fillMuteKeywordForm } from './xMuteKeywords'

// jsdomはレイアウトを計算しないため、offsetParentは明示的に与えないと常にnullになる
const makeVisible = (element: HTMLElement): void => {
  Object.defineProperty(element, 'offsetParent', { get: () => document.body, configurable: true })
}

const renderMuteKeywordForm = (): { input: HTMLInputElement; button: HTMLButtonElement } => {
  document.body.innerHTML = `
    <div data-testid="primaryColumn">
      <form>
        <input name="keyword" />
        <button type="button" data-testid="settingsDetailSave">保存</button>
      </form>
    </div>
  `
  const input = document.querySelector('input[name="keyword"]') as HTMLInputElement
  const button = document.querySelector('button[data-testid="settingsDetailSave"]') as HTMLButtonElement
  makeVisible(input)
  makeVisible(button)
  return { input, button }
}

const TAB_ID = 200
const RECEIVING_END_MISSING = new Error('Could not establish connection. Receiving end does not exist.')

const stubChrome = (overrides: {
  sendMessage: ReturnType<typeof vi.fn>
  remove?: ReturnType<typeof vi.fn>
}) => {
  const create = vi.fn().mockResolvedValue({ id: TAB_ID })
  const remove = overrides.remove ?? vi.fn().mockResolvedValue(undefined)

  vi.stubGlobal('chrome', {
    tabs: { create, sendMessage: overrides.sendMessage, remove },
  })

  return { create, sendMessage: overrides.sendMessage, remove }
}

describe('addMuteKeywordToX', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('タブ作成直後にコンテンツスクリプトへ送信する（読み込み完了を待たない）', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const { create } = stubChrome({ sendMessage })

    const result = await addMuteKeywordToX('テスト')

    expect(create).toHaveBeenCalledWith({ url: ADD_MUTE_KEYWORDS_URL, active: false })
    expect(sendMessage).toHaveBeenCalledWith(TAB_ID, { action: 'fillMuteKeyword', keyword: 'テスト' })
    expect(result).toBe(true)
  })

  it('成功時は一時タブを閉じる', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const { remove } = stubChrome({ sendMessage })

    const result = await addMuteKeywordToX('テスト')

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(true)
  })

  it('失敗時も一時タブを閉じる', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendMessage = vi.fn().mockResolvedValue({ success: false })
    const { remove } = stubChrome({ sendMessage })

    const result = await addMuteKeywordToX('テスト')

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('受信先未準備エラーは再試行し、コンテンツスクリプトの準備ができ次第すぐ処理を始める', async () => {
    const sendMessage = vi.fn()
      .mockRejectedValueOnce(RECEIVING_END_MISSING)
      .mockRejectedValueOnce(RECEIVING_END_MISSING)
      .mockResolvedValueOnce({ success: true })
    stubChrome({ sendMessage })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(sendMessage).toHaveBeenCalledTimes(3)
    expect(result).toBe(true)
  })

  it('受信先未準備エラー以外は再試行せず即座に失敗し、一時タブを閉じる', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendMessage = vi.fn().mockRejectedValue(new Error('拡張機能のコンテキストが無効です'))
    const { remove } = stubChrome({ sendMessage })

    const result = await addMuteKeywordToX('テスト')

    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('コンテンツスクリプトがいつまでも準備できなくても一時タブを閉じ、falseで解決する（永久に「追加中」にならない）', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendMessage = vi.fn().mockRejectedValue(RECEIVING_END_MISSING)
    const { remove } = stubChrome({ sendMessage })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('コンテンツスクリプトの応答がいつまでも返らなくても一時タブを閉じ、falseで解決する（永久に「追加中」にならない）', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // sendMessageが永久に解決しないケース（コンテンツスクリプトが応答しない）を再現
    const sendMessage = vi.fn().mockReturnValue(new Promise(() => {}))
    const { remove } = stubChrome({ sendMessage })

    vi.useFakeTimers()
    const resultPromise = addMuteKeywordToX('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(remove).toHaveBeenCalledWith(TAB_ID)
    expect(result).toBe(false)

    consoleErrorSpy.mockRestore()
  })
})

describe('fillMuteKeywordForm', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('キーワードをネイティブsetterで一括設定し、input/changeイベントを1回ずつ発火する（1文字ごとの入力をしない）', async () => {
    const { input } = renderMuteKeywordForm()
    let inputEvents = 0
    let changeEvents = 0
    input.addEventListener('input', () => { inputEvents++ })
    input.addEventListener('change', () => { changeEvents++ })

    vi.useFakeTimers()
    const resultPromise = fillMuteKeywordForm('テストキーワード')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(input.value).toBe('テストキーワード')
    expect(inputEvents).toBe(1)
    expect(changeEvents).toBe(1)
    expect(result).toBe(true)
  })

  it('保存ボタンが有効になるまで条件待ちしてからクリックする（固定スリープではない）', async () => {
    const { input, button } = renderMuteKeywordForm()
    button.disabled = true
    let clicked = false
    input.addEventListener('input', () => {
      // Reactの非同期な再描画を模した遅延つきの有効化
      setTimeout(() => { button.disabled = false }, 20)
    })
    button.addEventListener('click', () => {
      // まだ無効な時点でクリックされていたら不正
      if (button.disabled) throw new Error('無効なボタンがクリックされた')
      clicked = true
    })

    vi.useFakeTimers()
    const resultPromise = fillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(clicked).toBe(true)
    expect(result).toBe(true)
  })

  it('保存後は妥当な成功の兆候（ボタンの再有効化）を検知し次第完了し、固定1000ms待機をしない', async () => {
    const { input, button } = renderMuteKeywordForm()
    button.addEventListener('click', () => {
      button.disabled = true
      // 保存リクエストが片付いたことを模す
      setTimeout(() => { button.disabled = false }, 30)
    })
    void input

    vi.useFakeTimers()
    let resolved = false
    const resultPromise = fillMuteKeywordForm('テスト').then((r) => { resolved = true; return r })

    // 元実装は入力後500ms・保存後1000msの固定待機だけで1500ms以上かかっていたが、
    // 新実装は条件待ちのため、それより十分短い時間で完了するはず
    await vi.advanceTimersByTimeAsync(300)
    expect(resolved).toBe(true)

    const result = await resultPromise
    expect(result).toBe(true)
  })

  it('保存ボタンが見つからない場合はfalseで解決する', async () => {
    renderMuteKeywordForm()
    document.querySelector('button[data-testid="settingsDetailSave"]')?.remove()

    vi.useFakeTimers()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const resultPromise = fillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toBe(false)
    consoleErrorSpy.mockRestore()
  })
})
