import { useEffect, useRef, useState, type FC, type JSX } from 'react'
import ApexCharts from 'apexcharts'
import type { ApexOptions } from 'apexcharts'
import { FaWallet } from 'react-icons/fa'
import { CiMoneyCheck1 } from 'react-icons/ci'
import { MdOutlineBarChart } from 'react-icons/md'
import { SiCountingworkspro } from 'react-icons/si'

type Props = {
  className?: string
  chartColor: string
  chartHeight: string
}

const tabs: { id: 'month' | 'week' | 'day'; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
]

const dataByTab = {
  month: {
    stats: [
      { label: 'Author Services', amount: '₹2,034', color: 'bg-blue-100 text-blue-600', icon: <SiCountingworkspro /> },
      { label: 'Commission', amount: '₹706', color: 'bg-red-100 text-red-600', icon: <CiMoneyCheck1 /> },
      { label: 'Tax Collected', amount: '₹49', color: 'bg-green-100 text-green-600', icon: <MdOutlineBarChart /> },
      { label: 'All Time Services', amount: '₹5.8M', color: 'bg-indigo-100 text-indigo-600', icon: <FaWallet /> },
    ],
    chartData: [30, 25, 45, 30, 55, 55],
  },
  week: {
    stats: [
      { label: 'Author Services', amount: '₹540', color: 'bg-blue-100 text-blue-600', icon: <SiCountingworkspro /> },
      { label: 'Commission', amount: '₹150', color: 'bg-red-100 text-red-600', icon: <CiMoneyCheck1 /> },
      { label: 'Tax Collected', amount: '₹12', color: 'bg-green-100 text-green-600', icon: <MdOutlineBarChart /> },
      { label: 'All Time Services', amount: '₹1.2M', color: 'bg-indigo-100 text-indigo-600', icon: <FaWallet /> },
    ],
    chartData: [10, 15, 20, 12, 18, 22],
  },
  day: {
    stats: [
      { label: 'Author Services', amount: '₹80', color: 'bg-blue-100 text-blue-600', icon: <SiCountingworkspro /> },
      { label: 'Commission', amount: '₹20', color: 'bg-red-100 text-red-600', icon: <CiMoneyCheck1 /> },
      { label: 'Tax Collected', amount: '₹3', color: 'bg-green-100 text-green-600', icon: <MdOutlineBarChart /> },
      { label: 'All Time Services', amount: '₹200k', color: 'bg-indigo-100 text-indigo-600', icon: <FaWallet /> },
    ],
    chartData: [2, 4, 6, 3, 5, 7],
  },
}

const getCSSVariableValue = (variableName: string) => {
  let hex = getComputedStyle(document.documentElement).getPropertyValue(variableName)
  return hex ? hex.trim() : ''
}

const ServiceStatistics: FC<Props> = ({ className = '', chartColor, chartHeight }) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<keyof typeof dataByTab>('month')

  useEffect(() => {
    if (!chartRef.current) return
    const chart = new ApexCharts(chartRef.current, chartOptions(chartColor, chartHeight, dataByTab[activeTab].chartData))
    chart.render()
    return () => { chart.destroy() }
  }, [chartRef, activeTab, chartColor, chartHeight])

  return (
    <div className={`rounded-2xl shadow-md bg-white dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4'>
        <div>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>Service Sales Statistics</h3>
          <p className='text-sm text-gray-500 dark:text-gray-400'>Recent sales statistics</p>
        </div>

        <div className="flex mt-4 md:mt-0 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className='p-6'>
        <div className='grid grid-cols-2 gap-4 mb-6'>
          {dataByTab[activeTab].stats.map((item) => (
            <StatItem key={item.label} color={item.color} icon={item.icon} amount={item.amount} label={item.label} />
          ))}
        </div>
        <div ref={chartRef} className='w-full'></div>
      </div>
    </div>
  )
}

const StatItem: FC<{ color: string; icon: JSX.Element; amount: string; label: string }> = ({ color, icon, amount, label }) => (
  <div className='flex items-center space-x-3'>
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
    <div>
      <div className='text-gray-900 dark:text-white font-semibold text-base'>{amount}</div>
      <div className='text-gray-500 dark:text-gray-400 text-sm'>{label}</div>
    </div>
  </div>
)

const chartOptions = (chartColor: string, chartHeight: string, seriesData: number[]): ApexOptions => {
  const baseColor = getCSSVariableValue('--tw-color-' + chartColor) || '#4f46e5'
  const lightColor = baseColor + '33'
  const labelColor = getCSSVariableValue('--tw-prose-body') || '#6b7280'

  return {
    series: [{ name: 'Services', data: seriesData }],
    chart: { type: 'area', height: chartHeight, toolbar: { show: false }, zoom: { enabled: false }, sparkline: { enabled: true } },
    colors: [baseColor],
    fill: { type: 'solid', opacity: 0.2, colors: [lightColor] },
    stroke: { curve: 'smooth', width: 3, colors: [baseColor] },
    xaxis: { categories: ['Mon','Tue','Wed','Thu','Fri','Sat'], labels: { show: false, style: { colors: labelColor } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { min: 0, max: Math.max(...seriesData) + 10, labels: { show: false, style: { colors: labelColor } } },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (val) => `₹${val}` } },
  }
}

export { ServiceStatistics }
