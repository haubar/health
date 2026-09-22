<script setup lang="ts">
import type { DashboardRange } from '@health/shared'
import type { TooltipComponentOption } from 'echarts/components'
import type { ECharts } from 'echarts/core'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

type ChartKind = 'bar' | 'line'
type ChartPoint = { label: string; value: number }

const props = defineProps<{
  title: string
  range: DashboardRange
  points: ChartPoint[]
  unit: string
  kind?: ChartKind
  timeScale?: boolean
  showPoints?: boolean
}>()

const element = ref<HTMLDivElement | null>(null)
let chart: ECharts | undefined
let echartsCore: typeof import('echarts/core') | undefined
let loadingChart: Promise<void> | undefined

async function loadChart() {
  if (loadingChart) return loadingChart
  loadingChart = (async () => {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ])
    core.use([
      charts.BarChart,
      charts.LineChart,
      components.GridComponent,
      components.TooltipComponent,
      renderers.CanvasRenderer,
    ])
    echartsCore = core
  })()
  await loadingChart
}

async function renderChart() {
  if (!element.value || props.points.length === 0) return
  await loadChart()
  if (!element.value || !echartsCore) return
  chart ??= echartsCore.init(element.value)
  chart.setOption({
    animation: false,
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] : params
        if (!item || typeof item !== 'object' || !('value' in item)) return ''
        const raw = item.value
        const value = Array.isArray(raw) ? raw[1] : raw
        const label = Array.isArray(raw) && typeof raw[0] === 'number'
          ? new Date(raw[0]).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
          : 'axisValueLabel' in item ? String(item.axisValueLabel) : ''
        return `${label} · ${String(value)} ${props.unit}`
      },
    } satisfies TooltipComponentOption,
    xAxis: {
      type: props.timeScale ? 'time' : 'category',
      ...(props.timeScale ? {} : { data: props.points.map((point) => point.label) }),
      axisLabel: { color: '#84948f' },
      axisLine: { lineStyle: { color: '#2a383d' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#84948f' },
      splitLine: { lineStyle: { color: '#223036' } },
    },
    series: [
      {
        type: props.kind ?? 'line',
        data: props.timeScale
          ? props.points.map((point) => [Date.parse(`${point.label}T00:00:00Z`), point.value])
          : props.points.map((point) => point.value),
        smooth: props.kind !== 'bar',
        showSymbol: props.showPoints ?? false,
        symbolSize: props.showPoints ? 7 : 0,
        itemStyle: { color: '#82f0c4' },
        lineStyle: { color: '#82f0c4', width: 3 },
        areaStyle: props.kind === 'line' ? { color: 'rgba(130, 240, 196, .12)' } : undefined,
      },
    ],
  })
}

function resizeChart() {
  chart?.resize()
}

onMounted(() => {
  if (props.points.length > 0) void renderChart()
  window.addEventListener('resize', resizeChart)
})
watch(() => [props.points, props.range], () => void renderChart(), { deep: true })
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})
</script>

<template>
  <article v-if="points.length" class="chart-card">
    <h2>{{ title }}</h2>
    <div ref="element" class="trend-chart" role="img" :aria-label="`${title}圖表`"></div>
  </article>
</template>
