import { createContext, useContext } from 'react'

export const PlatformThemeContext = createContext({
  platformMode: 'CYBER_SECURITY_CLUB',
  setPlatformMode: () => {},
  themeMode: 'light',
  setThemeMode: () => {},
  resolvedTheme: 'light',
  clubSettings: null,
  setClubSettings: () => {},
  reelsEnabled: true,
  subEnabled: false,
})

export function usePlatformTheme() {
  return useContext(PlatformThemeContext)
}
