// import React from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai"; // You can use react-icons spinner

interface ButtonProps {
  text: string;
  loading?: boolean;
  disabled?: boolean;
  submit: () => void;
  className?: string;
}

const MainButton = ({
  text,
  loading = false,
  disabled = false,
  submit,
  className = "",
}: ButtonProps) => {
  const isDisabled = disabled || loading; // Disable button when loading

  return (
    <button
      type="button"
      onClick={() => !isDisabled && submit()}
      disabled={isDisabled}
      className={`
        customBtn
        flex items-center justify-center gap-2
        rounded-lg w-full p-3 font-semibold text-white transition-all duration-300
        ${isDisabled ? "bg-gray-400 shadow-none cursor-not-allowed" : "bg-[#0165ff] hover:scale-105 shadow-lg"}
        ${className}
      `}
    >
      {loading && (
        <AiOutlineLoading3Quarters className="animate-spin text-white" size={18} />
      )}
      <span>{loading ? "Loading..." : text}</span>
    </button>
  );
};

export default MainButton;
