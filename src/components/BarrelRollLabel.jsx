export default function BarrelRollLabel({ text }) {
  return (
    <span className="hero-scroll-link__label" aria-hidden="true">
      {Array.from(text).map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={`hero-scroll-link__char${ch === ' ' ? ' is-space' : ''}`}
          style={{ '--i': i }}
        >
          <span className="hero-scroll-link__char-roll">
            <span className="hero-scroll-link__char-glyph">
              {ch === ' ' ? '\u00a0' : ch}
            </span>
            <span className="hero-scroll-link__char-glyph" aria-hidden="true">
              {ch === ' ' ? '\u00a0' : ch}
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}
