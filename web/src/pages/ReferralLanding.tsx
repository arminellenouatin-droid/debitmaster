import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { HandCoins, ArrowRight } from 'lucide-react'
import { trackReferralClick } from '../lib/api'

/** Page publique de résolution d'un lien de parrainage (/r/:code).
 *  Enregistre le clic (ReferralTracking) puis redirige vers l'inscription. */
export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>()
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    if (!code) { setState('error'); return }
    trackReferralClick(code).then((res) => setState(res.ok ? 'ok' : 'error'))
  }, [code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-bg dark px-md">
      <div className="max-w-sm w-full text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
          <HandCoins className="w-8 h-8" />
        </div>
        {state === 'loading' && <p className="font-semibold">Chargement…</p>}
        {state === 'ok' && (
          <>
            <h1 className="text-xl font-bold">Bienvenue ! 🎉</h1>
            <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">
              Vous arrivez via un lien de parrainage DebitManager. Créez votre boutique
              et votre parrain percevra une commission sur votre abonnement — sans surcoût pour vous.
            </p>
            <Link to={`/register?ref=${code}`} className="btn-primary w-full">
              Créer ma boutique <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <h1 className="text-xl font-bold">Code invalide</h1>
            <p className="text-sm text-ink-secondary dark:text-ink-darkSecondary">Ce lien de parrainage n'est pas valide.</p>
            <Link to="/register" className="btn-secondary w-full">S'inscrire quand même</Link>
          </>
        )}
      </div>
    </div>
  )
}
