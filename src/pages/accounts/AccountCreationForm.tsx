import { useEffect, useState } from "react";
import { Formik, Form, Field, ErrorMessage, useField } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { 
  MdArrowBack, 
  MdSave, 
  MdDelete, 
  MdCancel,
  MdDashboard,
  MdLocationOn,
  MdGavel,
  MdPerson,
  MdPhone,
  MdPhoneAndroid,
  MdPinDrop,
  MdAccountBalance,
  MdBusiness,
  MdPublic,
  MdMap,
  MdLocationCity,
  MdEmail,
  MdDateRange,
  MdCreditCard
} from "react-icons/md";
import { toast } from "react-toastify";
import { Country, State, City } from "country-state-city";

const groups = ["Customer", "Supplier", "Bank Account", "Case In Hand","Customer - Sundry Debitor", "Supplier - Sundry Creditor","Sundry Debitor(Internal)","Sundry Creditor(Internal)","Sundry Creditor(Main)"];

// --- Validation Schema with Yup ---
const validationSchema = Yup.object({
  accountName: Yup.string()
    .required("Account Name is required")
    .max(100, "Must be 100 characters or less"),
  group: Yup.string().required("Group is required"),
  openingBalance: Yup.number()
    .typeError("Must be a number")
    .min(0, "Must be non-negative"),
  drcr: Yup.string().required("Dr./Cr. selection is required"),
  mobile: Yup.string().matches(/^[0-9]{10}$/, {
    message: "Mobile number must be 10 digits",
    excludeEmptyString: true,
  }),
  pincode: Yup.string().matches(/^[0-9]{6}$/, {
    message: "Pincode must be 6 digits",
    excludeEmptyString: true,
  }),
  gstNo: Yup.string().matches(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    {
      message: "Invalid GST No. format",
      excludeEmptyString: true,
    }
  ),
  email: Yup.string().email("Invalid email address"),
  panCard: Yup.string().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: "Invalid PAN Card format",
    excludeEmptyString: true, 
  }),
});

const FormInput = ({ label, icon: Icon, ...props }: any) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <input
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2 border ${
            isInvalid 
              ? "border-red-400 focus:ring-red-400 focus:border-red-400" 
              : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          } rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-white`}
          {...field}
          {...props}
        />
      </div>
      {isInvalid && (
        <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
          
          {meta.error}
        </div>
      )}
    </div>
  );
};

// Custom Select Component
const FormSelect = ({ label, options, icon: Icon, ...props }: any) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-4 w-4 text-gray-400" />
          </div>
        )}
        <select
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2 border ${
            isInvalid 
              ? "border-red-400 focus:ring-red-400 focus:border-red-400" 
              : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          } rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-white appearance-none`}
          {...field}
          {...props}
        >
          <option value="">Select {label}</option>
          {options.map((opt: any) => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      </div>
      {isInvalid && (
        <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
         
          {meta.error}
        </div>
      )}
    </div>
  );
};

