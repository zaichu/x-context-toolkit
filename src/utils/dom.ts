// DOM操作ユーティリティ関数
import { SelectedTextInfo, TwitterElement } from '../types'

// 選択されたテキストの情報を取得
export const getSelectedTextInfo = (): SelectedTextInfo | null => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }
  
  const range = selection.getRangeAt(0)
  const text = selection.toString().trim()
  
  if (!text) {
    return null
  }
  
  const rect = range.getBoundingClientRect()
  const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentElement
    : range.commonAncestorContainer as HTMLElement
  
  return {
    text,
    element: element || document.body,
    position: {
      x: rect.left + rect.width / 2,
      y: rect.top
    }
  }
}

// Twitterのツイート要素を取得
export const getTweetElements = (): TwitterElement[] => {
  const tweetSelectors = [
    '[data-testid="tweet"]',
    '[data-testid="tweetText"]',
    'article[data-testid="tweet"]'
  ]
  
  const elements: TwitterElement[] = []
  
  tweetSelectors.forEach(selector => {
    const tweets = document.querySelectorAll(selector)
    tweets.forEach(tweet => {
      const textElement = tweet.querySelector('[data-testid="tweetText"]')
      const authorElement = tweet.querySelector('[data-testid="User-Names"]')
      
      if (textElement && tweet instanceof HTMLElement) {
        elements.push({
          tweet,
          text: textElement.textContent || '',
          author: authorElement?.textContent || ''
        })
      }
    })
  })
  
  return elements
}

// 要素がミュートキーワードを含むかチェック
export const containsMuteKeyword = (text: string, keywords: string[]): boolean => {
  const lowerText = text.toLowerCase()
  return keywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  )
}

// ツイートを非表示にする
export const hideTweet = (element: HTMLElement): void => {
  element.style.opacity = '0.3'
  element.style.filter = 'blur(2px)'
  element.setAttribute('data-muted', 'true')
  
  // ミュート理由を表示するオーバーレイを追加
  const overlay = document.createElement('div')
  overlay.className = 'x-context-toolkit-overlay'
  overlay.innerHTML = `
    <div class="muted-message">
      <span>ミュートキーワードにより非表示</span>
      <button class="show-tweet-btn" onclick="this.parentElement.parentElement.style.display='none'; this.parentElement.parentElement.previousElementSibling.style.opacity='1'; this.parentElement.parentElement.previousElementSibling.style.filter='none';">
        表示する
      </button>
    </div>
  `
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `
  
  element.style.position = 'relative'
  element.appendChild(overlay)
}

// ツイートを表示する
export const showTweet = (element: HTMLElement): void => {
  element.style.opacity = '1'
  element.style.filter = 'none'
  element.removeAttribute('data-muted')
  
  const overlay = element.querySelector('.x-context-toolkit-overlay')
  if (overlay) {
    overlay.remove()
  }
}

// ページのURLがX(Twitter)かチェック
export const isTwitterPage = (): boolean => {
  return window.location.hostname === 'twitter.com' || 
         window.location.hostname === 'x.com'
}

// 要素が表示されているかチェック
export const isElementVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}