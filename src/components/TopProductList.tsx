import { type FC } from "react"
import { toAbsoluteUrl } from "../utils/reuseable"

type Props = {
    className?: string
}

const products = [
    {
        img: "media/images/macbook.jpg",
        name: "MacBook Pro M3",
        category: "Electronics",
        vendor: "Aditya Infoway",
        price: "₹1,45,000",
        sales: "320",
        trend: "+12%",
    },
    {
        img: "media/images/nikeairmax.jpg",
        name: "Nike Air Max",
        category: "Footwear",
        vendor: "ShoeMart",
        price: "₹9,999",
        sales: "210",
        trend: "+7%",
    },
    {
        img: "media/images/oneplus12.jpg",
        name: "OnePlus 12",
        category: "Mobiles",
        vendor: "MobileHub",
        price: "₹59,999",
        sales: "400",
        trend: "+15%",
    },
    {
        img: "media/images/applewatchultra.jpg",
        name: "Apple Watch Ultra",
        category: "Wearables",
        vendor: "TechWorld",
        price: "₹89,000",
        sales: "150",
        trend: "-3%",
    },
    {
        img: "media/images/adidas tshirt.jpg",
        name: "Adidas T-Shirt",
        category: "Apparel",
        vendor: "Aditya Infoway",
        price: "₹2,499",
        sales: "290",
        trend: "+5%",
    },
]

const TopProductList: FC<Props> = ({ className = "" }) => {
    return (
        <div
            className={`backdrop-blur-md bg-gradient-to-br from-white/90 to-gray-50/90 
        dark:from-gray-900/80 dark:to-gray-800/80 
        rounded-2xl shadow-lg border border-gray-100/60 dark:border-gray-700/60 
        p-6 transition-all duration-300 hover:shadow-xl ${className}`}
        >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    Top Selling Product
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    Based on recent sales
                </span>
            </div>

            <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-500 dark:text-gray-400 text-sm border-b border-gray-100 dark:border-gray-700">
                            <th className="py-3"></th>
                            <th className="py-3 font-medium">Product</th>
                            {/* <th className="py-3 font-medium">Category</th> */}
                            <th className="py-3 font-medium">Vendor</th>
                            {/* <th className="py-3 font-medium">Price</th> */}
                            <th className="py-3 font-medium">Sales</th>
                            {/* <th className="py-3 font-medium text-right">Trend</th> */}
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((item, i) => (
                            <tr
                                key={i}
                                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
                            >
                                <td className="py-4 pr-3">
                                    <img
                                        src={toAbsoluteUrl(item.img)}
                                        alt={item.name}
                                        className="h-14 w-14 rounded-md bg-gray-50 dark:bg-gray-700 p-1"
                                    />
                                </td>
                                <td className="py-4 font-semibold text-gray-900 dark:text-gray-100">
                                    {item.name}
                                </td>
                                {/* <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.category}
                </td> */}
                                <td className="py-4 text-gray-700 dark:text-gray-300">
                                    {item.vendor}
                                </td>
                                {/* <td className="py-4 text-gray-800 dark:text-gray-200">
                  {item.price}
                </td> */}
                                <td className="py-4 text-gray-700 dark:text-gray-300">
                                    {item.sales}
                                </td>
                                {/* <td
                  className={`py-4 text-right font-semibold ${
                    item.trend.startsWith("+")
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {item.trend}
                </td> */}
                                <td className="py-4 text-right text-gray-400 group-hover:text-blue-500 transition">
                                    →
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export { TopProductList }
