import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Beer, UtensilsCrossed, Music4, Check, Sparkles, ArrowLeft, ArrowRight, Wallet } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getPlans, createCompany, getMyCompany } from '../lib/api'
import { Button, Card, Input, Label, Select } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { ActivityType, PublicPlans } from '../lib/types'

const ACTIVITIES: { value: ActivityType; icon: React.ReactNode; label: string; coeff: string }[] = [
  { value: 'BUVETTE', icon: <Beer className="w-8 h-8" />, label: 'buvette', coeff: '×1' },
  { value: 'BAR_RESTAURANT', icon: <UtensilsCrossed className="w-8 h-8" />, label: 'barRestaurant', coeff: '×1,5' },
  { value: 'NIGHTCLUB_LOUNGE', icon: <Music4 className="w-8 h-8" />, label: 'nightclub', coeff: '×2' },
]

export default function OnboardingPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState<PublicPlans | null>(null)

  const [activity, setActivity] = useState<ActivityType>('BUVETTE')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [country, setCountry] = useState('BJ')
  const [referralCode, setReferralCode] = useState('')
  const [selectedPlan, setSelectedPlan] = useState('BASE')
  const [trial, setTrial] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPlans().then(setPlans)
    getMyCompany().then((c) => {
      if (c) navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  const finish = async () => {
    setLoading(true)
    setError(null)
    const res = await createCompany({
      name,
      activity_type: activity,
      country,
      currency: 'XOF',
      language: 'fr',
      address: address || undefined,
      referral_code: referralCode || undefined,
    })
    setLoading(false)
    if (res.error) { setError(res.error); return }
    navigate('/dashboard', { replace: true })
  }

  const plan = plans?.pricing.plans.find((p) => p.plan === selectedPlan)
  const price = plan?.prices[activity] ?? 0

  return (
    <div className="min-h-screen bg-bg dark:bg-bg dark px-md py-lg max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-lg">
        <div className="w-10 h-10 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xl">D</div>
        <div>
          <p className="font-bold leading-tight">{t('appName')}</p>
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('createCompany')}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-lg">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-line dark:bg-line dark'}`} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h1 className="text-xl font-bold mb-md">{t('activityType')}</h1>
          <div className="flex flex-col gap-md">
            {ACTIVITIES.map((a) => (
              <button
                key={a.value}
                onClick={() => setActivity(a.value)}
                className={`card flex items-center gap-md text-left transition-all border-2 ${activity === a.value ? 'border-primary' : 'border-transparent'}`}
              >
                <div className="p-3 rounded-md bg-primary-light dark:bg-primary-dark text-primary">{a.icon}</div>
                <div className="flex-1">
                  <p className="font-bold">{t(a.label)}</p>
                  <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">Coefficient tarifaire {a.coeff}</p>
                </div>
                {activity === a.value && <Check className="w-5 h-5 text-primary" />}
              </button>
            ))}
          </div>
          <Button className="mt-lg w-full" onClick={() => setStep(2)}>{t('next')} <ArrowRight className="w-4 h-4" /></Button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="text-xl font-bold mb-md">{t('companyName')}</h1>
          <div className="flex flex-col gap-md">
            <div>
              <Label>{t('companyName')}</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Maquis Chez Awa" />
            </div>
            <div>
              <Label>{t('address')}</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Cotonou, Bénin" />
            </div>
            <div>
              <Label>{t('country')}</Label>
              <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="BJ">Bénin</option>
                <option value="BF">Burkina Faso</option>
                <option value="CI">Côte d'Ivoire</option>
                <option value="SN">Sénégal</option>
                <option value="TG">Togo</option>
                <option value="ML">Mali</option>
                <option value="NE">Niger</option>
              </Select>
            </div>
            <div>
              <Label>Code affilié (optionnel) 🎯</Label>
              <Input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="EX: AF123XYZ" />
            </div>
            <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">
              Un code société unique sera généré automatiquement : vos employés l'utiliseront pour rejoindre votre boutique.
            </p>
          </div>
          <div className="flex gap-md mt-lg">
            <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /> {t('back')}</Button>
            <Button className="flex-1" disabled={!name.trim()} onClick={() => setStep(3)}>{t('next')} <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {step === 3 && plans && (
        <div>
          <h1 className="text-xl font-bold mb-md">{t('plan')}</h1>
          <div className="flex flex-col gap-md">
            {plans.pricing.plans.map((p) => (
              <button
                key={p.plan}
                onClick={() => setSelectedPlan(p.plan)}
                className={`card flex items-center justify-between text-left transition-all border-2 ${selectedPlan === p.plan ? 'border-primary' : 'border-transparent'}`}
              >
                <div>
                  <p className="font-bold">{t(p.plan.toLowerCase())}</p>
                  <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{p.months} mois</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{fmtXof(p.prices[activity])}</p>
                  <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{fmtXof(Math.round(p.prices[activity] / p.months))} {t('perMonth')}</p>
                </div>
              </button>
            ))}
          </div>

          <Card className="mt-lg flex items-center gap-md border-2 border-secondary">
            <Sparkles className="w-8 h-8 text-secondary shrink-0" />
            <div className="flex-1">
              <p className="font-bold">{t('trial')} — {plans.trial_days} {t('daysLeft')}</p>
              <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">14 jours offerts, sans carte bancaire</p>
            </div>
            <input type="checkbox" className="w-5 h-5 accent-[#0F4C3A]" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
          </Card>

          {!trial && (
            <div className="mt-lg card flex items-center gap-md">
              <Wallet className="w-6 h-6 text-primary" />
              <p className="text-sm">
                <span className="font-bold tabular-nums">{fmtXof(price)}</span> — Paiement Kkiapay / Moneroo / Cinetpay
              </p>
            </div>
          )}

          {error && <p className="mt-md text-sm text-danger font-semibold">{error}</p>}

          <div className="flex gap-md mt-lg pb-lg">
            <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4" /> {t('back')}</Button>
            <Button className="flex-1" loading={loading} onClick={finish}>
              {trial ? <><Sparkles className="w-4 h-4" /> {t('startTrial')}</> : <><Wallet className="w-4 h-4" /> {t('payNow')}</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
