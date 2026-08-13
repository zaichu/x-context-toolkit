import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ADD_MUTE_KEYWORDS_URL,
  MUTED_KEYWORDS_URL,
  addMuteKeywordToX,
  fillMuteKeywordForm,
  isMuteKeywordsListPage,
  prepareAndFillMuteKeywordForm,
} from './xMuteKeywords'

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
  query?: ReturnType<typeof vi.fn>
}) => {
  const create = vi.fn().mockResolvedValue({ id: TAB_ID })
  const remove = overrides.remove ?? vi.fn().mockResolvedValue(undefined)
  // 既定では既存タブなし（=常に新規タブ方式へフォールバック）とする
  const query = overrides.query ?? vi.fn().mockResolvedValue([])

  vi.stubGlobal('chrome', {
    tabs: { create, sendMessage: overrides.sendMessage, remove, query },
  })

  return { create, sendMessage: overrides.sendMessage, remove, query }
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

  it('同時に複数回呼ばれても互いに競合せず、それぞれ正しいタブに送信・クローズする', async () => {
    let nextTabId = 300
    const create = vi.fn().mockImplementation(async () => ({ id: nextTabId++ }))
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const remove = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { tabs: { create, sendMessage, remove } })

    const [resultA, resultB] = await Promise.all([
      addMuteKeywordToX('キーワードA'),
      addMuteKeywordToX('キーワードB'),
    ])

    expect(resultA).toBe(true)
    expect(resultB).toBe(true)
    expect(create).toHaveBeenCalledTimes(2)
    // それぞれ自分が作成したタブIDに対してのみ送信・クローズしており、取り違えがない
    expect(sendMessage).toHaveBeenCalledWith(300, { action: 'fillMuteKeyword', keyword: 'キーワードA' })
    expect(sendMessage).toHaveBeenCalledWith(301, { action: 'fillMuteKeyword', keyword: 'キーワードB' })
    expect(remove).toHaveBeenCalledWith(300)
    expect(remove).toHaveBeenCalledWith(301)
  })

  it('区間ごとの所要時間をキーワード本文を含めずに1行のconsole.infoで出力する', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      success: true,
      timings: { inputFoundMs: 1, saveClickedMs: 2, settledMs: 3 },
    })
    stubChrome({ sendMessage })
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    await addMuteKeywordToX('ひみつのキーワード')

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
    const loggedLine = consoleInfoSpy.mock.calls[0][0] as string
    expect(loggedLine).toMatch(
      /tabCreated=\d+ contentReady=\d+ inputFound=\d+ saveClicked=\d+ settled=\d+ total=\d+/,
    )
    expect(loggedLine).not.toContain('ひみつのキーワード')
    expect(loggedLine).toContain('reusedTab=false')

    consoleInfoSpy.mockRestore()
  })

  it('既存のadd_muted_keywordタブがあれば新規タブを作らずそのタブへ送信し、閉じない', async () => {
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === ADD_MUTE_KEYWORDS_URL) return [{ id: 900 }]
      return []
    })
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const { create, remove } = stubChrome({ sendMessage, query })

    const result = await addMuteKeywordToX('テスト')

    expect(result).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledWith(900, { action: 'fillMuteKeyword', keyword: 'テスト' })
    expect(remove).not.toHaveBeenCalled()
  })

  it('既存のmuted_keywordsタブしかない場合はprepareAndFillMuteKeywordを送り、閉じない', async () => {
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === MUTED_KEYWORDS_URL) return [{ id: 901 }]
      return []
    })
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const { create, remove } = stubChrome({ sendMessage, query })

    const result = await addMuteKeywordToX('テスト')

    expect(result).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledWith(901, { action: 'prepareAndFillMuteKeyword', keyword: 'テスト' })
    expect(remove).not.toHaveBeenCalled()
  })

  it('add_muted_keywordとmuted_keywordsの両方が存在する場合はadd_muted_keywordを優先する', async () => {
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === ADD_MUTE_KEYWORDS_URL) return [{ id: 900 }]
      if (url === MUTED_KEYWORDS_URL) return [{ id: 901 }]
      return []
    })
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    stubChrome({ sendMessage, query })

    await addMuteKeywordToX('テスト')

    expect(sendMessage).toHaveBeenCalledWith(900, { action: 'fillMuteKeyword', keyword: 'テスト' })
  })

  it('既存タブ内のフォーム処理自体が失敗した場合は二重登録を避けるため新規タブへ再試行しない', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === ADD_MUTE_KEYWORDS_URL) return [{ id: 900 }]
      return []
    })
    const sendMessage = vi.fn().mockResolvedValue({ success: false })
    const { create, remove } = stubChrome({ sendMessage, query })

    const result = await addMuteKeywordToX('テスト')

    expect(result).toBe(false)
    expect(create).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledTimes(1)

    consoleErrorSpy.mockRestore()
  })

  it('既存タブへのメッセージ送信自体が失敗（受信不能）した場合は新規タブ方式へフォールバックする', async () => {
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === ADD_MUTE_KEYWORDS_URL) return [{ id: 900 }]
      return []
    })
    const sendMessage = vi.fn().mockImplementation(async (tabId: number) => {
      if (tabId === 900) throw new Error('拡張機能のコンテキストが無効です')
      return { success: true }
    })
    const { create, remove } = stubChrome({ sendMessage, query })

    const result = await addMuteKeywordToX('テスト')

    expect(result).toBe(true)
    expect(create).toHaveBeenCalledWith({ url: ADD_MUTE_KEYWORDS_URL, active: false })
    expect(sendMessage).toHaveBeenCalledWith(TAB_ID, { action: 'fillMuteKeyword', keyword: 'テスト' })
    expect(remove).toHaveBeenCalledWith(TAB_ID)
  })

  it('既存タブが見つからない場合は新規タブ方式で送信する（フォールバック）', async () => {
    const query = vi.fn().mockResolvedValue([])
    const sendMessage = vi.fn().mockResolvedValue({ success: true })
    const { create } = stubChrome({ sendMessage, query })

    const result = await addMuteKeywordToX('テスト')

    expect(result).toBe(true)
    expect(create).toHaveBeenCalledWith({ url: ADD_MUTE_KEYWORDS_URL, active: false })
  })

  it('同時要求は同じ既存タブを直列に処理する（キューイング）', async () => {
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === ADD_MUTE_KEYWORDS_URL) return [{ id: 900 }]
      return []
    })
    let active = 0
    let maxActive = 0
    const sendMessage = vi.fn().mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 20))
      active--
      return { success: true }
    })
    const { create } = stubChrome({ sendMessage, query })

    vi.useFakeTimers()
    const resultsPromise = Promise.all([
      addMuteKeywordToX('キーワードA'),
      addMuteKeywordToX('キーワードB'),
    ])
    await vi.runAllTimersAsync()
    const results = await resultsPromise

    expect(results).toEqual([true, true])
    expect(maxActive).toBe(1)
    expect(create).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('既存タブ再利用時はtimingsログへreusedTab=trueを出す（キーワード本文は含めない）', async () => {
    const query = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      if (url === ADD_MUTE_KEYWORDS_URL) return [{ id: 900 }]
      return []
    })
    const sendMessage = vi.fn().mockResolvedValue({
      success: true,
      timings: { inputFoundMs: 1, saveClickedMs: 2, settledMs: 3 },
    })
    stubChrome({ sendMessage, query })
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    await addMuteKeywordToX('ひみつのキーワード')

    const loggedLine = consoleInfoSpy.mock.calls[0][0] as string
    expect(loggedLine).toContain('reusedTab=true')
    expect(loggedLine).not.toContain('ひみつのキーワード')

    consoleInfoSpy.mockRestore()
  })
})

