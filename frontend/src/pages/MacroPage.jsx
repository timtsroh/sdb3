import MarketPanelGrid from '../components/MarketPanelGrid'

export default function MacroPage() {
  return (
    <MarketPanelGrid
      group="macro"
      badge="Macro"
      panelLabel="Macro Panel"
      title="거시경제 모니터"
      description="금리, 달러, 유가, 변동성, 금 가격을 기간별로 비교합니다. 패널을 드래그하면 순서가 저장되고, 편집에서 전체 항목을 바로 바꿀 수 있습니다."
    />
  )
}
