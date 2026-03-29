import MarketPanelGrid from '../components/MarketPanelGrid'

export default function MarketPage() {
  return (
    <MarketPanelGrid
      group="market"
      badge="Market"
      panelLabel="Market Panel"
      title="시장 모니터"
      description="미국과 한국의 대표 지수 흐름을 기간별로 비교합니다. 기존 거시변수의 주가지수 패널을 이 탭으로 옮겼고, 패널 순서 변경도 저장됩니다."
    />
  )
}
