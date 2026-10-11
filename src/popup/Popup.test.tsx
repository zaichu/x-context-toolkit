import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Popup } from './Popup'

describe('Popup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('manifestのバージョンを表示する', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({ version: '1.0.2' }),
      },
    })

    const html = renderToStaticMarkup(<Popup />)

    expect(html).toContain('v1.0.2')
  })
})
