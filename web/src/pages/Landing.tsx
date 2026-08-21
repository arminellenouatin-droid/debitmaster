import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Beer, Users, WifiOff, BarChart3, ArrowRight, ShieldCheck, HandCoins } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getSession } from '../lib/api'

export default function Landing() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getSession().then((s) => {
      if (s.user && !checked) {
        navigate(s.profile?.tenant_id ? '/dashboard' : '/onboarding', { replace: true })
      }
      setChecked(true)
    })
  }, [navigate])

  const features = [
    { icon: <Beer className="w-6 h-6" />, title: t('products'), desc: 'Stocks, prix, seuils d\'alerte et inventaires' },
    { icon: <Users className="w-6 h-6" />, title: t('staff'), desc: 'Présences géolocalisées, plannings et paie' },
    { icon: <WifiOff className="w-6 h-6" />, title: t('offline'), desc: 'Fonctionne même sans connexion internet' },
    { icon: <BarChart3 className="w-6 h-6" />, title: t('dashboard'), desc: 'CA, ventes et KPI en temps réel' },
  ]

  return (
    <div className="min-h-screen bg-bg dark:bg-bg dark">
      {/* Nav */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-md py-md">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xl">D</div>
          <span className="font-bold text-lg">{t('appName')}</span>
        </div>
        <div className="flex gap-2">
          <Link to="/login" className="btn-secondary !h-11 !px-4">{t('login')}</Link>
          <Link to="/register" className="btn-primary !h-11 !px-4">{t('register')}</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-md pt-xl pb-xxl text-center">
        <h1 className="text-4xl md:text-5xl font-bold max-w-3xl mx-auto leading-tight">
          {t('tagline')}
        </h1>
        <p className="mt-4 text-ink-secondary dark:text-ink-darkSecondary max-w-2xl mx-auto">
          Ventes, stocks, personnel, paie, trésorerie : tout votre établissement dans une seule application,
          pensée pour l'Afrique de l'Ouest.
        </p>
        <div className="mt-lg flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register" className="btn-primary">
            {t('startTrial')} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/register?affiliate=1" className="btn-secondary">
            <HandCoins className="w-4 h-4" /> {t('registerAffiliate')}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-md pb-xxl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        {features.map((f) => (
          <div key={f.title} className="card flex flex-col gap-2">
            <div className="p-3 rounded-md bg-primary-light dark:bg-primary-dark text-primary w-fit">{f.icon}</div>
            <p className="font-bold">{f.title}</p>
            <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Trust */}
      <section className="max-w-6xl mx-auto px-md pb-xxl flex flex-col sm:flex-row items-center gap-md justify-center text-sm text-ink-secondary dark:text-ink-darkSecondary">
        <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-success" /> Paiements Kkiapay · Moneroo · Cinetpay</span>
        <span className="flex items-center gap-1"><WifiOff className="w-4 h-4 text-warning" /> Mode hors-ligne inclus</span>
        <span className="flex items-center gap-1"><HandCoins className="w-4 h-4 text-secondary" /> Programme d'affiliation ouvert</span>
      </section>

      <footer className="border-t border-line dark:border-line dark py-md text-center text-xs text-ink-secondary dark:text-ink-darkSecondary">
        © {new Date().getFullYear()} DebitManager — Bar Maquis Master · docs/ · v0.1
      </footer>
    </div>
  )
}
