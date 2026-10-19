import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { useI18n, type TKey } from './i18n'
import { Icon, type IconName } from './components/ui'
import { cls } from './utils'
import Agenda from './pages/Agenda'
import AppointmentForm from './pages/AppointmentForm'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import ClientForm from './pages/ClientForm'
import Cash from './pages/Cash'
import Checkout from './pages/Checkout'
import Stats from './pages/Stats'
import More from './pages/More'
import Services from './pages/Services'
import Stock from './pages/Stock'
import Expenses from './pages/Expenses'
import Bridals from './pages/Bridals'
import BridalForm from './pages/BridalForm'
import BridalDetail from './pages/BridalDetail'
import Settings from './pages/Settings'

const tabs: { to: string; icon: IconName; label: TKey }[] = [
  { to: '/', icon: 'calendar', label: 'agenda' },
  { to: '/clients', icon: 'users', label: 'clients' },
  { to: '/cash', icon: 'wallet', label: 'cash' },
  { to: '/stats', icon: 'chart', label: 'stats' },
  { to: '/more', icon: 'menu', label: 'more' },
]

function BottomNav() {
  const { t } = useI18n()
  const lowStock = useLiveQuery(() => db.products.filter((p) => p.qty <= p.minQty).count(), [], 0)
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-nude/70 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              cls('relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-rose' : 'text-muted')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cls('grid h-8 w-14 place-items-center rounded-full transition', isActive && 'bg-blush')}>
                  <Icon name={tab.icon} size={21} />
                </span>
                {t(tab.label)}
                {tab.to === '/more' && lowStock > 0 && (
                  <span className="absolute end-[calc(50%-1.4rem)] top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

const TAB_PATHS = ['/', '/clients', '/cash', '/stats', '/more']

export default function App() {
  const { pathname } = useLocation()
  return (
    <>
      <Routes>
        <Route path="/" element={<Agenda />} />
        <Route path="/appt/new" element={<AppointmentForm />} />
        <Route path="/appt/:id" element={<AppointmentForm />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/new" element={<ClientForm />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/clients/:id/edit" element={<ClientForm />} />
        <Route path="/cash" element={<Cash />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/more" element={<More />} />
        <Route path="/services" element={<Services />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/bridal" element={<Bridals />} />
        <Route path="/bridal/new" element={<BridalForm />} />
        <Route path="/bridal/:id" element={<BridalDetail />} />
        <Route path="/bridal/:id/edit" element={<BridalForm />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      {TAB_PATHS.includes(pathname) && <BottomNav />}
    </>
  )
}
