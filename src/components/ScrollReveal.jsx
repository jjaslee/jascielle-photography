import { useScrollReveal } from '../hooks/useScrollReveal'

export default function ScrollReveal({ children, className = '', delay = 0 }) {
  const { ref, visible } = useScrollReveal()

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-500 ease-elegant ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}
