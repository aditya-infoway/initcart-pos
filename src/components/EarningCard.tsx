import { useEffect, useRef, useState, type FC } from "react"

type Props = {
    className: string
    chartSize?: number
    chartLine?: number
    chartRotate?: number
    onFilterChange?: (value: string) => void
}

const EarningCard: FC<Props> = ({
    className,
    chartSize = 70,
    chartLine = 11,
    chartRotate = 145,
    onFilterChange,
}) => {
    const chartRef = useRef<HTMLDivElement | null>(null)
    const [filter, setFilter] = useState<string>("Overall")

    useEffect(() => {
        refreshChart()
    }, [filter])

    const refreshChart = () => {
        if (!chartRef.current) return
        setTimeout(() => {
            initChart(chartSize, chartLine, chartRotate)
        }, 10)
    }

    const handleFilterChange = (value: string) => {
        setFilter(value)
        onFilterChange?.(value)
    }

    return (
        <div className={`bg-white shadow-sm rounded-lg ${className}`}>
            <div className="flex justify-between items-start px-6 pt-5">
                {/* Left: Earnings Info */}
                <div className="flex flex-col">
                    <div className="flex items-start">
                        <span className="text-gray-500 text-base font-semibold leading-none mr-1 mt-1">₹</span>
                        <span className="text-4xl font-bold text-gray-900 mr-2 leading-tight">69,700</span>
                    </div>
                    <span className="text-gray-500 pt-1 font-semibold">
                        Earnings {filter}
                    </span>
                </div>

                {/* Right: Filter Dropdown */}
                <div className="relative">
                    <select
                        value={filter}
                        onChange={(e) => handleFilterChange(e.target.value)}
                        className="text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        <option value="Overall">Overall</option>
                        <option value="Today">Today</option>
                        <option value="This Month">This Month</option>
                    </select>
                </div>
            </div>

            {/* Chart & Breakdown */}
            <div className="px-6 pt-2 pb-4 flex flex-wrap items-center">
                {/* <div className="flex justify-center items-center mr-5 pt-2">
                    <div
                        id="kt_card_widget_17_chart"
                        ref={chartRef}
                        style={{ minWidth: `${chartSize}px`, minHeight: `${chartSize}px` }}
                        data-kt-size={chartSize}
                        data-kt-line={chartLine}
                    ></div>
                </div> */}

                <div className="flex flex-col justify-center flex-1 space-y-3 mt-2 md:mt-0">
                    <div className="flex items-center font-semibold">
                        <div className="w-2 h-1 rounded bg-green-500 mr-3"></div>
                        <div className="text-gray-500 flex-grow mr-4">Product</div>
                        <div className="font-bold text-gray-700 text-right">₹7,660</div>
                    </div>

                    <div className="flex items-center font-semibold">
                        <div className="w-2 h-1 rounded bg-blue-500 mr-3"></div>
                        <div className="text-gray-500 flex-grow mr-4">Service</div>
                        <div className="font-bold text-gray-700 text-right">₹2,820</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const initChart = function (
    chartSize: number = 70,
    chartLine: number = 11,
    chartRotate: number = 145
) {
    const el = document.getElementById('kt_card_widget_17_chart')
    if (!el) return

    el.innerHTML = ''

    const options = { size: chartSize, lineWidth: chartLine, rotate: chartRotate }
    const canvas = document.createElement('canvas')
    const span = document.createElement('span')
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.height = options.size

    el.appendChild(span)
    el.appendChild(canvas)
    ctx?.translate(options.size / 2, options.size / 2)
    ctx?.rotate((-1 / 2 + options.rotate / 180) * Math.PI)

    const radius = (options.size - options.lineWidth) / 2

    const drawCircle = (color: string, lineWidth: number, percent: number) => {
        percent = Math.min(Math.max(0, percent || 1), 1)
        if (!ctx) return
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2 * percent, false)
        ctx.strokeStyle = color
        ctx.lineCap = 'round'
        ctx.lineWidth = lineWidth
        ctx.stroke()
    }

    drawCircle('#E4E6EF', options.lineWidth, 1)
}

export { EarningCard }
