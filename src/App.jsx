import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import Login from './pages/Login.jsx'
import Casos from './pages/Casos.jsx'
import CasoRouter from './pages/CasoRouter.jsx'

function Protegida({ children }) {
  const { session, carregando } = useAuth()
  if (carregando) return <p className="p-6 text-sm text-neutral-500">Carregando…</p>
  return session ? children : <Navigate to="/login" replace />
}

function Rotas() {
  const { session } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/casos" replace /> : <Login />} />
      <Route path="/casos" element={<Protegida><Casos /></Protegida>} />
      <Route path="/caso/:id" element={<Protegida><CasoRouter /></Protegida>} />
      <Route path="*" element={<Navigate to="/casos" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Rotas />
      </BrowserRouter>
    </AuthProvider>
  )
}
