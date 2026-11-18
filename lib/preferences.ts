'use client'

import { createLocalStore } from './local-store'

export type ThemeAccent = 'crimson' | 'classic'
export type TitleLang = 'en' | 'ro'

const themeStore = createLocalStore<ThemeAccent>('anideck:theme:v1', 'crimson', (v) =>
  v === 'classic' ? 'classic' : 'crimson',
)
const titleLangStore = createLocalStore<TitleLang>('anideck:title-lang:v1', 'en', (v) =>
  v === 'ro' ? 'ro' : 'en',
)

export const useThemeAccent = themeStore.useValue
export function setThemeAccent(accent: ThemeAccent) {
  themeStore.set(accent)
  if (typeof document !== 'undefined') {
    if (accent === 'classic') {
      document.documentElement.setAttribute('data-theme', 'classic')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }
}

export const useTitleLang = titleLangStore.useValue
export function setTitleLang(lang: TitleLang) {
  titleLangStore.set(lang)
}

export function displayTitle(title: { romaji: string | null; english: string | null }, lang: TitleLang = 'en') {
  if (lang === 'ro') {
    return title.romaji || title.english || 'Untitled'
  }
  return title.english || title.romaji || 'Untitled'
}
