import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { LenisProvider } from './context/LenisContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Portraits from './pages/Portraits'
import Events from './pages/Events'
import Places from './pages/Places'
import About from './pages/About'
import Book from './pages/Book'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="portraits" element={<Portraits />} />
        <Route path="events" element={<Events />} />
        <Route path="places" element={<Places />} />
        <Route path="about" element={<About />} />
        <Route path="book" element={<Book />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LenisProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LenisProvider>
    </ThemeProvider>
  )
}
