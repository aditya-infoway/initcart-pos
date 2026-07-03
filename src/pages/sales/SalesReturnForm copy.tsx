import React, { useEffect } from "react";
import { Formik, Form, FieldArray, useField } from "formik";
import * as Yup from "yup";

const customers: string[] = ["John Doe", "Jane Smith", "Alex Brown"];
const items: string[] = ["SHAMPOO", "CONDITIONER", "SOAP"];
const reasonsForReturn: string[] = ["Damaged", "Wrong Item", "Defective", "Other"];
const returnTypes: string[] = ["Full Return", "Partial Return"];
const returnStatuses: string[] = ["Pending", "Approved", "Completed"];

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

interface DisplayFieldProps {
  label: string;
  value: string | number;
}

const validationSchema = Yup.object({
  returnDate: Yup.date().required("Return Date is required"),
  billNo: Yup.string().required("Bill No. is required").max(20, "Must be 20 characters or less"),
  customerName: Yup.string().required("Customer Name is required"),
  reasonForReturn: Yup.string().required("Reason for Return is required"),
  approvedBy: Yup.string().required("Approved By is required"),
  returnType: Yup.string().required("Return Type is required"),
  returnStatus: Yup.string().required("Return Status is required"),
  items: Yup.array().of(
    Yup.object().shape({
      itemName: Yup.string().required("Item Name is required"),
      batchNo: Yup.string().max(20, "Must be 20 characters or less"),
      returnQuantity: Yup.number()
        .typeError("Must be a number")
        .min(0, "Must be non-negative")
        .required("Return Quantity is required"),
      basicAmount: Yup.number()
        .typeError("Must be a number")
        .min(0, "Must be non-negative")
        .required("Basic Amount is required"),
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
  taxAmount: string;
  netReturnValue: string;
}

const SalesReturnForm = () => {
  const initialValues = {
    returnDate: "2025-10-14", // Today's date
    billNo: "",
    customerName: "",
    reasonForReturn: "",
    approvedBy: "",
    returnType: "",
    returnStatus: "",
    items: [
      {
        itemName: "",
        batchNo: "",
        returnQuantity: "",
        basicAmount: "0.00",
        taxPercent: "5.00",
        taxAmount: "0.00",
        netReturnValue: "0.00",
      },
    ],
    totalBasicAmount: "0.00",
    totalTaxAmount: "0.00",
    finalRefundAmount: "0.00",
  };

  const calculateItemValues = (
    item: any,
    taxPercent: number = 5
  ): ItemValues => {
    const basicAmount = parseFloat(item.basicAmount) || 0;
    const taxAmount = (basicAmount * taxPercent) / 100;
    const netReturnValue = basicAmount + taxAmount;
    return {
      basicAmount: basicAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      netReturnValue: netReturnValue.toFixed(2),
    };
  };

  const calculateTotals = (items: any[]): { [key: string]: string } => {
    const totalBasic = items.reduce((sum, item) => sum + parseFloat(item.basicAmount || 0), 0);
    const totalTax = items.reduce((sum, item) => sum + parseFloat(item.taxAmount || 0), 0);
    const finalRefund = totalBasic + totalTax;
    return {
      totalBasicAmount: totalBasic.toFixed(2),
      totalTaxAmount: totalTax.toFixed(2),
      finalRefundAmount: finalRefund.toFixed(2),
    };
  };

  const handleSubmit = (
    values: typeof initialValues,
    { setSubmitting }: { setSubmitting: (isSubmitting: boolean) => void }
  ) => {
    setTimeout(() => {
      console.log("Form Data:", values);
      alert("Sales Return Saved Successfully!");
      setSubmitting(false);
    }, 400);
  };

  return (
    <div className="bg-gray-100">
      <div className="bg-blue-200 p-3 rounded-t-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4">
          <span className="text-blue-800 font-bold text-lg">SALES RETURN FORM</span>
        </div>
      </div>

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, setFieldValue, isSubmitting }) => {
          useEffect(() => {
            values.items.forEach((item, index) => {
              const { basicAmount, taxAmount, netReturnValue } = calculateItemValues(item);
              setFieldValue(`items[${index}].basicAmount`, basicAmount);
              setFieldValue(`items[${index}].taxAmount`, taxAmount);
              setFieldValue(`items[${index}].netReturnValue`, netReturnValue);
            });
            const totals = calculateTotals(values.items);
            setFieldValue("totalBasicAmount", totals.totalBasicAmount);
            setFieldValue("totalTaxAmount", totals.totalTaxAmount);
            setFieldValue("finalRefundAmount", totals.finalRefundAmount);
          }, [values.items, setFieldValue]);

          return (
            <Form className="bg-white p-3 sm:p-4 rounded-b-lg shadow-md grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <div className="col-span-full border-b pb-1">
                <h2 className="text-md font-semibold text-blue-700">Information</h2>
              </div>
              <FormInput label="Return Date" name="returnDate" type="date" value={values.returnDate} />
              <FormInput label="Original Bill No." name="billNo" placeholder="SALE-001" />
              <FormSelect label="Customer Name" name="customerName" options={customers} />
              <FormSelect label="Reason for Return" name="reasonForReturn" options={reasonsForReturn} />
              <FormInput label="Approved By" name="approvedBy" placeholder="Manager Name" />
              <FormSelect label="Return Type" name="returnType" options={returnTypes} />
              <FormSelect label="Return Status" name="returnStatus" options={returnStatuses} />

              <div className="col-span-full border-b pb-1 mt-2">
                <h2 className="text-md font-semibold text-blue-700">Return Item Details</h2>
              </div>
              <FieldArray name="items">
                {({ push, remove }) => (
                  <div className="col-span-full">
                    {values.items.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-4 xl:grid-cols-7 gap-1 mb-2 border p-2 rounded"
                      >
                        <FormSelect
                          label="Item Name"
                          name={`items[${index}].itemName`}
                          options={items}
                        />
                        <FormInput
                          label="Batch No."
                          name={`items[${index}].batchNo`}
                          placeholder="100 ML"
                        />
                        <FormInput
                          label="Return Quantity"
                          name={`items[${index}].returnQuantity`}
                          type="number"
                          placeholder="1.00"
                        />
                        <FormInput
                          label="Basic Amount"
                          name={`items[${index}].basicAmount`}
                          type="number"
                          placeholder="200.00"
                        />
                        <DisplayField label="Tax %" value="5.00" />
                        <DisplayField label="Tax Amount" value={item.taxAmount} />
                        <DisplayField label="Net Return Value" value={item.netReturnValue} />
                        <button
                          type="button"
                          className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                          onClick={() => remove(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 mt-2"
                      onClick={() =>
                        push({
                          itemName: "",
                          batchNo: "",
                          returnQuantity: "",
                          basicAmount: "0.00",
                          taxPercent: "5.00",
                          taxAmount: "0.00",
                          netReturnValue: "0.00",
                        })
                      }
                    >
                      Add Item
                    </button>
                  </div>
                )}
              </FieldArray>

              <div className="col-span-full border-b pb-1 mt-2">
                <h2 className="text-md font-semibold text-blue-700">Calculations</h2>
              </div>
              <DisplayField label="Total Basic Amount" value={values.totalBasicAmount} />
              <DisplayField label="Total Tax Amount" value={values.totalTaxAmount} />
              <DisplayField label="Final Refund Amount" value={values.finalRefundAmount} />

              <div className="col-span-full flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  Close
                </button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
};

export default SalesReturnForm;