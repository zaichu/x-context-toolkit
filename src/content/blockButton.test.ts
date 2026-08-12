import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractTweetAuthorUsername,
  getCurrentUsername,
  hasBlockButton,
  insertBlockButton,
  observeTweetArticles,
} from './blockButton'

const buildTweetArticle = (username: string, withCaret = true): HTMLElement => {
  const article = document.createElement('article')
  article.setAttribute('data-testid', 'tweet')
  article.innerHTML = `
    <div data-testid="Tweet-User-Avatar"><a href="/${username}" role="link">avatar</a></div>
    <div data-testid="User-Name">
      <a href="/${username}" role="link">表示名</a>
      <a href="/${username}" role="link">@${username}</a>
    </div>
    <div class="tweet-header-actions">
      <div class="grok-action-slot"><button aria-label="Grokのアクション" class="x-action-button x-round-button">Grok</button></div>
      <div>${withCaret ? '<button data-testid="caret" aria-label="More">...</button>' : ''}</div>
    </div>
    <div role="group">
      <div><button data-testid="reply">reply</button></div>
      <div><button data-testid="retweet">retweet</button></div>
      <div><button data-testid="like">like</button></div>
    </div>
  `
  return article
}

const addGrokAction = (article: HTMLElement): HTMLElement => {
  const existing = article.querySelector<HTMLElement>('.grok-action-slot')
  if (existing) return existing

  const headerActions = document.createElement('div')
  headerActions.className = 'tweet-header-actions'
  const grokAction = document.createElement('div')
  grokAction.className = 'grok-action-slot'
  grokAction.innerHTML = '<button aria-label="Grokのアクション">Grok</button>'
  const caretAction = document.createElement('div')
  const caret = article.querySelector<HTMLButtonElement>('[data-testid="caret"]')!
  caretAction.appendChild(caret)
  headerActions.append(grokAction, caretAction)
  article.prepend(headerActions)
  return grokAction
}

describe('extractTweetAuthorUsername', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('articleのアバターリンクから投稿者usernameを抽出する', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    expect(extractTweetAuthorUsername(article)).toBe('testuser')
  })

  it('引用ポストなど別articleのリンクは対象にしない', () => {
    const article = buildTweetArticle('outeruser')
    const quoted = buildTweetArticle('quoteduser')
    article.appendChild(quoted)
    document.body.appendChild(article)

    expect(extractTweetAuthorUsername(article)).toBe('outeruser')
    expect(extractTweetAuthorUsername(quoted)).toBe('quoteduser')
  })

  it('プロフィールリンクが見つからない場合はnullを返す', () => {
    const article = document.createElement('article')
    article.setAttribute('data-testid', 'tweet')
    document.body.appendChild(article)

    expect(extractTweetAuthorUsername(article)).toBeNull()
  })
})

describe('getCurrentUsername', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('プロフィールリンクから自分のusernameを取得する', () => {
    document.body.innerHTML = '<a data-testid="AppTabBar_Profile_Link" href="/myself"></a>'
    expect(getCurrentUsername()).toBe('myself')
  })

  it('見つからない場合はnullを返す', () => {
    document.body.innerHTML = ''
    expect(getCurrentUsername()).toBeNull()
  })
})