// --- Main Form Component ---
const AccountCreationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  const [initialValues, setInitialValues] = useState({
    accountName: "",
    group: "",
    openingBalance: "",
    drcr: "Dr",
    address: "",
    country: "",
    state: "",
    city: "",
    email:"",
    pincode: "",
    phone: "",
    mobile: "",
    gstNo: "",
    panCard: "",
  });

  // ─── isoCode ↔ full-name conversion helpers ──────────────────────────
  // Dropdown ke andar hum isoCode use karte hain (cascading ke liye zaroori hai),
  // lekin backend me Branch ke format se match karne ke liye full name save karna hai.
  const countryNameToCode = (name: string): string => {
    if (!name) return "";
    const found = Country.getAllCountries().find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );
    return found?.isoCode || "";
  };

  const stateNameToCode = (countryCode: string, name: string): string => {
    if (!countryCode || !name) return "";
    const found = State.getStatesOfCountry(countryCode).find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    return found?.isoCode || "";
  };

  // Load countries on component mount
  useEffect(() => {
    const allCountries = Country.getAllCountries();
    setCountries(allCountries.map(country => ({
      value: country.isoCode,
      label: country.name
    })));
  }, []);

  // Check if we're in edit mode
  useEffect(() => {
    const editData = location.state?.accountData;
    if (id || editData) {
      setIsEditMode(true);
if (editData) {
        // Backend se full names aate hain (jaise "India", "Gujarat") —
        // dropdown ke liye unhe isoCode me convert karo
        const countryCode = countryNameToCode(editData.country);
        const stateCode = stateNameToCode(countryCode, editData.state);

        setInitialValues({
          accountName: editData.account_name || "",
          group: editData.group || "",
          openingBalance: editData.opening_balance?.toString() || "",
          drcr: editData.drcr || "Dr",
          address: editData.address || "",
          country: countryCode,
          state: stateCode,
          city: editData.city || "",
          email: editData.email || "",   
          pincode: editData.pincode || "",
          phone: editData.phone || "",
          mobile: editData.mobile || "",
          gstNo: editData.gst_no || "",
          panCard: editData.pan_card || "",
        });
        
        if (countryCode) {
          const countryStates = State.getStatesOfCountry(countryCode);
          setStates(countryStates.map(state => ({
            value: state.isoCode,
            label: state.name
          })));
        }
        
        if (countryCode && stateCode) {
          const stateCities = City.getCitiesOfState(countryCode, stateCode);
          setCities(stateCities.map(city => ({
            value: city.name,
            label: city.name
          })));
        }
      } else if (id) {
        fetchAccountData(id);
      }
    }
  }, [id, location.state]);

  // ✅ NEW — Stock Verification page se redirect hone par group auto pre-fill
  useEffect(() => {
    const presetGroup = (location.state as any)?.presetGroup;
    if (presetGroup && !id && !location.state?.accountData) {
      setInitialValues(prev => ({ ...prev, group: presetGroup }));
    }
  }, [location.state]);

  const fetchAccountData = async (accountId: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await api.get(`account/${accountId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
const data = res.data;

      // Backend se full names aate hain — dropdown ke liye isoCode me convert karo
      const countryCode = countryNameToCode(data.country);
      const stateCode = stateNameToCode(countryCode, data.state);

      setInitialValues({
        accountName: data.account_name || "",
        group: data.group || "",
        openingBalance: data.opening_balance?.toString() || "",
        drcr: data.drcr || "Dr",
        address: data.address || "",
        country: countryCode,
        state: stateCode,
        city: data.city || "",
        email: data.email || "",  
        pincode: data.pincode || "",
        phone: data.phone || "",
        mobile: data.mobile || "",
        gstNo: data.gst_no || "",
        panCard: data.pan_card || "",
      });
      
      if (countryCode) {
        const countryStates = State.getStatesOfCountry(countryCode);
        setStates(countryStates.map(state => ({
          value: state.isoCode,
          label: state.name
        })));
        if (stateCode) {
          const stateCities = City.getCitiesOfState(countryCode, stateCode);
          setCities(stateCities.map(city => ({
            value: city.name,
            label: city.name
          })));
        }
      }
    } catch (error) {
      console.error("Failed to fetch account:", error);
      toast.error("Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (countryCode: string, setFieldValue: any) => {
    setFieldValue("country", countryCode);
    setFieldValue("state", "");
    setFieldValue("city", "");
    
    if (countryCode) {
      const countryStates = State.getStatesOfCountry(countryCode);
      setStates(countryStates.map(state => ({
        value: state.isoCode,
        label: state.name
      })));
    } else {
      setStates([]);
    }
    setCities([]);
  };

  const handleStateChange = (stateCode: string, countryCode: string, setFieldValue: any) => {
    setFieldValue("state", stateCode);
    setFieldValue("city", "");
    
    if (countryCode && stateCode) {
      const stateCities = City.getCitiesOfState(countryCode, stateCode);
      setCities(stateCities.map(city => ({
        value: city.name,
        label: city.name
      })));
    } else {
      setCities([]);
    }
  };
const handleSubmit = async (
    values: typeof initialValues,
    { setSubmitting }: any
  ) => {
    try {
      // Dropdown me isoCode use hota hai, lekin backend me Branch ke format
      // (full name, jaise "Gujarat") se match karne ke liye convert karo —
      // taaki GST CGST/SGST/IGST split sahi calculate ho
      const countryFullName = Country.getCountryByCode(values.country)?.name || values.country;
      const stateFullName = State.getStateByCodeAndCountry(values.state, values.country)?.name || values.state;

      const payload = {
        account_name: values.accountName,
        group: values.group,
        opening_balance: Math.abs(Number(values.openingBalance || 0)),
        drcr: values.drcr,
        gst_no: values.gstNo,
        pan_card: values.panCard,
        address: values.address,
        country: countryFullName,
        state: stateFullName,
        city: values.city,
        email: values.email,
        pincode: values.pincode,
        phone: values.phone,
        mobile: values.mobile,
      };

      if (isEditMode) {
        const accountId = id || location.state?.accountData?.id;
        await api.patch(`account/${accountId}/`, payload, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        });
        toast.success("Account Updated Successfully ✅");
      } else {
        await api.post("account-create/", payload);
        toast.success("Account Created Successfully ✅");
      }
      
      navigate("/addAccounts");
    } catch (error: any) {
      console.error("Save Error ❌", error.response?.data);
      toast.error(isEditMode ? "Failed to update account" : "Failed to save account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-gray-600 text-sm font-medium">Loading account data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <MdAccountBalance className="text-blue-600 text-2xl" />
                {isEditMode ? "Edit Account" : "Create New Account"}
              </h1>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                {isEditMode ? "Update account information" : "Fill in the details to create a new account"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <MdArrowBack className="text-base" />
              Back
            </button>
          </div>
        </div>

        {/* Form */}
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          enableReinitialize={true}
        >
          {({ isSubmitting, setFieldValue, values }) => (
            <Form>
              <div className="space-y-4">
                {/* Basic Information Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <MdDashboard className="text-xl text-blue-600" />
                    <h2 className="text-base font-semibold text-gray-800">Basic Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormInput
                      label="Account Name *"
                      name="accountName"
                      placeholder="Enter account name"
                      icon={MdPerson}
                    />
                    <FormSelect
                      label="Group *"
                      name="group"
                      options={groups}
                      icon={MdBusiness}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const selectedGroup = e.target.value;
                        setFieldValue("group", selectedGroup);
                        if (selectedGroup === "Customer") {
                          setFieldValue("drcr", "Dr");
                        } else if (selectedGroup === "Supplier") {
                          setFieldValue("drcr", "Cr");
                        }
                      }}
                    />
                    <FormInput
                      label="Opening Balance"
                      name="openingBalance"
                      type="number"
                      placeholder="0.00"
                      icon={MdAccountBalance}
                    />
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Dr./Cr. *
                      </label>
                      <div className="flex gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Field 
                            type="radio" 
                            name="drcr" 
                            value="Dr" 
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Dr. (Receivable)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Field 
                            type="radio" 
                            name="drcr" 
                            value="Cr" 
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Cr. (Payable)</span>
                        </label>
                      </div>
                      <ErrorMessage
                        name="drcr"
                        component="div"
                        className="text-red-500 text-xs mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Details Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <MdLocationOn className="text-xl text-green-600" />
                    <h2 className="text-base font-semibold text-gray-800">Contact Details</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <FormInput
                        label="Address"
                        name="address"
                        placeholder="Enter full address"
                        icon={MdLocationOn}
                      />
                    </div>
                    <FormSelect
                      label="Country"
                      name="country"
                      options={countries}
                      icon={MdPublic}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        handleCountryChange(e.target.value, setFieldValue)
                      }
                    />
                    <FormSelect
                      label="State"
                      name="state"
                      options={states}
                      icon={MdMap}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                        handleStateChange(e.target.value, values.country, setFieldValue)
                      }
                      disabled={!values.country}
                    />
                    <FormSelect
                      label="City"
                      name="city"
                      options={cities}
                      icon={MdLocationCity}
                      disabled={!values.state}
                    />
                    <FormInput
                      label="Pincode"
                      name="pincode"
                      type="text"
                      placeholder="6-digit pincode"
                      maxLength={6}
                      icon={MdPinDrop}
                    />
                    <FormInput
                      label="Mobile"
                      name="mobile"
                      type="text"
                      placeholder="10-digit mobile"
                      maxLength={10}
                      icon={MdPhoneAndroid}
                    />
                    <FormInput
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="customer@example.com"
                      icon={MdEmail}
                    />
                  </div>
                </div>

                {/* Legal & Financial Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <MdGavel className="text-xl text-purple-600" />
                    <h2 className="text-base font-semibold text-gray-800">Legal & Financial</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="GST No."
                      name="gstNo"
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      icon={MdBusiness}
                    />
                    <FormInput
                      label="PAN Card"
                      name="panCard"
                      placeholder="AAAAA0000A"
                      maxLength={10}
                      icon={MdCreditCard}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      disabled={isSubmitting}
                    >
                      <MdSave className="text-base" />
                      {isSubmitting ? "Saving..." : isEditMode ? "Update Account" : "Create Account"}
                    </button>
                    
                    {isEditMode && (
                      <button
                        type="button"
                        className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to delete this account?")) {
                            try {
                              const accountId = id || location.state?.accountData?.id;
                              await api.delete(`account/${accountId}/`, {
                                headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
                              });
                              toast.success("Account deleted successfully");
                              navigate("/addAccounts");
                            } catch (error) {
                              toast.error("Failed to delete account");
                            }
                          }
                        }}
                      >
                        <MdDelete className="text-base" />
                        Delete Account
                      </button>
                    )}
                    
                    <button
                      type="button"
                      className="flex-1 bg-gray-600 text-white px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
                      onClick={() => navigate("/addAccounts")}
                    >
                      <MdCancel className="text-base" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default AccountCreationForm;