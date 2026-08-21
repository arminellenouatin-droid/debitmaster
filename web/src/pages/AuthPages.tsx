import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { signIn, signUp, getSession } from '../lib/api'
import { Button, Card, Input, Label } from '../components/ui'

export default function AuthPages({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isAffiliateSignup = params.get('affiliate') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await signIn(email, password)
        if (res.error) { setError(res.error); return }
        const s = await getSession()
        navigate(s.profile?.tenant_id ? '/dashboard' : '/onboarding', { replace: true })
      } else {
        const res = await signUp({ email, password, firstName, lastName, phone })
        if (res.error) { setError(res.error); return }
        if (isAffiliateSignup) navigate('/affiliate', { replace: true })
        else navigate('/onboarding', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-bg dark px-md py-lg">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-lg">
          <div className="w-12 h-12 rounded-md bg-primary text-white flex items-center justify-center font-bold text-2xl mb-2">D</div>
          <h1 className="text-xl font-bold">{mode === 'login' ? t('login') : t('register')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{t('appName')} — {t('tagline')}</p>
        </div>

        {isAffiliateSignup && mode === 'register' && (
          <div className="mb-md p-3 rounded-sm bg-secondary/10 text-sm font-semibold text-warning">
            🎯 {t('registerAffiliate')} — formulaire d'inscription publique
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-md">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <Label>{t('firstName')}</Label>
                  <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Afi" />
                </div>
                <div>
                  <Label>{t('lastName')}</Label>
                  <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Kossi" />
                </div>
              </div>
              <div>
                <Label>{t('phone')}</Label>
                <Input required type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+229 01 23 45 67" />
              </div>
            </>
          )}
          <div>
            <Label>{t('email')}</Label>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </div>
          <div>
            <Label>{t('password')}</Label>
            <Input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {error && <p className="text-sm text-danger font-semibold">{error}</p>}

          <Button type="submit" loading={loading}>
            {mode === 'login' ? t('login') : isAffiliateSignup ? t('registerAffiliate') : t('register')}
          </Button>
        </form>

        <p className="mt-md text-sm text-center text-ink-secondary dark:text-ink-darkSecondary">
          {mode === 'login' ? (
            <>Pas de compte ? <Link to="/register" className="text-primary font-semibold">{t('register')}</Link></>
          ) : (
            <>Déjà un compte ? <Link to="/login" className="text-primary font-semibold">{t('login')}</Link></>
          )}
        </p>
        <p className="mt-md text-center text-sm">
          <Link to="/" className="text-ink-secondary dark:text-ink-darkSecondary hover:underline">← {t('back')}</Link>
        </p>
      </Card>
    </div>
  )
}