describe('insertBlockButton / hasBlockButton', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('アクション列にブロックボタンを挿入する', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    const button = insertBlockButton(article)

    expect(button).not.toBeNull()
    expect(button?.classList.contains('block-button')).toBe(true)
    expect(button?.getAttribute('aria-label')).toBe('ブロック')
    expect(button?.getAttribute('title')).toBe('このユーザーをブロック')
    expect(button?.type).toBe('button')
    expect(button?.textContent).toBe('🚫')
    expect(hasBlockButton(article)).toBe(true)
  })

  it('二重挿入を防止する', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    insertBlockButton(article)
    const second = insertBlockButton(article)

    expect(second).toBeNull()
    expect(article.querySelectorAll('.block-button')).toHaveLength(1)
  })

  it('アクション列が見つからない場合は挿入しない', () => {
    const article = document.createElement('article')
    article.setAttribute('data-testid', 'tweet')
    document.body.appendChild(article)

    expect(insertBlockButton(article)).toBeNull()
  })

  it('Grokと同じボタンクラスと中央揃え寸法を適用する', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    const button = insertBlockButton(article)!

    expect(button.style.backgroundColor).toBe('transparent')
    expect(button.classList.contains('x-action-button')).toBe(true)
    expect(button.classList.contains('x-round-button')).toBe(true)
    expect(button.style.display).toBe('flex')
    expect(button.style.alignItems).toBe('center')
    expect(button.style.justifyContent).toBe('center')
    expect(button.style.width).toBe('34px')
    expect(button.style.height).toBe('34px')
    expect(button.style.padding).toBe('0px')
    expect(button.style.margin).toBe('0px')
    expect(button.style.lineHeight).toBe('1')
    expect(button.style.cursor).toBe('pointer')
  })

  it('X既存のアクション列を大きく崩さないよう、他のアクションボタンと並んで挿入される', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    const button = insertBlockButton(article)!

    expect(button.closest('.tweet-header-actions')).not.toBeNull()
  })

  it('Grokアクションがある場合はその直前（左側）に挿入する', () => {
    const article = buildTweetArticle('testuser')
    const grokAction = addGrokAction(article)
    document.body.appendChild(article)

    const button = insertBlockButton(article)!

    expect(button.parentElement?.className).toBe(grokAction.className)
    expect(button.parentElement?.nextElementSibling).toBe(grokAction)
  })

  it('投稿ヘッダーのGrok領域がある場合は先頭に挿入する', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    const button = insertBlockButton(article)!
    const actionArea = article.querySelector('.tweet-header-actions')!

    expect(actionArea.firstElementChild).toBe(button.parentElement)
  })

  it('Grok領域がまだ生成されていない場合は下部アクション列へフォールバックしない', () => {
    const article = buildTweetArticle('testuser')
    article.querySelector('.tweet-header-actions')?.remove()
    document.body.appendChild(article)

    expect(insertBlockButton(article)).toBeNull()
    expect(article.querySelector('.block-button')).toBeNull()
  })
})

describe('ブロックボタンの状態別スタイル', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('処理中(processing)はidleと視覚的に区別できる', async () => {
    vi.useFakeTimers()
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser', false)
    document.body.appendChild(article)
    const button = insertBlockButton(article)!
    const idleOpacity = button.style.opacity
    const idleCursor = button.style.cursor

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(button.style.opacity).not.toBe(idleOpacity)
    expect(button.style.cursor).not.toBe(idleCursor)

    await vi.runAllTimersAsync()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('完了(done)は🚫から✅に表示が変わり視覚的に区別できる', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)
    const button = insertBlockButton(article)!

    const caretButton = article.querySelector('[data-testid="caret"]') as HTMLButtonElement
    caretButton.addEventListener('click', () => {
      const menuItem = document.createElement('div')
      menuItem.setAttribute('role', 'menuitem')
      menuItem.textContent = 'Block @testuser'
      document.body.appendChild(menuItem)

      const confirmButton = document.createElement('button')
      confirmButton.setAttribute('data-testid', 'confirmationSheetConfirm')
      confirmButton.textContent = 'Block'
      document.body.appendChild(confirmButton)

      confirmButton.addEventListener('click', () => confirmButton.remove())
    })

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(button.textContent).toBe('✅')
    })

    vi.unstubAllGlobals()
  })
})

describe('observeTweetArticles', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('既存のarticleへ初期スキャンでボタンを挿入する', () => {
    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    const observer = observeTweetArticles(document.body)

    expect(hasBlockButton(article)).toBe(true)
    observer.disconnect()
  })

  it('動的に追加されたarticleにもボタンを挿入する', async () => {
    const observer = observeTweetArticles(document.body)

    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)

    await vi.waitFor(() => {
      expect(hasBlockButton(article)).toBe(true)
    })

    observer.disconnect()
  })

  it('article追加後にGrok領域が遅延生成されてもボタンを挿入する', async () => {
    const article = buildTweetArticle('testuser')
    const headerActions = article.querySelector('.tweet-header-actions')!
    headerActions.remove()
    document.body.appendChild(article)
    const observer = observeTweetArticles(document.body)

    article.prepend(headerActions)

    await vi.waitFor(() => expect(hasBlockButton(article)).toBe(true))
    observer.disconnect()
  })

  it('複数articleそれぞれに1つずつボタンを挿入する（重複処理しない）', () => {
    const article1 = buildTweetArticle('user1')
    const article2 = buildTweetArticle('user2')
    document.body.appendChild(article1)
    document.body.appendChild(article2)

    const observer = observeTweetArticles(document.body)

    expect(article1.querySelectorAll('.block-button')).toHaveLength(1)
    expect(article2.querySelectorAll('.block-button')).toHaveLength(1)
    observer.disconnect()
  })
})

