import React from "react";

interface WalletCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

const WalletCard: React.FC<WalletCardProps> = ({ title, value, icon }) => {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition">
      <div>
        <h4 className="text-gray-500 text-sm font-medium">{title}</h4>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
      <div className="text-4xl text-blue-500">{icon}</div>
    </div>
  );
};

export default WalletCard;
