import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getSession } from '../lib/api'
import { Spinner } from './ui'

/** Route protégée : redirige vers /login si non authentifié. */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ok' | 'nope'>('loading')
  const location = useLocation()

  useEffect(() => {
    let mounted = true
    getSession().then((s) => mounted && setState(s.user ? 'ok' : 'nope'))
    return () => { mounted = false }
  }, [])

  if (state === 'loading') return <Spinner />
  if (state === 'nope') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
