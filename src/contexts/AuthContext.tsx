import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: 'fan' | 'artist' | 'admin'
  avatar_setup_done?: boolean
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    const baseCols = 'id, email, full_name, avatar_url, role'
    const withOptional = `${baseCols}, avatar_setup_done`

    const setFromRow = (row: Record<string, unknown>): UserProfile => {
      const p: UserProfile = {
        id: row.id as string,
        email: (row.email as string) ?? null,
        full_name: (row.full_name as string) ?? null,
        avatar_url: (row.avatar_url as string) ?? null,
        role: (row.role as UserProfile['role']) ?? 'fan',
        avatar_setup_done: row.avatar_setup_done as boolean | undefined,
      }
      setProfile(p)
      return p
    }

    let { data, error } = await supabase.from('users').select(withOptional).eq('id', uid).single()
    if (!error && data) {
      return setFromRow(data as Record<string, unknown>)
    }
    // Fallback: select without optional columns (e.g. avatar_setup_done missing in DB)
    const { data: fallback } = await supabase.from('users').select(baseCols).eq('id', uid).single()
    if (fallback) {
      return setFromRow({ ...fallback, avatar_setup_done: false })
    }
    // Recovery: no row yet — insert minimal profile
    const { data: authUser } = await supabase.auth.getUser()
    if (authUser?.user?.id === uid) {
      const { error: insertErr } = await supabase.from('users').insert({
        id: uid,
        email: authUser.user.email ?? null,
        full_name: (authUser.user.user_metadata?.full_name as string) ?? (authUser.user.user_metadata?.name as string) ?? null,
        avatar_url: authUser.user.user_metadata?.avatar_url as string ?? null,
        role: (authUser.user.user_metadata?.role as 'fan' | 'artist' | 'admin') ?? 'fan',
      })
      if (!insertErr) {
        const { data: inserted } = await supabase.from('users').select(baseCols).eq('id', uid).single()
        if (inserted) return setFromRow({ ...inserted, avatar_setup_done: false })
      } else {
        // Row may already exist (e.g. trigger ran but first select failed) — try base select again
        const { data: existing } = await supabase.from('users').select(baseCols).eq('id', uid).single()
        if (existing) return setFromRow({ ...existing, avatar_setup_done: false })
      }
    }
    setProfile(null)
    return null
  }, [])

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (user?.id) return fetchProfile(user.id)
    return null
  }, [user?.id, fetchProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user?.id) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user?.id) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const authValue: AuthState = {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
