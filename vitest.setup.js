import '@testing-library/jest-dom/vitest'

import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// Basic browser API shims for JSDOM
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
}
if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
}

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

if (!navigator.clipboard) {
  navigator.clipboard = {
    writeText: vi.fn(async () => undefined),
  }
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Keep i18n simple for unit tests: return keys as strings.
vi.mock('react-i18next', () => {
  return {
    useTranslation: () => ({
      t: (key, options) => {
        if (options?.returnObjects) {
          if (key === 'roadmap.milestones') {
            return [
              {
                quarter: 'Q1',
                title: 'Milestone 1',
                description: 'Test milestone',
                items: [{ text: 'Item 1', status: 'done' }],
              },
              {
                quarter: 'Q2',
                title: 'Milestone 2',
                description: 'Test milestone',
                items: [{ text: 'Item 2', status: 'done' }],
              },
              {
                quarter: 'Q3',
                title: 'Milestone 3',
                description: 'Test milestone',
                items: [{ text: 'Item 3', status: 'done' }],
              },
              {
                quarter: 'Q4',
                title: 'Milestone 4',
                description: 'Test milestone',
                items: [{ text: 'Item 4', status: 'inprogress' }],
              },
              {
                quarter: 'Q5',
                title: 'Milestone 5',
                description: 'Test milestone',
                items: [{ text: 'Item 5', status: 'planned' }],
              },
              {
                quarter: 'Q6',
                title: 'Milestone 6',
                description: 'Test milestone',
                items: [{ text: 'Item 6', status: 'planned' }],
              },
              {
                quarter: 'Q7',
                title: 'Milestone 7',
                description: 'Test milestone',
                items: [{ text: 'Item 7', status: 'planned' }],
              },
            ]
          }

          return []
        }

        return key
      },
      i18n: {
        changeLanguage: async () => {},
      },
    }),
    Trans: ({ i18nKey }) => i18nKey,
    I18nextProvider: ({ children }) => children,
    initReactI18next: {
      type: '3rdParty',
      init: () => {},
    },
  }
})

// Avoid animation libraries doing real work in tests.
vi.mock('gsap', () => {
  const timelineApi = {
    to: vi.fn(() => timelineApi),
    from: vi.fn(() => timelineApi),
    fromTo: vi.fn(() => timelineApi),
    set: vi.fn(() => timelineApi),
    kill: vi.fn(),
  }

  return {
    default: {
      to: vi.fn(),
      from: vi.fn(),
      fromTo: vi.fn(),
      set: vi.fn(),
      timeline: vi.fn(() => timelineApi),
    },
  }
})
