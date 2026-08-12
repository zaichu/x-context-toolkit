import { afterEach, describe, expect, it } from 'vitest'
import {
  RESERVED_PROFILE_PATHS,
  extractUsernameFromProfileUrl,
  findBlockMenuItem,
  findBlockConfirmButton,
} from './xAccountActions'

describe('extractUsernameFromProfileUrl', () => {
  it('プロフィールURLからユーザー名を抽出する', () => {
    expect(extractUsernameFromProfileUrl('https://x.com/testuser')).toBe('testuser')
    expect(extractUsernameFromProfileUrl('https://twitter.com/testuser')).toBe('testuser')
  })

  it('ツイート詳細やリプライなどプロフィール系サブパスも許可する', () => {
    expect(extractUsernameFromProfileUrl('https://x.com/testuser/status/12345')).toBe('testuser')
    expect(extractUsernameFromProfileUrl('https://x.com/testuser/with_replies')).toBe('testuser')
  })

  it('クエリ文字列があってもユーザー名を抽出する', () => {
    expect(extractUsernameFromProfileUrl('https://x.com/testuser?ref=abc')).toBe('testuser')
  })

  it('予約パスは拒否する', () => {
    for (const path of RESERVED_PROFILE_PATHS) {
      expect(extractUsernameFromProfileUrl(`https://x.com/${path}`)).toBeNull()
    }
  })

  it('不明なサブパスを含む曖昧なリンクは拒否する', () => {
    expect(extractUsernameFromProfileUrl('https://x.com/testuser/unknown/more')).toBeNull()
  })

  it('Xドメイン以外は拒否する', () => {
    expect(extractUsernameFromProfileUrl('https://evil.com/testuser')).toBeNull()
  })

  it('不正なURLは拒否する', () => {
    expect(extractUsernameFromProfileUrl('javascript:alert(1)')).toBeNull()
    expect(extractUsernameFromProfileUrl('not a url')).toBeNull()
  })

  it('ユーザー名が存在しないパスは拒否する', () => {
    expect(extractUsernameFromProfileUrl('https://x.com/')).toBeNull()
  })

  it('不正な文字を含むユーザー名は拒否する', () => {
    expect(extractUsernameFromProfileUrl('https://x.com/invalid-user!')).toBeNull()
  })
})

describe('findBlockMenuItem', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('対象ユーザーのブロック項目を選ぶ', () => {
    document.body.innerHTML = `
      <div role="menuitem">Block @otheruser</div>
      <div role="menuitem">Block @testuser</div>
    `
    const item = findBlockMenuItem('testuser')
    expect(item?.textContent).toBe('Block @testuser')
  })

  it('X公式のdata-testid付きブロック項目を直接選ぶ', () => {
    document.body.innerHTML = '<div role="menuitem" data-testid="block">ブロック</div>'
    expect(findBlockMenuItem('testuser')?.dataset.testid).toBe('block')
  })

  it('日本語表記の項目も対象にする', () => {
    document.body.innerHTML = `
      <div role="menuitem">@testuser をブロック</div>
    `
    expect(findBlockMenuItem('testuser')?.textContent).toBe('@testuser をブロック')
  })

  it('ブロック解除の項目は誤って選ばない', () => {
    document.body.innerHTML = `
      <div role="menuitem">@testuser のブロックを解除</div>
    `
    expect(findBlockMenuItem('testuser')).toBeNull()
  })

  it('別ユーザーの項目は選ばない', () => {
    document.body.innerHTML = `
      <div role="menuitem">Block @otheruser</div>
    `
    expect(findBlockMenuItem('testuser')).toBeNull()
  })
})

describe('findBlockConfirmButton', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('data-testidで確認ボタンを見つける', () => {
    document.body.innerHTML = '<button data-testid="confirmationSheetConfirm">Block</button>'
    expect(findBlockConfirmButton()).not.toBeNull()
  })

  it('testidがない場合はダイアログ内のブロックボタンをテキストで見つける', () => {
    document.body.innerHTML = `
      <div role="alertdialog">
        <button>Cancel</button>
        <button>Block</button>
      </div>
    `
    expect(findBlockConfirmButton()?.textContent).toBe('Block')
  })

  it('ラベルのないXの#layers配下でも提示された確定ボタンを見つける', () => {
    document.body.innerHTML = `
      <div id="layers">
        <div></div>
        <div><div><div><div><div><div>
          <div></div>
          <div>
            <div></div>
            <div>
              <div></div>
              <div><button id="expected-confirm"></button><button>cancel</button></div>
            </div>
          </div>
        </div></div></div></div></div></div>
      </div>
    `

    expect(findBlockConfirmButton()?.id).toBe('expected-confirm')
  })

  it('ダイアログがない場合はnullを返す', () => {
    document.body.innerHTML = ''
    expect(findBlockConfirmButton()).toBeNull()
  })
})
