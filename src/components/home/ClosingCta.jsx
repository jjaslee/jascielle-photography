import { Link } from 'react-router-dom'

/**
 * Closing beat after the spatial field — black field, quiet type, one CTA.
 */
export default function ClosingCta() {
  return (
    <section
      className="relative z-10 bg-black text-white"
      aria-labelledby="closing-cta-heading"
    >
      <div className="mx-auto flex min-h-[72svh] max-w-[42rem] flex-col justify-center px-[clamp(1.25rem,6vw,3.5rem)] py-24 md:min-h-[80svh] md:py-32">
        <h2
          id="closing-cta-heading"
          className="font-serif text-[1.65rem] sm:text-3xl md:text-[2.35rem] font-semibold leading-[1.2] tracking-tight text-white"
        >
          Attention is selective.
          <br />
          Let&apos;s capture what&apos;s worth noticing.
        </h2>
        <Link
          to="/book"
          className="mt-10 inline-flex w-fit items-center gap-2 font-sans text-sm font-medium tracking-wide text-white/90 hover:text-white transition-colors"
        >
          Begin an inquiry
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
