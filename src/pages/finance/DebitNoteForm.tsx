import React from 'react';
import { Formik, Form, useField } from 'formik';
import * as Yup from 'yup';

// TypeScript interfaces for type safety
interface DebitNoteFormValues {
  date: string;
  partyName: string;
  referenceBillNo: string;
  amount: string;
  reason: string;
  narration: string;
}

interface DebitNoteFormProps {
  // Optional: Add props for initial data or callbacks
}

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}

interface FormSelectProps {
  label: string;
  name: string;
  options: string[];
}

interface FormTextAreaProps {
  label: string;
  name: string;
  placeholder?: string;
}

// Validation schema using Yup
const validationSchema = Yup.object({
  date: Yup.date().required('Date is required'),
  partyName: Yup.string().required('Party Name is required'),
  referenceBillNo: Yup.string()
    .max(20, 'Must be 20 characters or less')
    .required('Reference Bill No. is required'),
  amount: Yup.number()
    .typeError('Must be a number')
    .min(0, 'Must be non-negative')
    .required('Amount is required'),
  reason: Yup.string()
    .max(50, 'Must be 50 characters or less')
    .required('Reason is required'),
  narration: Yup.string()
    .max(200, 'Must be 200 characters or less')
    .required('Narration is required'),
});

// Reusable form components
const FormInput: React.FC<FormInputProps> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div className="text-sm">
      <label className="block font-medium text-gray-700">{label}</label>
      <input
        className={`w-full p-2 border ${isInvalid ? 'border-red-500' : 'border-gray-300'} rounded-lg mt-1 text-sm focus:ring-2 focus:ring-blue-500 transition duration-200`}
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
        className={`w-full p-2 border ${isInvalid ? 'border-red-500' : 'border-gray-300'} rounded-lg mt-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 transition duration-200`}
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
        className={`w-full p-2 border ${isInvalid ? 'border-red-500' : 'border-gray-300'} rounded-lg mt-1 text-sm focus:ring-2 focus:ring-blue-500 transition duration-200`}
        rows={4}
        {...field}
        {...props}
      />
      {isInvalid ? <div className="text-red-500 text-xs mt-1">{meta.error}</div> : null}
    </div>
  );
};

const DebitNoteForm: React.FC<DebitNoteFormProps> = () => {
  const initialValues: DebitNoteFormValues = {
    date: '2025-10-14',
    partyName: '',
    referenceBillNo: '',
    amount: '',
    reason: '',
    narration: '',
  };

  const supplierNames = ['Supplier A', 'Supplier B', 'Supplier C'];

  const handleSubmit = (
    values: DebitNoteFormValues,
    { setSubmitting, resetForm }: { setSubmitting: (isSubmitting: boolean) => void; resetForm: () => void }
  ) => {
    setTimeout(() => {
      console.log('Debit Note Form Data:', values);
      alert('Debit Note Saved Successfully!');
      setSubmitting(false);
      resetForm();
    }, 400);
  };

  return (
    <div className="bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
          Debit Note Form
        </h1>
      </div>

      {/* Form */}
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting, resetForm }) => (
          <Form className="mt-6 bg-white rounded-xl shadow-xl border border-gray-100 p-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormInput
                label="Date"
                name="date"
                type="date"
              />
              <FormSelect
                label="Party Name"
                name="partyName"
                options={supplierNames}
              />
              <FormInput
                label="Reference Bill No."
                name="referenceBillNo"
                type="text"
                placeholder="BILL-001"
              />
              <FormInput
                label="Amount"
                name="amount"
                type="number"
                placeholder="200.00"
              />
              <FormInput
                label="Reason"
                name="reason"
                type="text"
                placeholder="Damaged Item"
              />
              <FormTextArea
                label="Narration"
                name="narration"
                placeholder="Enter narration"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                type="submit"
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                onClick={() => resetForm()}
              >
                Clear
              </button>
              <button
                type="button"
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Close
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default DebitNoteForm;