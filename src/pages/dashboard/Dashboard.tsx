// import React from "react";
// import { EarningCard } from "../../components/EarningCard";
import { ProductStatistics } from "../../components/ProductStatistics";
import { ServiceStatistics } from "../../components/ServiceStatistics";
// import { TopProductVendor } from "../../components/TopProductVendor";
// import { TopServiceVendor } from "../../components/TopServiceVendor";
// import { TopProductList } from "../../components/TopProductList";
// import { TopServiceList } from "../../components/TopServiceList";
import BusinessAnalytics from "../../components/BusinessAnalytics";
import { RecentSales, WebsiteOrders } from "../../components/SalesAnalytics";
import { TransactionAnalytics } from "../../components/TransactionAnalytics";

const Dashboard = () => {
  return (
    <div>
      <div className="mb-5">
        <BusinessAnalytics />
      </div>

      {/* <EarningCard
        className="w-full"
        onFilterChange={(value) => console.log("Filter changed to:", value)}
      /> */}

      <div className="flex flex-col lg:flex-row gap-4 w-full mt-5">
        {/* <ProductStatistics
          className="shadow-lg border border-gray-200 rounded-2xl w-full"
          chartColor="primary"
          chartHeight="200"
        /> */}

        <ServiceStatistics
          className="shadow-lg border border-gray-200 rounded-2xl w-full"
          chartColor="primary"
          chartHeight="200"
        />
      </div>

      <div className=" px-0 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentSales />
        <WebsiteOrders />
      </div>

      <div className=" px-0 py-4  gap-4">
        <TransactionAnalytics/>
        {/* <TopServiceVendor />
        <TopServiceList /> */}
      </div>
    </div>
  );
};

export default Dashboard;
