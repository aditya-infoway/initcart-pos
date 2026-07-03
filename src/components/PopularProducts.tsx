// import React from "react";
import Card from "./Card";

const products = [
  { name: "iPhone 15 Pro", sales: "₹3.2L" },
  { name: "Nike Sneakers", sales: "₹1.5L" },
  { name: "Dell Laptop", sales: "₹90K" },
];

const PopularProducts = () => {
  return (
    <Card title="Most Popular Products">
      <ul className="space-y-2">
        {products.map((p, index) => (
          <li key={index} className="flex justify-between text-sm">
            <span>{p.name}</span>
            <span className="font-semibold text-gray-700">{p.sales}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default PopularProducts;