describe('ブロックボタンのクリック挙動', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const appendGlobalMenuAndConfirm = (username: string) => {
    const menuItem = document.createElement('div')
    menuItem.setAttribute('role', 'menuitem')
    menuItem.textContent = `Block @${username}`
    document.body.appendChild(menuItem)

    const confirmButton = document.createElement('button')
    confirmButton.setAttribute('data-testid', 'confirmationSheetConfirm')
    confirmButton.textContent = 'Block'
    menuItem.addEventListener('click', () => {
      document.body.appendChild(confirmButton)
      confirmButton.addEventListener('click', () => {
        confirmButton.remove()
      })
    })

    return { menuItem, confirmButton }
  }

  it('1クリックでcaretメニューを開き、block項目と確認ボタンを押して完了表示になる', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)
    const button = insertBlockButton(article)!

    const caretButton = article.querySelector('[data-testid="caret"]') as HTMLButtonElement
    const caretClickSpy = vi.fn()
    caretButton.addEventListener('click', () => {
      caretClickSpy()
      appendGlobalMenuAndConfirm('testuser')
    })

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(button.classList.contains('block-button--done')).toBe(true)
    })

    expect(caretClickSpy).toHaveBeenCalledOnce()
    expect(button.disabled).toBe(true)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('確認シートが描画される前に確定ボタンを押す', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)
    const button = insertBlockButton(article)!
    let confirmedBeforePaint = false
    let painted = false
    const animationCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationCallbacks.push(callback)
      return animationCallbacks.length
    })

    const caretButton = article.querySelector('[data-testid="caret"]') as HTMLButtonElement
    caretButton.addEventListener('click', () => {
      const { menuItem, confirmButton } = appendGlobalMenuAndConfirm('testuser')
      menuItem.addEventListener('click', () => {
        confirmButton.addEventListener('click', () => {
          confirmedBeforePaint = !painted
        }, { once: true })
      }, { once: true })
    })

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    animationCallbacks.forEach((callback) => callback(0))
    painted = true

    await vi.waitFor(() => expect(button.textContent).toBe('✅'))
    expect(confirmedBeforePaint).toBe(true)
  })

  it('別ユーザー向けのメニュー項目は操作しない', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const articleA = buildTweetArticle('userA')
    document.body.appendChild(articleA)
    const buttonA = insertBlockButton(articleA)!

    const caretButton = articleA.querySelector('[data-testid="caret"]') as HTMLButtonElement
    caretButton.addEventListener('click', () => {
      // userA向けのcaretを開いたのに、間違って別ユーザー向けの項目しか無い状況を再現する
      appendGlobalMenuAndConfirm('userB')
    })

    const wrongMenuClickSpy = vi.fn()
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.getAttribute?.('role') === 'menuitem') {
        wrongMenuClickSpy(target.textContent)
      }
    })

    buttonA.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(buttonA.disabled).toBe(false))

    expect(wrongMenuClickSpy).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'showNotification', type: 'error' })
    )
  })

  it('caretボタンが見つからない場合は再操作可能に戻し通知する', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser', false)
    document.body.appendChild(article)
    const button = insertBlockButton(article)!

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(button.disabled).toBe(false)
    })

    expect(button.classList.contains('block-button--done')).toBe(false)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'showNotification', type: 'error' })
    )
  })

  it('block項目が見つからない場合は再操作可能に戻し通知する', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)
    const button = insertBlockButton(article)!

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(button.disabled).toBe(false))

    expect(button.classList.contains('block-button--done')).toBe(false)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'showNotification', type: 'error' })
    )
  })

  it('自分自身の投稿では操作しない', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const profileLink = document.createElement('a')
    profileLink.setAttribute('data-testid', 'AppTabBar_Profile_Link')
    profileLink.setAttribute('href', '/testuser')
    document.body.appendChild(profileLink)

    const article = buildTweetArticle('testuser')
    document.body.appendChild(article)
    const button = insertBlockButton(article)!

    const caretButton = article.querySelector('[data-testid="caret"]') as HTMLButtonElement
    const caretClickSpy = vi.fn()
    caretButton.addEventListener('click', caretClickSpy)

    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalled()
    })

    expect(caretClickSpy).not.toHaveBeenCalled()
    expect(button.disabled).toBe(false)
  })

  it('クリックのデフォルト動作と伝播を止め、ポストへ遷移させない', () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('chrome', { runtime: { sendMessage } })

    const article = buildTweetArticle('testuser', false)
    document.body.appendChild(article)
    const button = insertBlockButton(article)!

    const parentClickSpy = vi.fn()
    article.addEventListener('click', parentClickSpy)

    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    button.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(parentClickSpy).not.toHaveBeenCalled()
  })
})
