import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SalienceHandoffProvider } from '../context/SalienceHandoffContext'
import { scrollToWork, useLenisRef } from '../context/LenisContext'
import Hero from '../components/home/Hero'
import SalienceSection from '../components/home/SalienceSection'
import WorkChapter from '../components/home/WorkChapter'
import SpatialFieldChapter from '../components/home/SpatialFieldChapter'

export default function Home() {
  const { hash } = useLocation()
  const lenisRef = useLenisRef()

  useEffect(() => {
    if (!hash) return
    const id = hash.replace(/^#/, '')
    if (id === 'work') {
      // Wait a frame so WorkChapter (and offset data) is mounted after route change.
      requestAnimationFrame(() => {
        scrollToWork(lenisRef?.current, { immediate: true })
      })
      return
    }
    const el = document.getElementById(id)
    if (el) el.scrollIntoView()
  }, [hash, lenisRef])

  return (
    <SalienceHandoffProvider>
      <Hero />
      <SalienceSection />
      <WorkChapter />
      <SpatialFieldChapter />
    </SalienceHandoffProvider>
  )
}
