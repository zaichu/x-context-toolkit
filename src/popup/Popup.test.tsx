import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Popup } from './Popup'

describe('Popup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('読み込み中の拡張バージョンと識別文言を表示する', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({ version: '1.0.1' }),
      },
    })

    const html = renderToStaticMarkup(<Popup />)

    expect(html).toContain('v1.0.1')
    expect(html).toContain('ワンクリックブロック対応版')
  })
})
