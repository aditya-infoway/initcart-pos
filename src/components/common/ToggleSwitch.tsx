import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-8 w-15 items-center rounded-full transition-colors duration-300 shadow-md focus:outline-none ${
        checked
          ? "bg-blue-500 hover:bg-blue-600"
          : "bg-red-500 hover:bg-red-600"
      }`}
    >
      <span
        className={`absolute ${
          checked ? "left-1" : "left-0"
        }  flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-white transition-transform duration-300 shadow-md ${
          checked ? "translate-x-7 text-blue-500" : "translate-x-1 text-red-500"
        }`}
      ></span>
    </button>
  );
};

export default ToggleSwitch;
