import React, { useEffect } from "react";
import { Formik, Form, FieldArray, useField } from "formik";
import * as Yup from "yup";

const parties: string[] = ["Print Name", "Supplier A", "Supplier B"];
const items: string[] = ["SHAMPOO", "CONDITIONER", "SOAP"];
const terms: string[] = ["Credit", "Cash"];
const units: string[] = ["Pcs.", "Box", "Kg", "Liters"];

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface FormSelectProps {
  label: string;
  name: string;
  options: string[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

interface FormTextAreaProps {
  label: string;
  name: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

interface DisplayFieldProps {
  label: string;
  value: string | number;
}

const validationSchema = Yup.object({
  billNo: Yup.string().required("Bill No. is required").max(20, "Must be 20 characters or less"),
  date: Yup.date().required("Date is required"),
  dueDate: Yup.date().required("Due Date is required"),
  partyName: Yup.string().required("Party Name is required"),
  terms: Yup.string().required("Terms is required"),
  items: Yup.array().of(
    Yup.object().shape({
      itemName: Yup.string().required("Item Name is required"),
      batchNo: Yup.string().max(20, "Must be 20 characters or less"),
      quantity: Yup.number().typeError("Must be a number").min(0, "Must be non-negative"),
      altQuantity: Yup.number().typeError("Must be a number").min(0, "Must be non-negative"),
      price: Yup.number().typeError("Must be a number").min(0, "Must be non-negative"),
      per: Yup.string().required("Unit is required"),
      discountPercent: Yup.number().typeError("Must be a number").min(0, "Must be non-negative").max(100, "Must be 100 or less"),
    })
  ),
});

const FormInput: React.FC<FormInputProps> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div className="text-sm">
      <label className="block font-medium text-gray-700">{label}</label>
      <input
        className={`w-full p-1.5 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded mt-1 text-sm`}
        {...field}
        {...props}
      />
      {isInvalid ? <div className="text-red-500 text-xs mt-1">{meta.error}</div> : null}
    </div>
  );
};

const FormSelect: React.FC<FormSelectProps> = ({ label, options, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div className="text-sm">
      <label className="block font-medium text-gray-700">{label}</label>
      <select
        className={`w-full p-1.5 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded mt-1 text-sm bg-white`}
        {...field}
        {...props}
      >
        <option value="" disabled>Select {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {isInvalid ? <div className="text-red-500 text-xs mt-1">{meta.error}</div> : null}
    </div>
  );
};

const FormTextArea: React.FC<FormTextAreaProps> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div className="text-sm">
      <label className="block font-medium text-gray-700">{label}</label>
      <textarea
        className={`w-full p-1.5 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded mt-1 text-sm`}
        {...field}
        {...props}
      />
      {isInvalid ? <div className="text-red-500 text-xs mt-1">{meta.error}</div> : null}
    </div>
  );
};

const DisplayField: React.FC<DisplayFieldProps> = ({ label, value }) => (
  <div className="text-sm">
    <label className="block font-medium text-gray-700">{label}</label>
    <input
      type="text"
      value={value}
      readOnly
      className="w-full p-1.5 border border-gray-300 rounded mt-1 text-sm bg-gray-100"
    />
  </div>
);

interface ItemValues {
  basicAmount: string;
  discountAmount: string;
  taxAmount: string;
  netValue: string;
}

