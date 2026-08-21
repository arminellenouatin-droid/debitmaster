import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCircle2, LogOut, Store } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getSession, getMyCompany, signOut, invalidatePermissions, type Profile } from '../lib/api'
import { Button, Card, StatusBadge, Spinner } from '../components/ui'
import type { Company } from '../lib/types'

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [company, setCompany] = useState<Company | null>(null)

  useEffect(() => {
    Promise.all([getSession(), getMyCompany()]).then(([s, c]) => {
      setProfile(s.profile); setCompany(c)
    })
  }, [])

  if (!profile) return <Spinner />

  const logout = async () => {
    await signOut()
    invalidatePermissions()
    navigate('/')
  }

  return (
    <div className="flex flex-col gap-lg max-w-xl">
      <h1 className="text-2xl font-bold">{t('profile')}</h1>

      <Card className="flex items-center gap-md">
        <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center">
          <UserCircle2 className="w-8 h-8" />
        </div>
        <div>
          <p className="font-bold">{profile.first_name} {profile.last_name}</p>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{profile.email ?? profile.phone}</p>
          <p className="text-xs mt-0.5"><StatusBadge status={profile.user_type} label={profile.user_type.replace(/_/g, ' ')} /></p>
        </div>
      </Card>

      {company && (
        <Card>
          <h2 className="font-bold mb-2 flex items-center gap-2"><Store className="w-4 h-4" /> {t('company')}</h2>
          <p className="font-semibold">{company.name}</p>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
            {t(company.activity_type.toLowerCase() as never)} · {company.country} · {company.currency}
          </p>
          <p className="text-sm mt-1">
            Code société : <span className="font-mono font-bold">{company.unique_code}</span>
          </p>
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary mt-1">
            <StatusBadge status={company.status} />
          </p>
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <span className="font-semibold">{t('language')}</span>
        <div className="flex gap-1">
          {['fr', 'en'].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-sm text-sm font-bold ${lang === l ? 'bg-primary text-white' : 'bg-surface dark:bg-surface dark border border-line dark:border-line dark'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </Card>

      <Button variant="danger" onClick={logout}><LogOut className="w-4 h-4" /> {t('logout')}</Button>
    </div>
  )
}
