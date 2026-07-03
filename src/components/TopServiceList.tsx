import { type FC } from "react"

type Props = {
  className?: string
}

const services = [
  { id: 1, name: "Haircut & Styling", customers: 120, trend: "+10%" },
  { id: 2, name: "Barber Services", customers: 80, trend: "-5%" },
  { id: 3, name: "Manicure & Pedicure", customers: 95, trend: "+8%" },
  { id: 4, name: "Massage Therapy", customers: 110, trend: "+12%" },
  { id: 5, name: "Yoga & Pilates Classes", customers: 60, trend: "-2%" },
  { id: 6, name: "Personal Training", customers: 70, trend: "+5%" },
  { id: 7, name: "Home Cleaning", customers: 85, trend: "+3%" },
  { id: 8, name: "Plumbing Services", customers: 50, trend: "-8%" },
  { id: 9, name: "Electrical Repairs", customers: 65, trend: "+6%" },
  { id: 10, name: "Gardening & Landscaping", customers: 75, trend: "+4%" },
]

const TopServiceList: FC<Props> = ({ className = "" }) => {
  return (
    <div
      className={`backdrop-blur-md bg-gradient-to-br from-white/90 to-gray-50/90 
        dark:from-gray-900/80 dark:to-gray-800/80 
        rounded-2xl shadow-lg border border-gray-100/60 dark:border-gray-700/60 
        p-6 transition-all duration-300 hover:shadow-xl ${className}`}
    >
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Top Services
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Based on customer consumption
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 text-sm border-b border-gray-100 dark:border-gray-700">
              <th className="py-3 font-medium">Service</th>
              <th className="py-3 font-medium">Customers</th>
              <th className="py-3 font-medium text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr
                key={service.id}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
              >
                <td className="py-4 font-semibold text-gray-900 dark:text-gray-100">
                  {service.name}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {service.customers}
                </td>
                <td
                  className={`py-4 text-right font-semibold ${
                    service.trend.startsWith("+")
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {service.trend}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { TopServiceList }
