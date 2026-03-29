import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PANEL_COLORS = [
  '#0284c7', '#059669', '#ea580c', '#dc2626', '#7c3aed',
  '#db2777', '#0891b2', '#ca8a04', '#4f46e5', '#16a34a', '#e11d48',
]

const PERIOD_LABELS = {
  '1y': '1년',
  '3y': '3년',
  '5y': '5년',
}

function formatChartDate(value, period) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (period === '1y') {
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatChartNumber(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '-'
  }

  const absValue = Math.abs(numericValue)
  if (absValue >= 1000000) return `${(numericValue / 1000000).toFixed(1)}M`
  if (absValue >= 1000) return `${(numericValue / 1000).toFixed(absValue >= 10000 ? 0 : 1)}k`
  if (absValue >= 100) return numericValue.toFixed(0)
  if (absValue >= 1) return numericValue.toFixed(1)
  return numericValue.toFixed(3)
}

function buildDateTicks(series) {
  if (series.length <= 1) {
    return series.map(item => item.date)
  }

  const targetTickCount = Math.min(6, series.length)
  const step = Math.max(1, Math.floor((series.length - 1) / (targetTickCount - 1)))
  const ticks = []

  for (let index = 0; index < series.length; index += step) {
    ticks.push(series[index].date)
  }

  const lastDate = series[series.length - 1]?.date
  if (lastDate && ticks[ticks.length - 1] !== lastDate) {
    ticks.push(lastDate)
  }

  return ticks
}

function buildValueTicks(series) {
  if (series.length === 0) {
    return []
  }

  const values = series.map(item => Number(item.close)).filter(Number.isFinite)
  if (values.length === 0) {
    return []
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    return [min]
  }

  const tickCount = 5
  const step = (max - min) / (tickCount - 1)
  return Array.from({ length: tickCount }, (_, index) => Number((min + step * index).toFixed(4)))
}

