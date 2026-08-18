import { SalienceHandoffProvider } from '../context/SalienceHandoffContext'
import Hero from '../components/home/Hero'
import SalienceSection from '../components/home/SalienceSection'
import Featured from '../components/home/Featured'

export default function Home() {
  return (
    <SalienceHandoffProvider>
      <Hero />
      <SalienceSection />
      <Featured />
    </SalienceHandoffProvider>
  )
}
