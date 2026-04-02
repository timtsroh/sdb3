import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const SORT_OPTIONS = [
  { value: 'market_cap', label: '시가총액' },
  { value: 'change_pct', label: '등락률' },
  { value: 'per', label: 'PER' },
]

function fmtPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return Math.round(Number(value)).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtMarketCap(value, market) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const numericValue = Number(value)

  if (market === 'KR') {
    if (Math.abs(numericValue) >= 1e12) return `${Math.round(numericValue / 1e12).toLocaleString('ko-KR')} 조원`
    return `${Math.round(numericValue / 1e9).toLocaleString('ko-KR')} 십억원`
  }

  if (Math.abs(numericValue) >= 1e12) return `USD ${(numericValue / 1e12).toFixed(1)}tn`
  if (Math.abs(numericValue) >= 1e9) return `USD ${(numericValue / 1e9).toFixed(1)}bn`
  return `USD ${(numericValue / 1e6).toFixed(1)}mn`
}

function fmtNum(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(digits)
}

function fmtPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${value > 0 ? '+' : ''}${fmtNum(value)}%`
}

function pctColor(value) {
  if (value > 0) return 'text-emerald-600'
  if (value < 0) return 'text-rose-600'
  return 'text-slate-600'
}

export default function WatchlistPage() {
  const [stocks, setStocks] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('전체')
  const [newGroupName, setNewGroupName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [chartData, setChartData] = useState([])
  const [finData, setFinData] = useState(null)
  const [chartPeriod, setChartPeriod] = useState('1y')
  const [sortBy, setSortBy] = useState('market_cap')
  const [query, setQuery] = useState('')
  const [ticker, setTicker] = useState('')
  const [market, setMarket] = useState('US')
  const [suggestions, setSuggestions] = useState([])
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadWatchlist()
    loadGroups()
  }, [])

  useEffect(() => {
    if (!selected) return
    loadChart(selected.ticker, chartPeriod)
    loadFinancials(selected.ticker)
  }, [selected, chartPeriod])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get(`/api/watchlist/search?q=${encodeURIComponent(trimmed)}`)
        setSuggestions(data)
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [query])

  async function loadWatchlist() {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/watchlist/')
      setStocks(data)
      setSelected(previous => data.find(item => item.ticker === previous?.ticker) || data[0] || null)
      setError('')
    } catch {
      setError('관심종목 데이터를 불러오지 못했습니다. 마지막 캐시를 확인해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function loadGroups() {
    try {
      const { data } = await axios.get('/api/watchlist/groups')
      setGroups(data)
    } catch {
      setGroups(['관심종목'])
    }
  }

  async function loadChart(targetTicker, period) {
    try {
      const { data } = await axios.get(`/api/watchlist/${targetTicker}/chart?period=${period}`)
      setChartData(data)
    } catch {
      setChartData([])
    }
  }

  async function loadFinancials(targetTicker) {
    try {
      const { data } = await axios.get(`/api/watchlist/${targetTicker}/financials`)
      setFinData(data)
    } catch {
      setFinData(null)
    }
  }

  function applySuggestion(item) {
    setSelectedSuggestion(item)
    setTicker(item.ticker)
    setMarket(item.market)
    setQuery(`${item.name} (${item.ticker})`)
    setShowSuggestions(false)
  }

  async function addStock() {
    const fallbackSuggestion = selectedSuggestion || suggestions[0]
    const targetTicker = fallbackSuggestion?.ticker || ticker.trim().toUpperCase()
    const targetMarket = fallbackSuggestion?.market || market
    if (!targetTicker) return
    setAdding(true)
    setError('')
    try {
      await axios.post('/api/watchlist/', {
        ticker: targetTicker,
        market: targetMarket,
        group_name: selectedGroup === '전체' ? '관심종목' : selectedGroup,
      })
      setTicker('')
      setQuery('')
      setSuggestions([])
      setSelectedSuggestion(null)
      await Promise.all([loadWatchlist(), loadGroups()])
    } catch (event) {
      setError(event.response?.data?.detail || '종목 추가에 실패했습니다.')
    } finally {
      setAdding(false)
    }
  }

  async function addGroup() {
    const name = newGroupName.trim()
    if (!name) return
    try {
      await axios.post('/api/watchlist/groups', { name })
      setNewGroupName('')
      await loadGroups()
      setSelectedGroup(name)
    } catch (event) {
      setError(event.response?.data?.detail || '그룹 추가에 실패했습니다.')
    }
  }

  async function deleteGroup(groupName) {
    if (!groupName || groupName === '전체') return
    try {
      await axios.delete(`/api/watchlist/groups/${encodeURIComponent(groupName)}`)
      if (selectedGroup === groupName) {
        setSelectedGroup('전체')
      }
      await Promise.all([loadGroups(), loadWatchlist()])
    } catch {
      setError('그룹 삭제에 실패했습니다.')
    }
  }

  async function updateStockGroup(targetTicker, groupName, event) {
    event.stopPropagation()
    try {
      await axios.put(`/api/watchlist/${targetTicker}/group`, { group_name: groupName })
      await loadWatchlist()
    } catch {
      setError('그룹 이동에 실패했습니다.')
    }
  }

  async function removeStock(targetTicker, event) {
    event.stopPropagation()
    try {
      await axios.delete(`/api/watchlist/${targetTicker}`)
      if (selected?.ticker === targetTicker) {
        setSelected(null)
      }
      await loadWatchlist()
    } catch {
      setError('종목 삭제에 실패했습니다.')
    }
  }

  const filteredStocks = useMemo(() => {
    if (selectedGroup === '전체') return stocks
    return stocks.filter(item => item.group_name === selectedGroup)
  }, [selectedGroup, stocks])

  const sorted = useMemo(() => {
    return [...filteredStocks].sort((left, right) => {
      const lv = left[sortBy] ?? Number.NEGATIVE_INFINITY
      const rv = right[sortBy] ?? Number.NEGATIVE_INFINITY
      return rv - lv
    })
  }, [filteredStocks, sortBy])

  const finChartData = useMemo(() => {
    if (!finData) return []
    return finData.quarters
      .map((quarter, index) => ({
        quarter,
        매출액: finData.revenue?.[index],
        영업이익: finData.operating_income?.[index],
        순이익: finData.net_income?.[index],
        FCF: finData.free_cash_flow?.[index],
      }))
      .reverse()
  }, [finData])

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="relative flex flex-1 flex-wrap items-start gap-2">
            <div className="relative min-w-[260px] flex-1">
              <input
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                  setTicker(event.target.value.trim().toUpperCase())
                  setSelectedSuggestion(null)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={event => event.key === 'Enter' && addStock()}
                placeholder="회사명 또는 티커 검색"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              {showSuggestions && suggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {suggestions.map(item => (
                    <button
                      key={`${item.market}-${item.ticker}`}
                      type="button"
                      onClick={() => applySuggestion(item)}
                      className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-sky-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.ticker}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.market}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <select
              value={market}
              onChange={event => setMarket(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
            >
              <option value="US">US</option>
              <option value="KR">KR</option>
            </select>
            <button
              onClick={addStock}
              disabled={adding}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              {adding ? '추가 중...' : '+ 종목 추가'}
            </button>
            <button
              onClick={loadWatchlist}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              새로고침
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>정렬</span>
            <select
              value={sortBy}
              onChange={event => setSortBy(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[220px_minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">관심종목</p>
              {selectedGroup !== '전체' ? (
                <button
                  type="button"
                  onClick={() => deleteGroup(selectedGroup)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  삭제
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              {['전체', ...groups].map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => setSelectedGroup(group)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                    selectedGroup === group ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{group}</span>
                  {group !== '전체' ? <span className="text-xs">{stocks.filter(item => item.group_name === group).length}</span> : null}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <input
                value={newGroupName}
                onChange={event => setNewGroupName(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && addGroup()}
                placeholder="새 그룹명"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={addGroup}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                그룹 추가
              </button>
            </div>
          </aside>

          <div className="min-w-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="hidden grid-cols-[1.2fr_repeat(7,minmax(0,1fr))_140px] gap-3 bg-slate-50 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-500 md:grid">
                  <span>종목</span>
                  <span>현재가</span>
                  <span>등락률</span>
                  <span>시가총액</span>
                  <span>PER</span>
                  <span>PBR</span>
                  <span>52W 고</span>
                  <span>52W 저</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-200">
                  {sorted.map(stock => (
                    <div
                      key={stock.ticker}
                      onClick={() => setSelected(stock)}
                      onKeyDown={event => event.key === 'Enter' && setSelected(stock)}
                      role="button"
                      tabIndex={0}
                      className={`grid w-full cursor-pointer gap-3 px-4 py-4 text-left transition hover:bg-sky-50 md:grid-cols-[1.2fr_repeat(7,minmax(0,1fr))_140px] ${
                        selected?.ticker === stock.ticker ? 'bg-sky-50' : 'bg-transparent'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{stock.name || '-'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs font-mono text-slate-500">{stock.ticker}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{stock.group_name || '관심종목'}</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-slate-700">{fmtPrice(stock.price)}</div>
                      <div className={`text-sm ${pctColor(stock.change_pct)}`}>{fmtPct(stock.change_pct)}</div>
                      <div className="text-right text-sm text-slate-700">{fmtMarketCap(stock.market_cap, stock.market)}</div>
                      <div className="text-right text-sm text-slate-700">{stock.per != null ? `${fmtNum(stock.per, 1)}x` : '-'}</div>
                      <div className="text-right text-sm text-slate-700">{stock.pbr != null ? `${fmtNum(stock.pbr, 1)}x` : '-'}</div>
                      <div className="text-right text-sm text-slate-700">{fmtPrice(stock.week52_high)}</div>
                      <div className="text-right text-sm text-slate-700">{fmtPrice(stock.week52_low)}</div>
                      <div className="flex justify-end gap-2">
                        <select
                          value={stock.group_name || '관심종목'}
                          onChange={event => updateStockGroup(stock.ticker, event.target.value, event)}
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none"
                        >
                          {groups.map(group => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={event => removeStock(stock.ticker, event)}
                          className="rounded-xl px-2 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                  {sorted.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-slate-500">선택한 그룹에 종목이 없습니다.</div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
            {selected ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xl font-semibold text-slate-900">{selected.name}</p>
                    <p className="mt-1 font-mono text-sm text-slate-500">{selected.ticker}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">{selected.market}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">{selected.group_name || '관심종목'}</span>
                      <span className={`rounded-full bg-white px-3 py-1 text-xs ${pctColor(selected.change_pct)}`}>
                        {fmtPct(selected.change_pct)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {['1y', '3y', '5y'].map(period => (
                      <button
                        key={period}
                        onClick={() => setChartPeriod(period)}
                        className={`rounded-full px-3 py-1 text-xs transition ${
                          chartPeriod === period ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {period.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">주가 추이</p>
                    <p className="text-xs text-slate-500">{chartPeriod.toUpperCase()} 기준</p>
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                        <XAxis dataKey="date" hide />
                        <YAxis width={42} tick={{ fill: '#64748b', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#ffffff', border: '1px solid #dbe4f0', borderRadius: 16 }}
                          formatter={value => [fmtNum(value), '종가']}
                        />
                        <Line type="monotone" dataKey="close" stroke="#0284c7" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">차트 데이터가 없습니다.</div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">최근 분기 재무 요약</p>
                    <p className="text-xs text-slate-500">매출액 / 영업이익 / 순이익 / FCF</p>
                  </div>
                  {finChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={finChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                        <XAxis dataKey="quarter" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis width={42} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #dbe4f0', borderRadius: 16 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="매출액" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="영업이익" fill="#34d399" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="순이익" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="FCF" fill="#a78bfa" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">재무 데이터가 없습니다.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center text-center text-sm text-slate-500">
                좌측 테이블에서 종목을 선택하면 상세 재무와 차트를 볼 수 있습니다.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
