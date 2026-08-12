// Xの各ポストに常設する🚫ブロックボタンの機能
// 現在ページ内のX公式DOMだけを操作し、別タブ・別ウィンドウは一切開かない。
import { extractUsernameFromProfileUrl, findBlockMenuItem, findBlockConfirmButton } from '../utils/xAccountActions'

const TWEET_SELECTOR = 'article[data-testid="tweet"]'
const BLOCK_BUTTON_CLASS = 'block-button'
const HIDE_BLOCK_SHEET_STYLE_ID = 'x-context-toolkit-hide-block-sheet'

// 投稿者を特定するために優先的に確認するプロフィールリンクのセレクター
const AUTHOR_LINK_SELECTORS = [
  '[data-testid="Tweet-User-Avatar"] a[href]',
  '[data-testid="User-Name"] a[href]',
]

const toAbsoluteProfileUrl = (href: string): string => new URL(href, 'https://x.com').toString()

// article内のプロフィールリンクから投稿者usernameを抽出する（引用ポストなど別articleのリンクは除外）
export const extractTweetAuthorUsername = (article: HTMLElement): string | null => {
  for (const selector of AUTHOR_LINK_SELECTORS) {
    const links = article.querySelectorAll<HTMLAnchorElement>(selector)
    for (const link of links) {
      if (link.closest('article') !== article) {
        continue
      }

      const href = link.getAttribute('href')
      if (!href) {
        continue
      }

      const username = extractUsernameFromProfileUrl(toAbsoluteProfileUrl(href))
      if (username) {
        return username
      }
    }
  }

  return null
}

// ログイン中の自分自身のusernameを取得する（自分自身への誤操作を防ぐため）
export const getCurrentUsername = (): string | null => {
  const profileLink = document.querySelector<HTMLAnchorElement>(
    'a[data-testid="AppTabBar_Profile_Link"]'
  )
  const href = profileLink?.getAttribute('href')
  if (!href) {
    return null
  }

  return extractUsernameFromProfileUrl(toAbsoluteProfileUrl(href))
}

// 対象articleに属するcaret（その他）メニューボタンを検索する
const findTweetCaretButton = (article: HTMLElement): HTMLButtonElement | null => {
  const button = article.querySelector<HTMLButtonElement>('[data-testid="caret"]')
  if (button && button.closest('article') === article && !button.disabled) {
    return button
  }
  return null
}

// 要素が見つかるまでポーリングする
const waitFor = <T>(
  finder: () => T | null,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<T | null> => {
  return new Promise((resolve) => {
    const start = Date.now()

    const check = () => {
      const result = finder()
      if (result) {
        resolve(result)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null)
        return
      }
      setTimeout(check, intervalMs)
    }

    check()
  })
}

// 確認ダイアログが閉じるまで待つ（Xの操作完了の目安にする）
const waitForConfirmDialogToClose = (timeoutMs = 5000, intervalMs = 100): Promise<boolean> => {
  return new Promise((resolve) => {
    const start = Date.now()

    const check = () => {
      if (!findBlockConfirmButton()) {
        resolve(true)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false)
        return
      }
      setTimeout(check, intervalMs)
    }

    check()
  })
}

// Xの確認シートをユーザーに表示せず、DOM操作だけで確定する
const hideBlockConfirmationSheet = (): (() => void) => {
  const style = document.createElement('style')
  style.id = HIDE_BLOCK_SHEET_STYLE_ID
  style.textContent = `
    #layers > div:has([data-testid="confirmationSheetConfirm"]) {
      visibility: hidden !important;
    }
  `
  document.head.appendChild(style)
  return () => style.remove()
}

// このポストの投稿者をX公式DOM経由でブロックする（別タブ・別ウィンドウは開かない）
const blockTweetAuthor = async (article: HTMLElement, username: string): Promise<boolean> => {
  const caretButton = findTweetCaretButton(article)
  if (!caretButton) {
    return false
  }
  const restoreConfirmationSheet = hideBlockConfirmationSheet()
  try {
    caretButton.click()

    const menuItem = await waitFor(() => findBlockMenuItem(username))
    if (!menuItem) {
      return false
    }
    menuItem.click()

    const confirmButton = await waitFor(findBlockConfirmButton)
    if (!confirmButton) {
      return false
    }
    confirmButton.click()

    return waitForConfirmDialogToClose()
  } finally {
    restoreConfirmationSheet()
  }
}

type BlockButtonState = 'idle' | 'processing' | 'done'

// Xの既存アクション列を崩さない控えめなベーススタイル
const applyBaseButtonStyle = (button: HTMLButtonElement): void => {
  button.style.backgroundColor = 'transparent'
  button.style.color = 'white'
  button.style.borderRadius = '5px'
  button.style.borderWidth = '0'
  button.style.borderStyle = 'none'
  button.style.paddingTop = '0px'
  button.style.paddingBottom = '0px'
  button.style.paddingLeft = '5px'
  button.style.paddingRight = '5px'
  button.style.marginTop = '0px'
  button.style.marginBottom = '0px'
  button.style.marginLeft = '3px'
  button.style.marginRight = '3px'
  button.style.cursor = 'pointer'
}

