import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PERIOD_OPTIONS = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '1y', label: '1Y' },
]

const TREND_IMAGE_MAP = {
  '1m': 'OneMonth',
  '3m': 'ThreeMonth',
  '1y': 'OneYear',
}

function formatDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function formatNumber(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '-'
  }

  if (Math.abs(numericValue) >= 1000000) return `${(numericValue / 1000000).toFixed(1)}M`
  if (Math.abs(numericValue) >= 1000) return `${(numericValue / 1000).toFixed(1)}k`
  return numericValue.toFixed(0)
}

function formatDepositInTrillionWon(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '-'
  }

  return (numericValue / 10000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatAmountInTrillionWon(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '-'
  }

  return (numericValue / 1000000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function axisUnitLabel(text) {
  return {
    value: text,
    angle: -90,
    position: 'insideLeft',
    offset: 10,
    style: {
      fill: '#94a3b8',
      fontSize: 11,
    },
  }
}

function rightAxisUnitLabel(text) {
  return {
    value: text,
    angle: 90,
    position: 'insideRight',
    offset: 10,
    style: {
      fill: '#94a3b8',
      fontSize: 11,
    },
  }
}

function buildTicks(data) {
  if (data.length <= 1) {
    return data.map(item => item.date)
  }

  const step = Math.max(1, Math.floor((data.length - 1) / 5))
  const ticks = []

  for (let index = 0; index < data.length; index += step) {
    ticks.push(data[index].date)
  }

  const lastDate = data[data.length - 1]?.date
  if (lastDate && ticks[ticks.length - 1] !== lastDate) {
    ticks.push(lastDate)
  }

  return ticks
}

function SupplyChartCard({ title, description, source, children }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Supply Chart</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
      {children}
      <p className="mt-3 text-xs text-slate-500">데이터 출처: {source}</p>
    </article>
  )
}

export default function SupplyPage() {
  const [period, setPeriod] = useState('3m')
  const [amountSeries, setAmountSeries] = useState({ data: [], source: 'Naver Finance 일별지수 시세' })
  const [depositSeries, setDepositSeries] = useState({ data: [], source: 'Naver Finance 증시자금동향' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData(period)
  }, [period])

  async function loadData(currentPeriod) {
    setLoading(true)
    try {
      const [amountResponse, depositResponse] = await Promise.all([
        axios.get(`/api/supply/amounts?period=${currentPeriod}`),
        axios.get(`/api/supply/deposits?period=${currentPeriod}`),
      ])
      setAmountSeries(amountResponse.data)
      setDepositSeries(depositResponse.data)
    } catch {
      setAmountSeries({ data: [], source: 'Naver Finance 일별지수 시세' })
      setDepositSeries({ data: [], source: 'Naver Finance 증시자금동향' })
    } finally {
      setLoading(false)
    }
  }

  const amountTicks = useMemo(() => buildTicks(amountSeries.data), [amountSeries.data])
  const depositTicks = useMemo(() => buildTicks(depositSeries.data), [depositSeries.data])
  const trendSuffix = TREND_IMAGE_MAP[period] ?? TREND_IMAGE_MAP['3m']
  const kospiInvestorImage = `https://ssl.pstatic.net/imgfinance/chart/sise/trendUitrade${trendSuffix}KOSPI.png?ts=${Date.now()}`
  const kosdaqInvestorImage = `https://ssl.pstatic.net/imgfinance/chart/sise/trendUitrade${trendSuffix}KOSDAQ.png?ts=${Date.now()}`

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-sky-700/80">Supply</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">수급 모니터</h2>
            <p className="mt-2 text-sm text-slate-500">개인, 기관, 외국인 수급 흐름과 시장 거래대금, 예탁금 흐름을 함께 봅니다.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setPeriod(option.id)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  period === option.id ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SupplyChartCard
          title="KOSPI 투자자별 매수·매도 동향"
          description="개인, 기관, 외국인 흐름을 Naver Finance 투자자별 거래실적 차트로 표시합니다. 1Y는 별도 연간 이미지로 전환됩니다."
          source="Naver Finance 투자자별 거래실적 이미지"
        >
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3">
            <img src={kospiInvestorImage} alt="KOSPI 투자자별 매수·매도 동향" className="h-[360px] w-full object-contain" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Y축 단위: 억원</p>
        </SupplyChartCard>

        <SupplyChartCard
          title="KOSDAQ 투자자별 매수·매도 동향"
          description="개인, 기관, 외국인 흐름을 Naver Finance 투자자별 거래실적 차트로 표시합니다. 1Y는 별도 연간 이미지로 전환됩니다."
          source="Naver Finance 투자자별 거래실적 이미지"
        >
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3">
            <img src={kosdaqInvestorImage} alt="KOSDAQ 투자자별 매수·매도 동향" className="h-[360px] w-full object-contain" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Y축 단위: 억원</p>
        </SupplyChartCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SupplyChartCard
          title="KOSPI·KOSDAQ 예탁금 잔고"
          description="KOSPI 예탁금 잔고는 좌측 Y축, KOSDAQ 예탁금 잔고는 우측 Y축으로 표시합니다. 고객예탁금 총액을 시장별 거래대금 비중으로 배분해 흐름을 추정합니다."
          source={depositSeries.source}
        >
          {loading ? (
            <div className="h-[320px] animate-pulse rounded-3xl bg-slate-100" />
          ) : depositSeries.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={depositSeries.data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                <XAxis dataKey="date" ticks={depositTicks} tickFormatter={formatDateLabel} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tickFormatter={formatDepositInTrillionWon} tick={{ fontSize: 10, fill: '#64748b' }} width={64} label={axisUnitLabel('좌측 Y축 단위: 조원')} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={formatDepositInTrillionWon} tick={{ fontSize: 10, fill: '#64748b' }} width={64} label={rightAxisUnitLabel('우측 Y축 단위: 조원')} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #dbe4f0', borderRadius: 16 }}
                  labelFormatter={formatDateLabel}
                  formatter={value => [`${formatDepositInTrillionWon(value)} 조원`, '']}
                />
                <Legend />
                <Line type="monotone" dataKey="kospi_deposit" name="KOSPI 예탁금" stroke="#0284c7" dot={false} strokeWidth={2} />
                <Line type="monotone" yAxisId="right" dataKey="kosdaq_deposit" name="KOSDAQ 예탁금" stroke="#f97316" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[320px] items-center justify-center rounded-3xl bg-slate-50 text-sm text-slate-500">
              데이터를 가져오지 못했습니다.
            </div>
          )}
        </SupplyChartCard>

        <SupplyChartCard
          title="KOSPI·KOSDAQ 거래대금"
          description="KOSPI 거래대금은 좌측 Y축, KOSDAQ 거래대금은 우측 Y축으로 비교합니다."
          source={amountSeries.source}
        >
          {loading ? (
            <div className="h-[320px] animate-pulse rounded-3xl bg-slate-100" />
          ) : amountSeries.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={amountSeries.data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                <XAxis dataKey="date" ticks={amountTicks} tickFormatter={formatDateLabel} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tickFormatter={formatAmountInTrillionWon} tick={{ fontSize: 10, fill: '#64748b' }} width={72} label={axisUnitLabel('좌측 Y축 단위: 조원')} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={formatAmountInTrillionWon} tick={{ fontSize: 10, fill: '#64748b' }} width={72} label={rightAxisUnitLabel('우측 Y축 단위: 조원')} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #dbe4f0', borderRadius: 16 }}
                  labelFormatter={formatDateLabel}
                  formatter={value => [`${formatAmountInTrillionWon(value)} 조원`, '']}
                />
                <Legend />
                <Line type="monotone" dataKey="kospi_amount" name="KOSPI 거래대금" stroke="#0f766e" dot={false} strokeWidth={2} />
                <Line type="monotone" yAxisId="right" dataKey="kosdaq_amount" name="KOSDAQ 거래대금" stroke="#7c3aed" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[320px] items-center justify-center rounded-3xl bg-slate-50 text-sm text-slate-500">
              데이터를 가져오지 못했습니다.
            </div>
          )}
        </SupplyChartCard>
      </section>
    </div>
  )
}
