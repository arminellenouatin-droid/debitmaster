import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ClipboardList, Grid3x3, Users, Megaphone, ShieldCheck,
  LogOut, Globe, Moon, Sun, Wifi, WifiOff, RefreshCw, Settings, HandCoins, Store,
  Clock, Wallet, Truck, BarChart3,
} from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { getSession, signOut, type SessionUser, type Profile } from '../lib/api'

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const online = useOnline()
  const [session, setSession] = useState<{ user: SessionUser | null; profile: Profile | null }>({ user: null, profile: null })
  const [dark, setDark] = useState(() => localStorage.getItem('dm.theme') === 'dark')

  useEffect(() => {
    getSession().then(setSession)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('dm.theme', dark ? 'dark' : 'light')
  }, [dark])

  const doLogout = async () => {
    await signOut()
    navigate('/')
  }

  const isAffiliate = session.profile?.user_type === 'AFFILIATE'
  const isSuperAdmin = session.profile?.user_type === 'SUPER_ADMIN'

  const navItems = [
    ...(isAffiliate
      ? [{ to: '/affiliate', icon: <HandCoins className="w-5 h-5" />, label: t('affiliate') }]
      : [
          { to: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: t('dashboard') },
          { to: '/orders', icon: <ClipboardList className="w-5 h-5" />, label: t('orders') },
          { to: '/products', icon: <Package className="w-5 h-5" />, label: t('products') },
          { to: '/tables', icon: <Grid3x3 className="w-5 h-5" />, label: t('tables') },
          { to: '/staff', icon: <Users className="w-5 h-5" />, label: t('staff') },
          { to: '/attendance', icon: <Clock className="w-5 h-5" />, label: t('attendance') },
          { to: '/payroll', icon: <Wallet className="w-5 h-5" />, label: t('payroll') },
          { to: '/procurement', icon: <Truck className="w-5 h-5" />, label: t('procurement') },
          { to: '/reports', icon: <BarChart3 className="w-5 h-5" />, label: t('reports') },
        ]),
    ...(isSuperAdmin ? [{ to: '/admin', icon: <ShieldCheck className="w-5 h-5" />, label: t('admin') }] : []),
    { to: '/profile', icon: <Settings className="w-5 h-5" />, label: t('profile') },
  ]

  const pendingSync = 0 // géré par la file offline (extension future)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Bandeau de connexion (design system §5.7) */}
      <div className={`fixed top-0 inset-x-0 z-40 text-white text-sm font-semibold flex items-center justify-center gap-2 py-1.5 ${
        !online ? 'bg-danger' : pendingSync > 0 ? 'bg-warning' : 'bg-success'
      }`}>
        {!online ? (
          <><WifiOff className="w-4 h-4" /> {t('offline')}</>
        ) : pendingSync > 0 ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> {t('syncing')} — {pendingSync} {t('pendingSync')}</>
        ) : (
          <><Wifi className="w-4 h-4" /> {t('online')}</>
        )}
      </div>

      <div className="flex flex-1 pt-8">
        {/* Sidebar (web/tablette) */}
        <aside className="hidden md:flex w-60 flex-col border-r border-line dark:border-line dark bg-surface dark:bg-surface dark p-md gap-1 sticky top-8 h-[calc(100vh-2rem)]">
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center font-bold text-lg">D</div>
            <div>
              <p className="font-bold leading-tight">{t('appName')}</p>
              <p className="text-xs text-ink-secondary dark:text-ink-darkSecondary">{session.profile?.first_name ?? ''}</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1 mt-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-sm font-medium transition-colors ${
                    isActive ? 'bg-primary text-white' : 'hover:bg-primary-light dark:hover:bg-primary-dark text-ink dark:text-ink dark'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-1">
            <button onClick={doLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-sm font-medium hover:bg-danger/10 text-danger">
              <LogOut className="w-5 h-5" /> {t('logout')}
            </button>
          </div>
        </aside>

        {/* Contenu */}
        <main className="flex-1 min-w-0 px-md md:px-lg py-md max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Barre d'onglets mobile (design system §5.6) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface dark:bg-surface dark border-t border-line dark:border-line dark flex">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                isActive ? 'text-primary' : 'text-ink-secondary dark:text-ink-darkSecondary'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Boutons flottants langue / thème */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="w-11 h-11 rounded-full bg-surface dark:bg-surface dark shadow-modal flex items-center justify-center text-sm font-bold border border-line dark:border-line dark"
          title="Langue / Language"
        >
          <Globe className="w-5 h-5" />
        </button>
        <button
          onClick={() => setDark(!dark)}
          className="w-11 h-11 rounded-full bg-surface dark:bg-surface dark shadow-modal flex items-center justify-center border border-line dark:border-line dark"
          title={dark ? t('light') : t('dark')}
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Boutons langue/thème aussi visibles sur desktop dans la sidebar */}
      <div className="hidden md:flex fixed bottom-4 left-4 gap-2 z-40">
        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-xs font-bold px-2 py-1 rounded-sm border border-line dark:border-line dark">
          {lang === 'fr' ? 'FR' : 'EN'}
        </button>
        <button onClick={() => setDark(!dark)} className="px-2 py-1 rounded-sm border border-line dark:border-line dark">
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Barre de navigation mobile du bas avec logo */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none flex justify-center pb-16">
        <div className="pointer-events-auto w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-modal">
          <Store className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}
