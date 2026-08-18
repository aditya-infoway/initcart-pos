// src/pages/employees/EmployeeForm.tsx
import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/api";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const departmentOptions = [
  { value: "purchase", label: "Purchase Department" },
  { value: "sales", label: "Sales Department" },
  { value: "accounting", label: "Accounting Department" },
];

const EmployeeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [initialValues, setInitialValues] = useState({
    full_name: "", mobile: "", email: "", password: "", city: "", address: "", department: "",
  });

  // ── Edit mode: existing employee data fetch karo ──
  useEffect(() => {
    if (!isEditMode) return;

    const fetchEmployee = async () => {
      setLoading(true);
      try {
        const res = await api.get(`employees/${id}/`);
        const emp = res.data.data;
        setInitialValues({
          full_name: emp.full_name || "",
          mobile: emp.mobile || "",
          email: emp.email || "",
          password: "", // password kabhi pre-fill nahi hota, khaali hi rehta hai
          city: emp.city || "",
          address: emp.address || "",
          department: emp.department || "",
        });
      } catch (err) {
        toast.error("Failed to load employee data");
        navigate("/Employees");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [id, isEditMode, navigate]);

  const validationSchema = Yup.object({
    full_name: Yup.string().required("Full name is required"),
    mobile: Yup.string().matches(/^[0-9]{10}$/, "Mobile must be 10 digits").required("Mobile is required"),
    email: Yup.string().email("Invalid email").required("Login email is required"),
    password: isEditMode
      ? Yup.string().min(6, "Password must be at least 6 characters") // edit: optional
      : Yup.string().min(6, "Password must be at least 6 characters").required("Password is required"), // create: required
    city: Yup.string(),
    address: Yup.string(),
    department: Yup.string().required("Department is required"),
  });

  const formik = useFormik({
    initialValues,
    validationSchema,
    enableReinitialize: true, // fetched data aane ke baad form values refresh ho
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (isEditMode) {
          // Edit: email field backend update serializer me allowed nahi hai, isliye mat bhejo
          const payload: any = {
            full_name: values.full_name,
            mobile: values.mobile,
            city: values.city,
            address: values.address,
            department: values.department,
          };
          if (values.password) {
            payload.password = values.password;
          }
          await api.patch(`employees/${id}/`, payload);
          toast.success("Employee updated successfully ✅");
        } else {
          await api.post("employees/", values);
          toast.success("Employee created successfully ✅");
        }
        navigate("/allEmployees");
      } catch (err: any) {
        const msg =
          err.response?.data?.email?.[0] ||
          err.response?.data?.mobile?.[0] ||
          err.response?.data?.message ||
          (isEditMode ? "Failed to update employee" : "Failed to create employee");
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6">
          {isEditMode ? "Edit Employee" : "Create Employee"}
        </h1>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Full Name *</label>
            <input name="full_name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={formik.values.full_name} onChange={formik.handleChange} onBlur={formik.handleBlur} />
            {formik.touched.full_name && formik.errors.full_name && <div className="text-red-500 text-xs mt-1">{formik.errors.full_name}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Mobile No. *</label>
              <input name="mobile" maxLength={10} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={formik.values.mobile} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              {formik.touched.mobile && formik.errors.mobile && <div className="text-red-500 text-xs mt-1">{formik.errors.mobile}</div>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Login Email (Gmail) *</label>
              <input
                name="email"
                type="email"
                disabled={isEditMode} // ✅ login email edit mode me change nahi hoti (backend bhi allow nahi karta)
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm ${isEditMode ? "bg-gray-100 cursor-not-allowed" : ""}`}
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.email && formik.errors.email && <div className="text-red-500 text-xs mt-1">{formik.errors.email}</div>}
              {isEditMode && <div className="text-gray-400 text-xs mt-1">Login email can not change</div>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
              {isEditMode ? "New Password (optional)" : "Password *"}
            </label>
            <div className="relative">
              <input name="password" type={showPassword ? "text" : "password"}
                placeholder={isEditMode ? "leave blank if not changed" : ""}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm"
                value={formik.values.password} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
                onClick={() => setShowPassword((p) => !p)}>
                {showPassword ? <FaEye /> : <FaEyeSlash />}
              </div>
            </div>
            {formik.touched.password && formik.errors.password && <div className="text-red-500 text-xs mt-1">{formik.errors.password}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">City</label>
              <input name="city" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={formik.values.city} onChange={formik.handleChange} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Department *</label>
              <select name="department" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                value={formik.values.department} onChange={formik.handleChange} onBlur={formik.handleBlur}>
                <option value="">Select Department</option>
                {departmentOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              {formik.touched.department && formik.errors.department && <div className="text-red-500 text-xs mt-1">{formik.errors.department}</div>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Address</label>
            <textarea name="address" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={formik.values.address} onChange={formik.handleChange} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={formik.isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {formik.isSubmitting ? "Saving..." : isEditMode ? "Update Employee" : "Create Employee"}
            </button>
            <button type="button" onClick={() => navigate("/allEmployees")}
              className="flex-1 bg-gray-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-600">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;