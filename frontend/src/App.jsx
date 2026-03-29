import { useState } from 'react'
import WatchlistPage from './pages/WatchlistPage'
import MacroPage from './pages/MacroPage'
import MarketPage from './pages/MarketPage'
import SupplyPage from './pages/SupplyPage'
import CalendarPage from './pages/CalendarPage'

function TabIcon({ kind, active }) {
  const className = active ? 'stroke-white' : 'stroke-slate-500'

  if (kind === 'watchlist') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 ${className}`} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    )
  }

  if (kind === 'macro') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 ${className}`} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 18h16" />
        <path d="M7 16V9" />
        <path d="M12 16V6" />
        <path d="M17 16v-4" />
      </svg>
    )
  }

  if (kind === 'market') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 ${className}`} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l5-5 4 3 7-8" />
        <path d="M15 7h5v5" />
      </svg>
    )
  }

  if (kind === 'supply') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 ${className}`} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8h14" />
        <path d="M7 12h10" />
        <path d="M9 16h6" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-6 w-6 ${className}`} fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
    </svg>
  )
}

const TABS = [
  { id: 'watchlist', label: '관심종목', desc: '주가와 재무를 빠르게 점검합니다.' },
  { id: 'macro', label: '거시변수', desc: '금리, 달러, 유가, 변동성을 봅니다.' },
  { id: 'market', label: '시장', desc: '미국과 한국 대표 지수를 비교합니다.' },
  { id: 'supply', label: '수급', desc: '투자자 흐름과 거래대금을 확인합니다.' },
  { id: 'calendar', label: '캘린더', desc: '실적과 경제 이벤트 일정을 관리합니다.' },
]

export default function App() {
  const [tab, setTab] = useState('watchlist')

  return (
    <div className="min-h-screen bg-app text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_26%)] pointer-events-none" />
      <div className="relative">
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex justify-center">
              <div className="grid w-full max-w-[900px] grid-cols-2 gap-2 rounded-[28px] border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3 lg:grid-cols-5">
                {TABS.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`rounded-[22px] px-4 py-3 transition ${
                      tab === item.id
                        ? 'bg-sky-600 text-white shadow-[0_10px_30px_rgba(14,165,233,0.24)]'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-3">
                      <TabIcon kind={item.id} active={tab === item.id} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
          {tab === 'watchlist' && <WatchlistPage />}
          {tab === 'macro' && <MacroPage />}
          {tab === 'market' && <MarketPage />}
          {tab === 'supply' && <SupplyPage />}
          {tab === 'calendar' && <CalendarPage />}
        </main>
      </div>
    </div>
  )
}
