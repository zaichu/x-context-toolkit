// Xのアカウントブロック機能で使うDOM操作ユーティリティ

// ユーザー名として扱わない予約パス
export const RESERVED_PROFILE_PATHS = [
  'home',
  'explore',
  'settings',
  'search',
  'notifications',
  'messages',
  'i',
  'compose',
  'login',
  'logout',
  'tos',
  'privacy',
  'about',
  'download',
  'account',
  'hashtag',
  'intent',
] as const

// プロフィールリンクとして許可するサブパス（これ以外の追加パスは曖昧な対象として拒否する）
const ALLOWED_PROFILE_SUBPATHS = [
  'status',
  'with_replies',
  'media',
  'likes',
  'following',
  'followers',
  'lists',
  'highlights',
]

const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/
const ALLOWED_HOSTS = ['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com']

// プロフィールURLから安全にユーザー名を抽出する。予約パスや不正・曖昧なURLはnullを返す
export const extractUsernameFromProfileUrl = (url: string): string | null => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    return null
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0)
  const [username, subpath] = segments

  if (!username || !USERNAME_PATTERN.test(username)) {
    return null
  }

  if ((RESERVED_PROFILE_PATHS as readonly string[]).includes(username.toLowerCase())) {
    return null
  }

  // サブパスがある場合は既知のプロフィール系パスのみ許可し、それ以外は曖昧な対象として拒否する
  if (subpath !== undefined && !ALLOWED_PROFILE_SUBPATHS.includes(subpath)) {
    return null
  }

  return username
}

// ブロック解除の項目を誤って選ばないための判定
const isUndoActionLabel = (text: string): boolean => /解除|unblock/i.test(text)

const BLOCK_KEYWORDS = ['block', 'ブロック']

// 開いているメニュー内から対象ユーザーのブロック項目を検索する
export const findBlockMenuItem = (username: string): HTMLElement | null => {
  const targetMention = `@${username}`.toLowerCase()
  const items = document.querySelectorAll<HTMLElement>('[role="menuitem"]')

  for (const item of items) {
    const text = item.textContent ?? ''
    const normalized = text.toLowerCase()

    if (isUndoActionLabel(text)) {
      continue
    }

    if (!BLOCK_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      continue
    }

    if (!normalized.includes(targetMention)) {
      continue
    }

    return item
  }

  return null
}

// ブロック確認ダイアログの確定ボタンを検索する
export const findBlockConfirmButton = (): HTMLButtonElement | null => {
  const testIdButton = document.querySelector<HTMLButtonElement>(
    '[data-testid="confirmationSheetConfirm"]'
  )
  if (testIdButton && !testIdButton.disabled) {
    return testIdButton
  }

  const dialog = document.querySelector('[role="alertdialog"], [role="dialog"]')
  if (!dialog) {
    return null
  }

  const buttons = dialog.querySelectorAll<HTMLButtonElement>('button')
  for (const button of buttons) {
    const text = (button.textContent ?? '').toLowerCase()
    if (isUndoActionLabel(text)) {
      continue
    }
    if ((text.includes('block') || text.includes('ブロック')) && !button.disabled) {
      return button
    }
  }

  return null
}
