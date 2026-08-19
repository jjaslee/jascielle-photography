const CONTACT_EMAIL = 'jascielle.photos@gmail.com'
const FORMSPREE_PRIVACY_URL = 'https://formspree.io/legal/privacy-policy'

const sectionTitleClass =
  'font-mono font-bold text-[11px] md:text-xs tracking-[0.1em] uppercase text-ink mb-4'
const bodyClass = 'font-mono font-light text-[13px] md:text-[14px] leading-[1.75] text-ink/80'
const listClass = `${bodyClass} list-disc pl-5 space-y-2`
const linkClass = 'text-ink underline underline-offset-2 hover:text-salience-warm transition-colors'

function Section({ title, children }) {
  return (
    <section>
      <h2 className={sectionTitleClass}>{title}</h2>
      {children}
    </section>
  )
}

export default function Privacy() {
  return (
    <article className="section-pad pt-32 md:pt-40 pb-20 md:pb-28 text-ink">
      <div className="mx-auto w-full max-w-[760px]">
        <header className="text-center mb-12 md:mb-16">
          <h1 className="font-display font-normal leading-[1.1] text-[clamp(3.5rem,6vw,5.5rem)]">
            Privacy
          </h1>
          <p className="mt-6 font-mono font-light text-[11px] md:text-xs tracking-nav uppercase text-muted">
            Effective date: August 18, 2026
          </p>
        </header>

        <div className="space-y-10 md:space-y-12">
          <Section title="Introduction">
            <p className={bodyClass}>
              Jascielle Photography respects your privacy. This page explains what information
              may be collected when you use this website, why it is collected, and how it may be
              used.
            </p>
          </Section>

          <Section title="Information You Provide">
            <p className={`${bodyClass} mb-4`}>
              When you submit an inquiry through the booking form, you may provide information
              such as:
            </p>
            <ul className={listClass}>
              <li>your name</li>
              <li>email address</li>
              <li>session type</li>
              <li>preferred date</li>
              <li>information included in your message</li>
            </ul>
            <p className={`${bodyClass} mt-4`}>
              This information is used to respond to your inquiry, communicate about photography
              services, and arrange potential bookings.
            </p>
          </Section>

          <Section title="Form Submissions and Third-Party Services">
            <p className={bodyClass}>
              The booking form is processed through Formspree. Information submitted through the
              form is therefore processed by Formspree in order to receive and deliver your
              inquiry.
            </p>
            <p className={`${bodyClass} mt-4`}>
              Formspree may also process certain technical information associated with a
              submission in accordance with its own privacy practices.
            </p>
            <p className={`${bodyClass} mt-4`}>
              See{' '}
              <a
                href={FORMSPREE_PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Formspree&apos;s Privacy Policy
              </a>{' '}
              for more information.
            </p>
          </Section>

          <Section title="How Information Is Used">
            <p className={`${bodyClass} mb-4`}>
              Information submitted through this website may be used to:
            </p>
            <ul className={listClass}>
              <li>respond to photography inquiries</li>
              <li>communicate about sessions or services</li>
              <li>coordinate potential bookings</li>
            </ul>
            <p className={`${bodyClass} mt-4`}>
              Personal information submitted through the booking form is not sold by Jascielle
              Photography.
            </p>
          </Section>

          <Section title="Data Retention">
            <p className={bodyClass}>
              Inquiry information may be retained for as long as reasonably necessary to respond
              to an inquiry, coordinate services, maintain relevant business records, or continue
              correspondence.
            </p>
          </Section>

          <Section title="Online Tracking">
            <p className={bodyClass}>
              Jascielle Photography does not currently use advertising trackers or website
              analytics to track visitors across websites.
            </p>
            <p className={`${bodyClass} mt-4`}>
              The booking service used by this website may process technical information in
              accordance with its own privacy practices.
            </p>
          </Section>

          <Section title="External Links">
            <p className={bodyClass}>
              This website may contain links to external websites or services, such as Instagram.
              Jascielle Photography is not responsible for the privacy practices of external
              websites.
            </p>
          </Section>

          <Section title="Your Choices">
            <p className={bodyClass}>
              You may choose not to submit personal information through the booking form.
            </p>
            <p className={`${bodyClass} mt-4`}>
              If you have previously contacted Jascielle Photography and would like to ask about,
              correct, or request deletion of information you submitted, contact{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p className={bodyClass}>
              This Privacy Policy may be updated from time to time. Material changes will be
              posted on this page, and the effective date above will be updated accordingly.
            </p>
          </Section>

          <Section title="Contact">
            <p className={bodyClass}>
              For questions about this Privacy Policy or information submitted through this
              website, contact:
            </p>
            <p className={`${bodyClass} mt-4`}>
              <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>
        </div>
      </div>
    </article>
  )
}