const PurchaseEntryForm = () => {
  const initialValues = {
    date: "2025-10-14", // Updated to today's date
    terms: "Credit",
    partyName: "",
    balance: "0.00",
    billNo: "",
    dueDate: "",
    narration: "",
    items: [{ itemName: "", batchNo: "", quantity: "", altQuantity: "", price: "", per: "", discountPercent: "", basicAmount: "0.00", discountAmount: "0.00", taxAmount: "0.00", netValue: "0.00" }],
    totalBasicAmount: "0.00",
    totalDiscount: "0.00",
    totalTaxAmount: "0.00",
    totalCharges: "0.00",
    billAmount: "0.00",
  };

  const calculateItemValues = (item: any, taxPercent: number = 5): ItemValues => {
    const basicAmount = (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
    const discountAmount = (basicAmount * (parseFloat(item.discountPercent) || 0)) / 100;
    const taxAmount = (basicAmount - discountAmount) * taxPercent / 100;
    const netValue = basicAmount - discountAmount + taxAmount;
    return {
      basicAmount: basicAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      netValue: netValue.toFixed(2),
    };
  };

  const calculateTotals = (items: any[]): { [key: string]: string } => {
    const totalBasic = items.reduce((sum, item) => sum + parseFloat(item.basicAmount || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + parseFloat(item.discountAmount || 0), 0);
    const totalTax = items.reduce((sum, item) => sum + parseFloat(item.taxAmount || 0), 0);
    const billAmount = totalBasic - totalDiscount + totalTax;
    return {
      totalBasicAmount: totalBasic.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalTaxAmount: totalTax.toFixed(2),
      billAmount: billAmount.toFixed(2),
    };
  };

  const handleSubmit = (values: typeof initialValues, { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void }) => {
    setTimeout(() => {
      console.log("Form Data:", values);
      alert("Purchase Entry Saved Successfully!");
      setSubmitting(false);
    }, 400);
  };

  return (
    <div className="bg-gray-100 mb-14">
      <div className="bg-blue-200 p-3 rounded-t-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4">
          <span className="text-blue-800 font-bold text-lg">PURCHASE ENTRY FORM</span>
        </div>
      </div>

      <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit} enableReinitialize>
        {({ values, setFieldValue, isSubmitting }) => {
          // Use useEffect to update calculated fields without causing infinite loops
          useEffect(() => {
            values.items.forEach((item, index) => {
              const { basicAmount, discountAmount, taxAmount, netValue } = calculateItemValues(item);
              setFieldValue(`items[${index}].basicAmount`, basicAmount);
              setFieldValue(`items[${index}].discountAmount`, discountAmount);
              setFieldValue(`items[${index}].taxAmount`, taxAmount);
              setFieldValue(`items[${index}].netValue`, netValue);
            });
            const totals = calculateTotals(values.items);
            setFieldValue("totalBasicAmount", totals.totalBasicAmount);
            setFieldValue("totalDiscount", totals.totalDiscount);
            setFieldValue("totalTaxAmount", totals.totalTaxAmount);
            setFieldValue("billAmount", totals.billAmount);
          }, [values.items, setFieldValue]);

          return (
            <Form className="bg-white p-3 sm:p-4 rounded-b-lg shadow-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <div className="col-span-full border-b pb-1">
                <h2 className="text-md font-semibold text-blue-700">Information</h2>
              </div>
              <FormInput label="Date" name="date" type="date" value={values.date} />
              <FormSelect label="Terms" name="terms" options={terms} value={values.terms} />
              <FormSelect label="Party Name" name="partyName" options={parties} />
              <DisplayField label="Balance" value={values.balance} />
              <FormInput label="Bill No." name="billNo" placeholder="BILL-001" />
              <FormInput label="Due Date" name="dueDate" type="date" />
              <FormTextArea label="Narration" name="narration" placeholder="Monthly purchase" />

              <div className="col-span-full border-b pb-1 mt-2">
                <h2 className="text-md font-semibold text-blue-700">Item Line Details</h2>
              </div>
              <FieldArray name="items">
                {({ push, remove }) => (
                  <div className="col-span-full">
                    {values.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-11 gap-1 mb-2 border p-2 rounded">
                        <FormSelect label="Item Name" name={`items[${index}].itemName`} options={items} />
                        <FormInput label="Batch No." name={`items[${index}].batchNo`} placeholder="100 ML" />
                        <FormInput label="M.Qty" name={`items[${index}].quantity`} type="number" placeholder="10.00" />
                        <FormInput label="A.Qty" name={`items[${index}].altQuantity`} type="number" placeholder="0.00" />
                        <FormInput label="Price" name={`items[${index}].price`} type="number" placeholder="100.00" />
                        <FormSelect label="Per" name={`items[${index}].per`} options={units} />
                        <DisplayField label="Basic Amt" value={item.basicAmount} />
                        <FormInput label="Dis(%)" name={`items[${index}].discountPercent`} type="number" placeholder="0.00" />
                        <DisplayField label="Dis. Amt" value={item.discountAmount} />
                        <DisplayField label="Tax %" value="5.00" />
                        <DisplayField label="Tax Amt" value={item.taxAmount} />
                        <DisplayField label="Net Value" value={item.netValue} />
                        <div className="flex items-end ms-2">

                        <button type="button" className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600" onClick={() => remove(index)}>Remove</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 mt-2" onClick={() => push({ itemName: "", batchNo: "", quantity: "", altQuantity: "", price: "", per: "", discountPercent: "", basicAmount: "0.00", discountAmount: "0.00", taxAmount: "0.00", netValue: "0.00" })}>Add Item</button>
                  </div>
                )}
              </FieldArray>

              <div className="col-span-full border-b pb-1 mt-2">
                <h2 className="text-md font-semibold text-blue-700">Calculations</h2>
              </div>
              <DisplayField label="Total Basic Amount" value={values.totalBasicAmount} />
              <DisplayField label="Total Discount" value={values.totalDiscount} />
              <DisplayField label="Total Tax Amount" value={values.totalTaxAmount} />
              <DisplayField label="Bill Amount" value={values.billAmount} />

              <div className="col-span-full flex fixed bottom-[20px] flex-wrap gap-2 mt-2">
                <button type="button" className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Delete</button>
                <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
                <button type="button" className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Print</button>
                <button type="button" className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Attach</button>
                <button type="button" className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">List</button>
                <button type="button" className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Close</button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default PurchaseEntryForm;