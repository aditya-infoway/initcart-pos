import React from "react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, className }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-white rounded-2xl shadow-md p-4 hover:shadow-lg transition ${className}`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h4 className="text-gray-500 text-sm font-medium">{title}</h4>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
};

export default DashboardCard;
