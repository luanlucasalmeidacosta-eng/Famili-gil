import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const entrar = useCallback(async (email, senha) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) throw new Error(error.message)
    setSession(data.session ?? null)
  }, [])

  const sair = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return <Ctx.Provider value={{ session, carregando, entrar, sair }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora de AuthProvider')
  return v
}