describe('isMuteKeywordsListPage', () => {
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true, writable: true })
  })

  const setHref = (href: string) => {
    Object.defineProperty(window, 'location', { value: { href }, configurable: true, writable: true })
  }

  it('URLがミュートキーワード一覧ページなら true を返す', () => {
    setHref(MUTED_KEYWORDS_URL)
    expect(isMuteKeywordsListPage()).toBe(true)
  })

  it('URLがミュートキーワード一覧ページでなければ false を返す', () => {
    setHref(ADD_MUTE_KEYWORDS_URL)
    expect(isMuteKeywordsListPage()).toBe(false)
  })
})

describe('prepareAndFillMuteKeywordForm', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const ADD_LINK_SELECTOR_TEXT = 'ミュートする単語またはフレーズを追加'

  it('追加リンクをクリックしてからフォームへ入力する', async () => {
    document.body.innerHTML = `<a aria-label="${ADD_LINK_SELECTOR_TEXT}" href="/settings/add_muted_keyword">追加</a>`
    const link = document.querySelector('a') as HTMLAnchorElement
    let clicked = false
    link.addEventListener('click', (event) => {
      // jsdomは実ナビゲーションを実装していないため、SPA遷移を模すのみでデフォルト動作は止める
      event.preventDefault()
      clicked = true
      // SPA遷移によりフォームが後から出現する様子を再現
      const { input, button } = renderMuteKeywordForm()
      void input
      void button
    })

    vi.useFakeTimers()
    const resultPromise = prepareAndFillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(clicked).toBe(true)
    expect(result.success).toBe(true)
  })

  it('追加リンクが見つからない場合はsuccess:falseで解決する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.useFakeTimers()
    const resultPromise = prepareAndFillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(false)
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
    expect(result.success).toBe(true)
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
    expect(result.success).toBe(true)
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
    expect(result.success).toBe(true)
  })

  it('保存後、URLがミュートキーワード追加ページから離れたら即座に完了する（disabledトグルを検知できなくてもよい）', async () => {
    const { button } = renderMuteKeywordForm()
    button.addEventListener('click', () => {
      // disabledはトグルされないが、保存成功後にXがページ遷移するケースを模す
      setTimeout(() => {
        window.history.pushState({}, '', '/settings/muted_keywords')
      }, 30)
    })

    vi.useFakeTimers()
    let resolved = false
    const resultPromise = fillMuteKeywordForm('テスト').then((r) => { resolved = true; return r })

    // 要素検出の最初のポーリング(約100ms)+クリック後30msの遷移+ポーリング間隔を見込んでも、
    // フォールバック上限(500ms)より十分早く完了するはず
    await vi.advanceTimersByTimeAsync(250)
    expect(resolved).toBe(true)

    const result = await resultPromise
    expect(result.success).toBe(true)
  })

  it('保存後、キーワード入力欄がDOMから消えたら即座に完了する（disabledトグルを検知できなくてもよい）', async () => {
    const { input, button } = renderMuteKeywordForm()
    button.addEventListener('click', () => {
      // disabledはトグルされないが、保存成功後にフォームが再描画され入力欄が消えるケースを模す
      setTimeout(() => { input.remove() }, 30)
    })

    vi.useFakeTimers()
    let resolved = false
    const resultPromise = fillMuteKeywordForm('テスト').then((r) => { resolved = true; return r })

    await vi.advanceTimersByTimeAsync(250)
    expect(resolved).toBe(true)

    const result = await resultPromise
    expect(result.success).toBe(true)
  })

  it('【仮説再現】保存後に成功の兆候(disabled再有効化・URL遷移・フォーム消失)を何も検知できない実機ケースでも、3秒ではなく短い猶予で完了する', async () => {
    const { button } = renderMuteKeywordForm()
    // 実機のXでは保存クリックしてもbutton.disabledがトグルされないケースがあり、
    // その場合sawSubmittingが立たず、waitForSaveToSettleは兆候を一切検知できない。
    // URL遷移もフォーム消失も起きない状態を再現する。
    void button

    vi.useFakeTimers()
    let resolved = false
    const resultPromise = fillMuteKeywordForm('テスト').then((r) => { resolved = true; return r })

    // 兆候を検知できない場合でも、3秒ではなく十分短い猶予（900ms未満）で完了すべき
    await vi.advanceTimersByTimeAsync(900)
    expect(resolved).toBe(true)

    const result = await resultPromise
    expect(result.success).toBe(true)
  })

  it('保存ボタンが見つからない場合はsuccess:falseで解決する', async () => {
    renderMuteKeywordForm()
    document.querySelector('button[data-testid="settingsDetailSave"]')?.remove()

    vi.useFakeTimers()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const resultPromise = fillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(false)
    consoleErrorSpy.mockRestore()
  })

  it('keyword inputのform外に表示中の「保存」ボタンがあっても、それをクリックしない', async () => {
    document.body.innerHTML = `
      <div data-testid="primaryColumn">
        <button type="button" id="decoy">保存</button>
        <form>
          <input name="keyword" />
          <button type="submit">Save</button>
        </form>
      </div>
    `
    const input = document.querySelector('input[name="keyword"]') as HTMLInputElement
    const decoy = document.getElementById('decoy') as HTMLButtonElement
    const formButton = document.querySelector('form button[type="submit"]') as HTMLButtonElement
    makeVisible(input)
    makeVisible(decoy)
    makeVisible(formButton)

    let decoyClicked = false
    let formButtonClicked = false
    decoy.addEventListener('click', () => { decoyClicked = true })
    // jsdomはHTMLFormElement.requestSubmitを未実装のため、submitボタンの既定動作（フォーム送信）を止める
    formButton.addEventListener('click', (event) => { event.preventDefault(); formButtonClicked = true })

    vi.useFakeTimers()
    const resultPromise = fillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(decoyClicked).toBe(false)
    expect(formButtonClicked).toBe(true)
    expect(result.success).toBe(true)
  })

  it('keyword inputと同じform内のbutton[type="submit"]は英語ラベルSaveでも検出してクリックする', async () => {
    document.body.innerHTML = `
      <div data-testid="primaryColumn">
        <form>
          <input name="keyword" />
          <button type="submit">Save</button>
        </form>
      </div>
    `
    const input = document.querySelector('input[name="keyword"]') as HTMLInputElement
    const button = document.querySelector('button[type="submit"]') as HTMLButtonElement
    makeVisible(input)
    makeVisible(button)

    let clicked = false
    // jsdomはHTMLFormElement.requestSubmitを未実装のため、submitボタンの既定動作（フォーム送信）を止める
    button.addEventListener('click', (event) => { event.preventDefault(); clicked = true })

    vi.useFakeTimers()
    const resultPromise = fillMuteKeywordForm('テスト')
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(clicked).toBe(true)
    expect(result.success).toBe(true)
  })
})
