/**
 * JCL mark: transparent background; inverts in dark mode.
 */
export default function Logo({ className = 'h-10 md:h-12 w-auto', ...props }) {
  return (
    <img
      src="/logo.png"
      alt="Jascielle Photography"
      className={`object-contain object-left dark:invert ${className}`}
      {...props}
    />
  )
}
