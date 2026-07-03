import React from "react";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </div>
  );
};

export default Card;
