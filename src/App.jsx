import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { LenisProvider } from './context/LenisContext'
import { BlindExitProvider } from './context/BlindExitContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Portraits from './pages/Portraits'
import Events from './pages/Events'
import Places from './pages/Places'
import About from './pages/About'
import Book from './pages/Book'
import Privacy from './pages/Privacy'
import Work from './pages/Work'
import WorkCategory from './pages/WorkCategory'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="work" element={<Work />} />
        <Route path="work/:categoryId" element={<WorkCategory />} />
        <Route path="portraits" element={<Portraits />} />
        <Route path="events" element={<Events />} />
        <Route path="places" element={<Places />} />
        <Route path="about" element={<About />} />
        <Route path="book" element={<Book />} />
        <Route path="privacy" element={<Privacy />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LenisProvider>
        <BlindExitProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </BlindExitProvider>
      </LenisProvider>
    </ThemeProvider>
  )
}
