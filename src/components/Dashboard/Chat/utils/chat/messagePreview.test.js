import { describe, it, expect } from 'vitest'
import { getMessagePreview } from './messagePreview'

describe('getMessagePreview', () => {
  it('returns the text for a plain text message', () => {
    expect(getMessagePreview({ text: 'hello' })).toBe('hello')
  })

  it('returns "📷 Photo" for an uncaptioned image', () => {
    expect(getMessagePreview({ image: 'https://x/y.png' })).toBe('📷 Photo')
    expect(getMessagePreview({ image: 'data:image/png;base64,AAA', text: '' })).toBe('📷 Photo')
  })

  it('returns "📷 {caption}" for a captioned image', () => {
    expect(getMessagePreview({ image: 'https://x/y.png', text: 'beach day' })).toBe('📷 beach day')
  })

  it('marks an uncaptioned GIF distinctly', () => {
    expect(getMessagePreview({ image: 'https://x/cat.gif' })).toBe('🎞️ GIF')
    expect(getMessagePreview({ image: 'data:image/gif;base64,AAA' })).toBe('🎞️ GIF')
  })

  it('prefers the caption even for a GIF', () => {
    expect(getMessagePreview({ image: 'https://x/cat.gif', text: 'lol' })).toBe('📷 lol')
  })

  it('trims caption whitespace and falls back to Photo when blank', () => {
    expect(getMessagePreview({ image: 'x.png', text: '   ' })).toBe('📷 Photo')
    expect(getMessagePreview({ text: '  hi  ' })).toBe('hi')
  })

  it('handles empty/missing input', () => {
    expect(getMessagePreview()).toBe('')
    expect(getMessagePreview({})).toBe('')
    expect(getMessagePreview({ text: null, image: null })).toBe('')
  })
})
