import { useState, useEffect } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import MainButton from "../../components/common/MainButton";
import { IoMdCart } from "react-icons/io";
import { motion } from "framer-motion";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";

const Login = () => {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const navigate = useNavigate();
  const { login, loading, error, clearError, setPrefixes } = useAuthStore();

  // Clear error when component mounts
  useEffect(() => {
    clearError();
  }, []);

  // Show error toast if there's an error
  useEffect(() => {
    if (error) {
      if (error.includes("already login")) {
        toast.warning(error, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          theme: "colored",
          style: { backgroundColor: "#fff4e5", color: "#9c640c", border: "1px solid #ffdd99" },
        });
      } else if (error.includes("not active")) {
        toast.error("Your branch account is inactive. Please contact support.", { position: "top-right" });
      } else if (error.includes("not found")) {
        toast.error("Branch not found. Please check your credentials.", { position: "top-right" });
      } else if (error.includes("Invalid credentials")) {
        toast.error("Invalid email/phone or password.", { position: "top-right" });
      } else {
        toast.error(error, { position: "top-right" });
      }
    }
  }, [error]);

  const formik = useFormik({
    initialValues: {
      identifier: "",
      password: "",
    },
    validationSchema: Yup.object({
      identifier: Yup.string()
        .required("Email or Phone is required")
        .test(
          "is-valid-identifier",
          "Enter a valid email or phone number",
          (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^(\+\d{1,3})?\d{10}$/;
            return emailRegex.test(value) || phoneRegex.test(value);
          }
        ),
      password: Yup.string()
        .required("Password is Required")
        .min(6, "Password must be at least 6 characters"),
    }),
    onSubmit: async (values) => {
      try {
        const response = await login(values.identifier, values.password);
        
        if (response.accessToken) {
          sessionStorage.setItem("accessToken", response.accessToken);
        }

        if (response.prefixes) {
          setPrefixes(response.prefixes);
          sessionStorage.setItem(
            "prefixes",
            JSON.stringify(response.prefixes)
          );
        }
        
        // ✅ Sirf branch exist karta hai tabhi settings post karo (Super Admin ke liye skip)
        if (response.branch?.id && response.prefixes) {
          await api.post(
            `settings/`, 
            {
              branch_id: response.branch.id,   
              ...response.prefixes             
            },
            {
              headers: { Authorization: `Bearer ${response.accessToken}` },
            }
          );
        }
        
        if (response.gst_toggle !== undefined) {
          sessionStorage.setItem("gst_toggle", response.gst_toggle ? "1" : "0");
        }
        
        // ✅ Branch name optional - Super admin ke liye generic message
        const welcomeMessage = response.branch?.branch_name 
          ? `Welcome to ${response.branch.branch_name}`
          : "Welcome Super Admin";
        
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="font-bold text-green-800"> Login Successful!</div>
            <div className="text-sm text-green-700">
              {welcomeMessage}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Redirecting to dashboard...
            </div>
          </div>,
          {
            position: "top-right",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            closeButton: true,
            draggable: true,
            theme: "colored",
            style: {
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534'
            }
          }
        );

        // Wait for toast to show then redirect
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } catch (err) {
        // Error already shown by store
        console.error("Login failed:", err);
      }
    },
  });

  // Get custom error message
  const getCustomErrorMessage = () => {
    if (error?.includes("not active")) {
      return "Your branch account is inactive. Please contact support.";
    }
    if (error?.includes("not found")) {
      return "Branch not found. Please check your credentials.";
    }
    if (error?.includes("Invalid credentials")) {
      return "Invalid email/phone or password.";
    }
    return error;
  };

  return (
    <div className="flex w-full" style={{ height: "100svh" }}>
      {/* Left Side - Branding */}
      <div className="hidden lg:flex w-[55%] relative p-5 lg:p-10 bg-gradient-to-br from-[#0165ff] to-[#0053cf] overflow-hidden">
        <div className="relative z-10 text-white flex flex-col justify-center h-full gap-6">
          <motion.h1
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-4xl font-bold"
          >
            Welcome to POS Panel
          </motion.h1>
          <motion.p
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-lg text-gray-200"
          >
            Manage sales, inventory, and transactions seamlessly.
          </motion.p>
        </div>

        {/* Decorative Circles */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="absolute -top-10 -left-10 w-40 h-40 bg-white opacity-10 rounded-full"
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, duration: 1 }}
          className="absolute -bottom-10 -right-20 w-60 h-60 bg-white opacity-10 rounded-full"
        />
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-[45%] p-5 lg:p-10 flex flex-col justify-center gap-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-20"
        >
          {/* Header */}
          <div className="text-center flex flex-col gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-center gap-2"
            >
              <div className="bg-gradient-to-br from-[#0165ff] to-[#004bb5] rounded-full p-2 shadow-[4px_4px_10px_rgba(0,0,0,0.3), -4px_-4px_10px_rgba(255,255,255,0.2)] transform transition-transform duration-300">
                <IoMdCart color="white" size={22} />
              </div>
              <div className="font-bold text-xl">Ecommerce</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-2"
            >
              <div className="font-heading font-bold text-[38px]">
                Welcome Back
              </div>
              <div className="text-gray-500 text-lg">
                Please login to your account
              </div>
            </motion.div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{getCustomErrorMessage()}</span>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <form
              onSubmit={formik.handleSubmit}
              className="flex flex-col gap-5"
            >
              {/* Email/Phone Input */}
              <div>
                <input
                  type="text"
                  className={`${formik.touched.identifier && formik.errors.identifier
                    ? "customInputError"
                    : "customInput"
                    }`}
                  placeholder="Email address or Phone number"
                  name="identifier"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.identifier}
                  disabled={loading}
                />
                {formik.touched.identifier && formik.errors.identifier ? (
                  <div className="text-red-500 text-sm mt-1 ms-2">
                    {formik.errors.identifier}
                  </div>
                ) : null}
              </div>

              {/* Password Input */}
              <div>
                <div className="relative">
                  <input
                    type={!showPassword ? "password" : "text"}
                    className={`${formik.touched.password && formik.errors.password
                      ? "customInputError"
                      : "customInput"
                      }`}
                    style={{ paddingRight: "50px" }}
                    placeholder="Password"
                    name="password"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.password}
                    disabled={loading}
                  />
                  <div
                    onClick={() => !loading && setShowPassword((prev) => !prev)}
                    className={`absolute right-4 top-[50%] transform -translate-y-1/2 cursor-pointer transition-colors duration-300 ${loading ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-900"
                      }`}
                  >
                    {showPassword ? (
                      <FaEye size={19} />
                    ) : (
                      <FaEyeSlash size={19} />
                    )}
                  </div>
                </div>
                {formik.touched.password && formik.errors.password ? (
                  <div className="text-red-500 text-sm mt-1 ms-2">
                    {formik.errors.password}
                  </div>
                ) : null}
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-300 disabled:text-gray-400 disabled:cursor-not-allowed"
                  onClick={() => {
                    toast.info("Please contact admin to reset your password", {
                      position: "top-right",
                    });
                  }}
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>

        {/* Login Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="select-none cursor-pointer"
        >
          <MainButton
            text={loading ? "Logging in..." : "Login"}
            loading={loading}
            disabled={!formik.isValid || loading}
            submit={() => formik.handleSubmit()}
            className="hover:scale-103 transition-transform duration-300"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default Login;