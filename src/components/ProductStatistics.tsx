import { useEffect, useRef, useState, type FC, type JSX } from 'react'
import ApexCharts from 'apexcharts'
import type { ApexOptions } from 'apexcharts'
import api from '../api/api'

import { MdOutlineBarChart } from 'react-icons/md'
import { CiMoneyCheck1 } from 'react-icons/ci'
import { FaBagShopping, FaWallet } from 'react-icons/fa6'

type Props = {
  className?: string
  chartColor: string
  chartHeight: string
}

type Stat = {
  label: string
  amount: number
}

type DashboardData = {
  month: { stats: Stat[]; chartData: number[] }
  week: { stats: Stat[]; chartData: number[] }
  day: { stats: Stat[]; chartData: number[] }
}

const tabs: { id: 'month' | 'week' | 'day'; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
]

const getCSSVariableValue = (variableName: string) => {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(variableName)
  return hex ? hex.trim() : ''
}

// 🔹 Updated iconMap and colorMap for Profit
const iconMap: Record<string, JSX.Element> = {
  'Author Sales': <FaBagShopping />,
  'Total Profit': <CiMoneyCheck1 />,
  'Tax Collected': <MdOutlineBarChart />,
  'All Time Sales': <FaWallet />,
}

const colorMap: Record<string, string> = {
  'Author Sales': 'bg-blue-100 text-blue-600',
  'Total Profit': 'bg-red-100 text-red-600',
  'Tax Collected': 'bg-green-100 text-green-600',
  'All Time Sales': 'bg-indigo-100 text-indigo-600',
}

const ProductStatistics: FC<Props> = ({ className = '', chartColor, chartHeight }) => {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<'month' | 'week' | 'day'>('month')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('product-stats/')
        setData(res.data)
      } catch (error) {
        console.error('Dashboard API Error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!chartRef.current || !data) return

    const chart = new ApexCharts(
      chartRef.current,
      chartOptions(chartColor, chartHeight, data[activeTab].chartData)
    )

    chart.render()
    return () => chart.destroy()
  }, [activeTab, data, chartColor, chartHeight])

  return (
    <div className={`rounded-2xl shadow-md bg-white dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Product Sales Statistics
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Recent sales statistics
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all
                ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {data![activeTab].stats.map((item) => (
                <StatItem
                  key={item.label}
                  label={item.label}
                  amount={`${item.amount.toLocaleString('en-IN')}`}
                  icon={iconMap[item.label]}
                  color={colorMap[item.label]}
                />
              ))}
            </div>

            <div ref={chartRef} className="w-full" />
          </>
        )}
      </div>
    </div>
  )
}

const StatItem: FC<{ color: string; icon: JSX.Element; amount: string; label: string }> = ({
  color,
  icon,
  amount,
  label,
}) => (
  <div className="flex items-center space-x-3">
    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <div className="text-gray-900 dark:text-white font-semibold">{amount}</div>
      <div className="text-gray-500 dark:text-gray-400 text-sm">{label}</div>
    </div>
  </div>
)

const chartOptions = (chartColor: string, chartHeight: string, seriesData: number[]): ApexOptions => {
  const baseColor = getCSSVariableValue('--tw-color-' + chartColor) || '#4f46e5'
  const lightColor = baseColor + '33'

  return {
    series: [{ name: 'Sales', data: seriesData }],
    chart: {
      type: 'area',
      height: chartHeight,
      toolbar: { show: false },
      zoom: { enabled: false },
      sparkline: { enabled: true },
    },
    colors: [baseColor],
    fill: { type: 'solid', opacity: 0.2, colors: [lightColor] },
    stroke: { curve: 'smooth', width: 3, colors: [baseColor] },
    xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], labels: { show: false } },
    yaxis: { min: 0, max: Math.max(...seriesData) + 10, labels: { show: false } },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (val) => `${val}` } },
  }
}

export { ProductStatistics }