function PanelCard({ panel, color, period, onUpdate, presets, index, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, panelLabel, group }) {
  const [data, setData] = useState({ data: [], latest: null, change: null, period_change: null, source: panel.source })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState(panel.ticker)
  const selectedPreset = presets.find(item => item.ticker === selectedTicker)
  const xTicks = useMemo(() => buildDateTicks(data.data), [data.data])
  const yTicks = useMemo(() => buildValueTicks(data.data), [data.data])

  useEffect(() => {
    setSelectedTicker(panel.ticker)
  }, [panel.ticker])

  useEffect(() => {
    loadData(panel.ticker, period)
  }, [panel.ticker, period])

  async function loadData(ticker, currentPeriod) {
    setLoading(true)
    try {
      const { data: response } = await axios.get(`/api/macro/chart/${encodeURIComponent(ticker)}?period=${currentPeriod}`)
      setData(response)
    } catch {
      setData({ data: [], latest: null, change: null, period_change: null, source: panel.source })
    } finally {
      setLoading(false)
    }
  }

  async function savePanel() {
    const preset = selectedPreset
    if (!preset) return
    await axios.put(`/api/macro/panels/${panel.slot}`, { ticker: preset.ticker, label: preset.label, group })
    onUpdate()
    setEditing(false)
  }

  return (
    <article
      draggable
      onDragStart={event => onDragStart(event, index)}
      onDragOver={event => onDragOver(event, index)}
      onDrop={event => onDrop(event, index)}
      onDragEnd={onDragEnd}
      className={`rounded-[28px] border bg-white p-5 shadow-sm cursor-grab active:cursor-grabbing transition-all ${
        isDragOver ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{panelLabel}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{panel.label}</h3>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-semibold text-slate-900">
              {data.latest != null ? Number(data.latest).toLocaleString() : '-'}
            </span>
            {data.change != null ? (
              <span className={`rounded-full px-2 py-1 text-xs ${data.change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                일간 {data.change > 0 ? '+' : ''}{data.change}%
              </span>
            ) : null}
            {data.period_change != null ? (
              <span className={`rounded-full px-2 py-1 text-xs ${data.period_change >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                조회기간 {data.period_change > 0 ? '+' : ''}{data.period_change}%
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            일간 변화율과 최근 {PERIOD_LABELS[period]} 전체 변화율을 함께 표시합니다.
          </p>
        </div>
        <button
          onClick={() => setEditing(value => !value)}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
        >
          {editing ? '닫기' : '패널 편집'}
        </button>
      </div>

      {editing ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">패널 항목 선택</p>
            <p className="text-xs text-slate-500">{presets.length}개 항목 전체 보기</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presets.map(preset => {
              const isSelected = preset.ticker === selectedTicker

              return (
                <button
                  key={preset.ticker}
                  type="button"
                  onClick={() => setSelectedTicker(preset.ticker)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50 shadow-[0_10px_30px_rgba(14,165,233,0.12)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900">{preset.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{preset.ticker}</p>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              선택 항목: <span className="font-medium text-slate-900">{selectedPreset?.label ?? panel.label}</span>
            </div>
            <button
              onClick={savePanel}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <div className="h-[220px] animate-pulse rounded-3xl bg-slate-100" />
        ) : data.data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.data} margin={{ top: 5, right: 16, left: 4, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                <XAxis
                  dataKey="date"
                  ticks={xTicks}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={value => formatChartDate(value, period)}
                  interval={0}
                  minTickGap={24}
                  height={34}
                />
                <YAxis
                  ticks={yTicks}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={formatChartNumber}
                  width={64}
                  domain={['dataMin', 'dataMax']}
                  tickCount={5}
                  allowDecimals
                />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #dbe4f0', borderRadius: 16 }}
                  formatter={value => [Number(value).toLocaleString(), panel.label]}
                  labelFormatter={label => formatChartDate(label, period)}
                />
                <Line type="monotone" dataKey="close" stroke={color} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-slate-500">데이터 출처: {data.source ?? panel.source}</p>
          </>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-3xl bg-slate-50 text-sm text-slate-500">
            데이터를 가져오지 못했습니다.
          </div>
        )}
      </div>
    </article>
  )
}

export default function MarketPanelGrid({ group, title, description, badge = 'Dashboard', panelLabel = 'Panel' }) {
  const [panels, setPanels] = useState([])
  const [presets, setPresets] = useState([])
  const [period, setPeriod] = useState('1y')
  const [loading, setLoading] = useState(true)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  useEffect(() => {
    loadPage()
  }, [group])

  async function loadPage() {
    setLoading(true)
    try {
      const [panelResponse, presetResponse] = await Promise.all([
        axios.get(`/api/macro/panels?group=${group}`),
        axios.get(`/api/macro/presets?group=${group}`),
        ])
      const nextPanels = panelResponse.data.filter(panel => !(group === 'macro' && panel.ticker === 'QQQ'))
      setPanels(nextPanels)
      setPresets(presetResponse.data)
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = useCallback((event, index) => {
    setDragIndex(index)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((event, index) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(async (event, dropIndex) => {
    event.preventDefault()
    setDragOverIndex(null)
    if (dragIndex === null || dragIndex === dropIndex) return

    const newPanels = [...panels]
    const [dragged] = newPanels.splice(dragIndex, 1)
    newPanels.splice(dropIndex, 0, dragged)
    setPanels(newPanels)

    const slots = newPanels.map(panel => panel.slot)
    try {
      await axios.put('/api/macro/panels/reorder', { slots, group })
      loadPage()
    } catch {
      loadPage()
    }
    setDragIndex(null)
  }, [dragIndex, group, panels])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-sky-700/80">{badge}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {['1y', '3y', '5y'].map(item => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  period === item ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
            <button
              onClick={loadPage}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              패널 새로고침
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: Math.max(panels.length, presets.length, 5) || 5 }).map((_, index) => (
              <div key={index} className="h-[340px] animate-pulse rounded-[28px] bg-slate-100" />
            ))
          : panels.map((panel, index) => (
              <PanelCard
                key={panel.slot}
                panel={panel}
                color={PANEL_COLORS[index % PANEL_COLORS.length]}
                period={period}
                presets={presets}
                onUpdate={loadPage}
                index={index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                isDragOver={dragOverIndex === index}
                panelLabel={panelLabel}
                group={group}
              />
            ))}
      </section>
    </div>
  )
}
