import ScrollReveal from './ScrollReveal'

export default function PageHeader({ title, subtitle, subtitleOneLine = false, children }) {
  return (
    <section className="section-pad pt-32 md:pt-40 pb-16 md:pb-24">
      <ScrollReveal>
        <p className="text-muted text-xs tracking-[0.25em] uppercase mb-4">Jascielle Photography</p>
        <h1 className="heading-serif text-4xl md:text-6xl lg:text-7xl">{title}</h1>
        {subtitle && (
          <p
            className={`text-muted text-base md:text-lg mt-6 leading-relaxed ${
              subtitleOneLine
                ? 'max-w-none md:whitespace-nowrap'
                : 'max-w-xl'
            }`}
          >
            {subtitle}
          </p>
        )}
        {children}
      </ScrollReveal>
    </section>
  )
}