// ブロックボタンの見た目を状態ごとに更新する（disabled/processing/doneを視覚的に区別する）
const setButtonState = (button: HTMLButtonElement, state: BlockButtonState): void => {
  button.disabled = state !== 'idle'
  button.classList.toggle('block-button--processing', state === 'processing')
  button.classList.toggle('block-button--done', state === 'done')
  button.textContent = state === 'done' ? '✅' : '🚫'
  button.style.opacity = state === 'idle' ? '1' : '0.6'
  button.style.cursor = state === 'idle' ? 'pointer' : 'default'
}

// 失敗を拡張機能の通知として表示する
const notifyFailure = (message: string): void => {
  void chrome.runtime.sendMessage({ action: 'showNotification', message, type: 'error' })
}

// ブロックボタンのクリックハンドラ
const handleBlockButtonClick = async (
  article: HTMLElement,
  button: HTMLButtonElement,
  event: MouseEvent
): Promise<void> => {
  event.preventDefault()
  event.stopPropagation()

  if (button.disabled) {
    return
  }

  const username = extractTweetAuthorUsername(article)
  if (!username) {
    notifyFailure('投稿者を特定できませんでした')
    return
  }

  if (getCurrentUsername()?.toLowerCase() === username.toLowerCase()) {
    notifyFailure('自分自身はブロックできません')
    return
  }

  setButtonState(button, 'processing')

  try {
    const success = await blockTweetAuthor(article, username)
    if (success) {
      setButtonState(button, 'done')
    } else {
      setButtonState(button, 'idle')
      notifyFailure(`@${username} のブロックに失敗しました`)
    }
  } catch (error) {
    console.error('ブロックボタン処理エラー:', error)
    setButtonState(button, 'idle')
    notifyFailure(`@${username} のブロックに失敗しました`)
  }
}

// ブロックボタンを生成する
const createBlockButton = (): HTMLButtonElement => {
  const button = document.createElement('button')
  button.className = BLOCK_BUTTON_CLASS
  button.setAttribute('aria-label', 'ブロック')
  button.setAttribute('title', 'このユーザーをブロック')
  button.type = 'button'
  button.textContent = '🚫'
  applyBaseButtonStyle(button)
  button.style.opacity = '1'
  return button
}

// ボタンを挿入するアクション列（返信・リツイートなどのボタン群）を検索する
const findActionGroup = (article: HTMLElement): HTMLElement | null => {
  const replyButton = article.querySelector('[data-testid="reply"]')
  const group = replyButton?.closest<HTMLElement>('[role="group"]')
  if (group && group.closest('article') === article) {
    return group
  }
  return null
}

// 投稿ヘッダーのGrokボタン直親を配置枠として取得する
const findGrokAction = (article: HTMLElement): HTMLElement | null => {
  const grokButton = article.querySelector([
    '[data-testid="grok-action-button"]',
    '[data-testid="Grok"]',
    'button[aria-label^="Grok"]',
    'button[aria-label*=" Grok"]',
  ].join(', '))

  if (!grokButton || grokButton.closest('article') !== article) {
    return null
  }

  const action = grokButton.parentElement
  return action && action !== article && action.parentElement ? action : null
}

// articleに既にブロックボタンが挿入済みか判定する
export const hasBlockButton = (article: HTMLElement): boolean => {
  return article.querySelector(`.${BLOCK_BUTTON_CLASS}`) !== null
}

// articleにブロックボタンを挿入する（二重挿入は防止する）
export const insertBlockButton = (article: HTMLElement): HTMLButtonElement | null => {
  if (hasBlockButton(article)) {
    return null
  }

  const grokAction = findGrokAction(article)
  const insertionContainer = grokAction?.parentElement ?? findActionGroup(article)
  if (!insertionContainer) {
    return null
  }

  const button = createBlockButton()
  button.addEventListener('click', (event) => {
    void handleBlockButtonClick(article, button, event)
  })
  if (grokAction && grokAction.tagName !== 'BUTTON') {
    const blockAction = grokAction.cloneNode(false) as HTMLElement
    blockAction.removeAttribute('id')
    blockAction.removeAttribute('data-testid')
    blockAction.removeAttribute('aria-label')
    blockAction.removeAttribute('title')
    blockAction.removeAttribute('role')
    blockAction.appendChild(button)
    insertionContainer.insertBefore(blockAction, grokAction)
  } else {
    insertionContainer.insertBefore(button, grokAction)
  }

  return button
}

// article要素を処理する（ブロックボタン挿入のエントリーポイント）
const processArticle = (article: Element): void => {
  if (article instanceof HTMLElement && article.matches(TWEET_SELECTOR)) {
    insertBlockButton(article)
  }
}

// 追加ノードから対象articleを抽出して処理する
const processAddedNode = (node: Node): void => {
  if (!(node instanceof HTMLElement)) {
    return
  }
  processArticle(node)
  node.querySelectorAll(TWEET_SELECTOR).forEach(processArticle)
}

// React SPAで動的追加されるポストへMutationObserverで追従し、🚫ボタンを挿入する
export const observeTweetArticles = (root: HTMLElement = document.body): MutationObserver => {
  root.querySelectorAll(TWEET_SELECTOR).forEach(processArticle)

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(processAddedNode)
    }
  })

  observer.observe(root, { childList: true, subtree: true })

  return observer
}
