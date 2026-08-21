import React, { useEffect, useState } from 'react'
import { HandCoins, Link2, Copy, QrCode, Check } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getAffiliateInfo, registerAffiliate, requestPayout } from '../lib/api'
import { Button, Card, EmptyState, Input, Label, Select, Spinner, StatusBadge } from '../components/ui'
import { fmtXof } from '../lib/format'
import type { AffiliateInfo } from '../lib/types'

export default function AffiliatePage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<AffiliateInfo | null | 'none'>(null)
  const [copied, setCopied] = useState(false)

  const refresh = () => getAffiliateInfo().then((i) => setInfo(i ?? 'none'))
  useEffect(() => { refresh() }, [])

  const copy = async () => {
    if (info === null || info === 'none') return
    await navigator.clipboard.writeText(info.referral_link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (info === null) return <Spinner />

  if (info === 'none') return <AffiliateRegister onDone={refresh} />

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">🎯 {t('affiliate')}</h1>
          <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
            Code <span className="font-mono font-bold">{info.referral_code}</span> · <StatusBadge status={info.status} />
          </p>
        </div>
      </div>

      {/* Lien de parrainage */}
      <Card className="flex flex-col sm:flex-row items-stretch sm:items-center gap-md">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink-secondary dark:text-ink-darkSecondary mb-1">{t('referralLink')}</p>
          <p className="font-mono text-sm bg-bg dark:bg-bg dark rounded-sm p-2 border border-line dark:border-line dark truncate">{info.referral_link}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copy} className="!h-11">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? '✓' : 'Copier'}
          </Button>
          <Button variant="ghost" className="!h-11 !px-3" title="QR code">
            <QrCode className="w-5 h-5" />
          </Button>
        </div>
      </Card>

      {/* Gains */}
      <div className="grid grid-cols-3 gap-md">
        <Card className="text-center">
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('pendingCommissions')}</p>
          <p className="text-xl font-bold tabular-nums text-warning dark:text-warning dark">{fmtXof(info.pending)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('availableCommissions')}</p>
          <p className="text-xl font-bold tabular-nums text-success dark:text-success dark">{fmtXof(info.available)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{t('paidCommissions')}</p>
          <p className="text-xl font-bold tabular-nums">{fmtXof(info.paid)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={info.available < 10000} onClick={async () => { await requestPayout(); refresh() }}>
          <HandCoins className="w-4 h-4" /> {t('requestPayout')} {info.available < 10000 && '(min 10 000 F)'}
        </Button>
      </div>

      {/* Boutiques parrainées */}
      <Card>
        <h2 className="font-bold mb-md">{t('referrals')} ({info.companies_count})</h2>
        {info.companies.length === 0 ? (
          <EmptyState icon={<Link2 className="w-8 h-8" />} title="Aucune boutique parrainée" subtitle="Partagez votre lien : chaque boutique qui s'inscrit via votre lien vous est attribuée définitivement." />
        ) : (
          <ul className="flex flex-col gap-2">
            {info.companies.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-3 rounded-sm bg-surface dark:bg-surface dark">
                <div>
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function AffiliateRegister({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', paymentMethod: 'MOBILE_MONEY', accountRef: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true); setError(null)
    const res = await registerAffiliate(form)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onDone()
  }

  return (
    <Card className="max-w-md mx-auto">
      <div className="flex flex-col items-center mb-lg text-center">
        <div className="w-14 h-14 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mb-2">
          <HandCoins className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold">{t('registerAffiliate')}</h1>
        <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
          Recevez une commission sur les abonnements des boutiques que vous apportez.
        </p>
      </div>
      <div className="flex flex-col gap-md">
        <div className="grid grid-cols-2 gap-md">
          <div><Label>{t('firstName')}</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
          <div><Label>{t('lastName')}</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
        </div>
        <div><Label>{t('email')}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>{t('phone')}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-md">
          <div>
            <Label>Paiement</Label>
            <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              <option value="MOBILE_MONEY">Mobile money</option>
              <option value="BANK_TRANSFER">Virement</option>
            </Select>
          </div>
          <div>
            <Label>Référence</Label>
            <Input value={form.accountRef} onChange={(e) => setForm({ ...form, accountRef: e.target.value })} placeholder="+229 01 23 45 67" />
          </div>
        </div>
        {error && <p className="text-sm text-danger font-semibold">{error}</p>}
        <Button loading={saving} onClick={submit}>{t('confirm')}</Button>
      </div>
    </Card>
  )
}
