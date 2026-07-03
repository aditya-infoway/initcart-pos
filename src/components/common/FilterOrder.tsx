import React, { useState } from "react";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterOrderProps {
  title?: string;
  orderTypes?: FilterOption[];
  stores?: FilterOption[];
  customers?: FilterOption[];
  onApply: (filters: FilterState) => void;
  onReset?: () => void;
}

export interface FilterState {
  orderType: string;
  store: string;
  customer: string;
  dateType: string;
  startDate?: string;
  endDate?: string;
}

const FilterOrder: React.FC<FilterOrderProps> = ({
  title = "Filter Order",
  orderTypes = [],
  stores = [],
  customers = [],
  onApply,
  onReset,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    orderType: orderTypes[0]?.value || "",
    store: stores[0]?.value || "",
    customer: customers[0]?.value || "",
    dateType: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    const resetFilters = {
      orderType: orderTypes[0]?.value || "",
      store: stores[0]?.value || "",
      customer: customers[0]?.value || "",
      dateType: "",
      startDate: "",
      endDate: "",
    };
    setFilters(resetFilters);
    onReset?.();
  };

  const handleSubmit = () => {
    onApply(filters);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-800 mb-4">{title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Order Type */}
        <div>
          <label className="block text-gray-600 text-sm font-medium mb-1">
            Order type
          </label>
          <select
            name="orderType"
            value={filters.orderType}
            onChange={handleChange}
            className="customInput cursor-pointer"
          >
            {orderTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Store */}
        <div>
          <label className="block text-gray-600 text-sm font-medium mb-1">
            Store
          </label>
          <select
            name="store"
            value={filters.store}
            onChange={handleChange}
            className="customInput cursor-pointer"
          >
            {stores.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Customer */}
        <div>
          <label className="block text-gray-600 text-sm font-medium mb-1">
            Customer
          </label>
          <select
            name="customer"
            value={filters.customer}
            onChange={handleChange}
            className="customInput cursor-pointer"
          >
            {customers.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Type */}
        <div>
          <label className="block text-gray-600 text-sm font-medium mb-1">
            Date type
          </label>
          <select
            name="dateType"
            value={filters.dateType}
            onChange={handleChange}
            className="customInput cursor-pointer"
          >
            <option value="">Select Date Type</option>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="date">Date</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {/* Dynamic Date Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {filters.dateType === "year" && (
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Year
            </label>
            <input
              type="number"
              name="startDate"
              placeholder="Enter year (e.g. 2025)"
              className="customInput cursor-pointer"
              value={filters.startDate || ""}
              onChange={handleChange}
            ></input>
          </div>
        )}

        {filters.dateType === "month" && (
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Month
            </label>
            <input
              type="month"
              name="startDate"
              className="customInput cursor-pointer"
              value={filters.startDate || ""}
              onChange={handleChange}
            />
          </div>
        )}

        {filters.dateType === "date" && (
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-1">
              Date
            </label>
            <input
              type="date"
              name="startDate"
              className="customInput cursor-pointer"
              value={filters.startDate || ""}
              onChange={handleChange}
            />
          </div>
        )}

        {filters.dateType === "custom" && (
          <>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1">
                From Date
              </label>
              <input
                type="date"
                name="startDate"
                className="customInput cursor-pointer"
                value={filters.startDate || ""}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-1">
                To Date
              </label>
              <input
                type="date"
                name="endDate"
                className="customInput cursor-pointer"
                min={filters.startDate}
                disabled={!filters.startDate}
                value={filters.endDate || ""}
                onChange={handleChange}
              />
            </div>
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end mt-6 gap-2">
        <button
          onClick={handleReset}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-medium cursor-pointer"
        >
          Reset
        </button>
        <button
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium cursor-pointer"
        >
          Show data
        </button>
      </div>
    </div>
  );
};

export default FilterOrder;
