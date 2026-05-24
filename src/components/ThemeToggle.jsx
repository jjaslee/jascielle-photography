import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <button
      type="button"
      aria-label={label}
      onClick={toggleTheme}
      className="relative w-9 h-5 flex items-center justify-center shrink-0"
    >
      <span
        className="absolute w-4 h-4 rounded-full border chrome-outline chrome-solid-bg transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform: theme === 'dark' ? 'translateX(-6px)' : 'translateX(6px)',
          zIndex: theme === 'dark' ? 0 : 1,
        }}
      />
      <span
        className="absolute w-4 h-4 rounded-full chrome-invert-bg transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          transform: theme === 'dark' ? 'translateX(6px)' : 'translateX(-6px)',
          zIndex: theme === 'dark' ? 1 : 0,
        }}
      />
    </button>
  )
}
