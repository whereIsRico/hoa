import { useEffect, useState } from 'react'
import { Sun, Moon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'

function getInitialTheme() {
  const stored = localStorage.getItem('passage.theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('passage.theme', theme)
  }, [theme])

  return (
    <Button
      variant="ghost"
      size="sm"
      className="px-2"
      aria-label="Toggle theme"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </Button>
  )
}
