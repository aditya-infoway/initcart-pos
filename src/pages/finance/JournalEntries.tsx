import React, { useState, useEffect } from "react";
import { Formik, Form, FieldArray, useField } from "formik";
import * as Yup from "yup";
import api from "../../api/api";
import { toast } from "react-toastify";

const today = new Date().toISOString().split("T")[0];

interface FieldProps {
  name: string;
  label?: string;
  type?: string;
  onChange?: (e: React.ChangeEvent<any>) => void;
  value?: any;
  readOnly?: boolean;
}
interface Account {
  id: number;
  account_name: string;
  // baki fields agar chhe to add karo
}

interface Entry {
  account_id: number;
  account_name: string;
  debit?: number | string;
  credit?: number | string;
  narration?: string;
}

interface Voucher {
  date: string;
  voucher_no: string;
  reference_no?: string;
  entries: Entry[];
}



/* ---------------- INPUT ---------------- */
const Input: React.FC<FieldProps> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  return (
    <div className="flex flex-col">
      {label && <label className="text-sm font-semibold">{label}</label>}
      <input
        {...field}
        {...props}
        className={`border p-2 rounded ${meta.touched && meta.error ? "border-red-500" : "border-gray-300"
          }`}
      />
      {meta.touched && meta.error && (
        <span className="text-xs text-red-500">{meta.error}</span>
      )}
    </div>
  );
};

/* ---------------- ACCOUNT SELECT ---------------- */
const AccountSelect: React.FC<FieldProps> = ({ name }) => {
  const [, field, helpers] = useField(name);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    api.get("all-account/").then((res) => setAccounts(res.data));
  }, []);

  return (
    <select
      className="border p-2 rounded w-full"
      value={field.value?.id || ""}
      onChange={(e) => {
        const acc = accounts.find(
          (a) => a.id === Number(e.target.value)
        );
        helpers.setValue(acc || null);
      }}
    >
      <option value="">Select Party</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.account_name}
        </option>
      ))}
    </select>
  );
};

/* ---------------- VALIDATION ---------------- */
const validationSchema = Yup.object({
  date: Yup.string().required("Date required"),
  voucherNo: Yup.string().required("Voucher required"),

  entries: Yup.array()
    .min(2, "Minimum two entries required")

    // 🔹 Debit = Credit
    .test(
      "debit-credit-match",
      "Debit and Credit must be equal",
      (entries = []) => {
        const debit = entries.reduce(
          (s, e) => s + Number(e.debit || 0),
          0
        );
        const credit = entries.reduce(
          (s, e) => s + Number(e.credit || 0),
          0
        );
        return debit === credit;
      }
    )

    // 🔹 SAME PARTY NOT ALLOWED TWICE
    .test(
      "unique-party",
      "Same party cannot be selected more than once",
      (entries = []) => {
        const ids = entries.map((e) => e.account_id);
        return new Set(ids).size === ids.length;
      }
    ),
});


/* ---------------- INITIAL VALUES ---------------- */
const initialValues = {
  date: today,
  voucherNo: "",
  referenceNo: "",
  currentEntry: {
    account: null, // full object
    debit: "",
    credit: "",
    narration: "",
  },
  entries: [],
};

/* ---------------- MAIN ---------------- */
const JournalEntries = () => {
  const [open, setOpen] = useState(false);
  const [rows,] = useState<any[]>([]);
  const [savedEntries, setSavedEntries] = useState<Voucher[]>([]);
  const [lockSide, setLockSide] = useState<"debit" | "credit" | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  //const [prefixes, setPrefixes] = useState<any>({});
  //const [setFieldValueGlobal, setFieldValueRef] = useState<(field: string, value: any) => void>(() => () => { });

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        const res = await api.get("journal-entries/");
        setSavedEntries(res.data); // ✅ API data
      } catch (err) {
        console.error(err);
      }
    };

    fetchJournals();
  }, []);


  return (
    <div className="p-6">
      {/* Add Button */}
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Journal Entries</h1>
        <button
          onClick={() => setOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded mb-4"
        >
          + Add Journal
        </button>
      </div>
      <div className="bg-gray rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-blue-600 text-white text-center">
            <tr>
              <th className=" p-3">#</th>
              <th className=" p-3">Date</th>
              <th className=" p-3">Voucher No</th>
              <th className=" p-3">Reference</th>
              <th className=" p-3">Party</th>
              <th className=" p-3">Debit</th>
              <th className=" p-3">Credit</th>
              <th className=" p-3">Narration</th>
            </tr>
          </thead>

          <tbody>
            {savedEntries.map((voucher, vIndex) =>
              voucher.entries.map((row: any, rIndex: any) => (
                <tr key={`${vIndex}-${rIndex}`} className="border-t text-center">
                  {/* SHOW ONLY ON FIRST ROW */}
                  <td className="p-2 text-center">{vIndex + 1}</td>
                  <td className=" p-2">
                    {rIndex === 0 ? voucher.date : ""}
                  </td>

                  <td className=" p-2">
                    {rIndex === 0 ? voucher.voucher_no : ""}
                  </td>

                  <td className=" p-2">
                    {rIndex === 0 ? voucher.reference_no : ""}
                  </td>

                  <td className=" p-2">
                    {row.account_name}
                  </td>

                  <td className=" p-2">
                    {row.debit || "-"}
                  </td>

                  <td className=" p-2">
                    {row.credit || "-"}
                  </td>

                  <td className=" p-2">
                    {row.narration}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm">
          Showing {indexOfFirstRow + 1}–
          {Math.min(indexOfLastRow, rows.length)} of {rows.length}
        </span>

        <div className="flex gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1 border rounded"
          >
            Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 border rounded ${currentPage === i + 1 ? "bg-blue-600 text-white" : ""
                }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1 border rounded"
          >
            Next
          </button>
        </div>
      </div>


      {/* ---------------- MODAL ---------------- */}
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white w-full max-w-6xl rounded shadow-lg">
            <div className="bg-blue-600 text-white px-6 py-3 flex justify-between">
              <h2 className="font-semibold">Add Journal Entries</h2>
              <button onClick={() => setOpen(false)}>✕</button>
            </div>

            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={async (values: any) => {
                const totalDebit = values.entries.reduce(
                  (s: any, e: any) => s + Number(e.debit || 0),
                  0
                );
                const totalCredit = values.entries.reduce(
                  (s: any, e: any) => s + Number(e.credit || 0),
                  0
                );

                const payload = {
                  date: values.date,
                  voucher_no: values.voucherNo,
                  reference_no: values.referenceNo,
                  total_debit: totalDebit,
                  total_credit: totalCredit,
                  entries: values.entries.map((e: any) => ({
                    account: e.account_id,
                    debit: e.debit || 0,
                    credit: e.credit || 0,
                    narration: e.narration,
                  })),
                };

                await api.post("journal-entries/", payload);

                setSavedEntries((prev) => [...prev, values]);

                toast.success("Journal saved successfully");
                setOpen(false);


              }}


            >
              {({ values, setFieldValue, errors }) => {
                const totalDebit = values.entries.reduce(
                  (s: any, e: any) => s + Number(e.debit || 0),
                  0
                );

                const totalCredit = values.entries.reduce(
                  (s: any, e: any) => s + Number(e.credit || 0),
                  0
                );
                useEffect(() => {
                  // fetch latest voucher only when modal opens
                  if (open) {
                    const fetchVoucher = async () => {
                      try {
                        const res = await api.get(`voucher/generate/?type=JE`);
                        setFieldValue("voucherNo", res.data.voucher_no); // <-- this will populate the field
                      } catch (err) {
                        console.error("Failed to fetch latest voucher:", err);
                        toast.error("Failed to fetch latest voucher number");
                      }
                    };
                    fetchVoucher();
                  }
                }, [open, setFieldValue]);

                return (
                  <Form className="p-6 space-y-5">
                    {/* TOP */}
                    <div className="grid grid-cols-3 gap-4">
                      <Input label="Date" name="date" type="date" />
                      <Input label="Voucher No" name="voucherNo" />
                      <Input label="Reference No" name="referenceNo" />
                    </div>

                    {/* ENTRY INPUT ROW */}
                    <FieldArray name="entries">
                      {({ push, remove }) => (
                        <>
                          <div className="grid grid-cols-5 gap-2 items-end">
                            <AccountSelect name="currentEntry.account" />

                            <Input
                              label="Debit"
                              name="currentEntry.debit"
                              type="number"
                              readOnly={lockSide === "credit"} // 👈 once credit locked, always locked
                              onChange={(e: any) => {
                                const val = e.target.value;

                                setFieldValue("currentEntry.debit", val);

                                if (val && lockSide === null) {
                                  setLockSide("debit");       // 🔒 lock debit side
                                  setFieldValue("currentEntry.credit", "");
                                }
                              }}
                            />

                            <Input
                              label="Credit"
                              name="currentEntry.credit"
                              type="number"
                              readOnly={lockSide === "debit"} // 👈 once debit locked, always locked
                              onChange={(e: any) => {
                                const val = e.target.value;

                                setFieldValue("currentEntry.credit", val);

                                if (val && lockSide === null) {
                                  setLockSide("credit");      // 🔒 lock credit side
                                  setFieldValue("currentEntry.debit", "");
                                }
                              }}
                            />


                            <Input
                              label="Narration"
                              name="currentEntry.narration"
                            />

                            <button
                              type="button"
                              className="bg-green-600 text-white h-10 rounded font-bold"
                              onClick={() => {
                                const e = values.currentEntry;

                                if (!e.account || (!e.debit && !e.credit)) {
                                  toast.error("Select party and enter debit or credit");
                                  return;
                                }

                                push({
                                  account_id: e.account.id,
                                  account_name: e.account.account_name,
                                  debit: e.debit,
                                  credit: e.credit,
                                  narration: e.narration,
                                });

                                setFieldValue("currentEntry", {
                                  account: null,
                                  debit: "",
                                  credit: "",
                                  narration: "",
                                });

                                setLockSide(null); // 🔓 RESET LOCK HERE
                              }}

                            >
                              ➕
                            </button>
                          </div>

                          {/* TABLE */}
                          <table className="w-full border text-sm mt-4">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border p-2">Party</th>
                                <th className="border p-2">Debit</th>
                                <th className="border p-2">Credit</th>
                                <th className="border p-2">Narration</th>
                                <th className="border p-2">Action</th>
                              </tr>
                            </thead>

                            <tbody>
                              {values.entries.map((row: any, i: any) => (
                                <tr key={i}>
                                  <td className="border p-2">
                                    {row.account_name}
                                  </td>
                                  <td className="border p-2">
                                    {row.debit || "-"}
                                  </td>
                                  <td className="border p-2">
                                    {row.credit || "-"}
                                  </td>
                                  <td className="border p-2">
                                    {row.narration}
                                  </td>
                                  <td className="border p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => remove(i)}
                                      className="text-red-600"
                                    >
                                      🗑
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>

                            <tfoot className="bg-gray-50 font-bold">
                              <tr>
                                <td className="border p-2">TOTAL</td>
                                <td className="border p-2">
                                  {totalDebit.toFixed(2)}
                                </td>
                                <td className="border p-2">
                                  {totalCredit.toFixed(2)}
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </>
                      )}
                    </FieldArray>

                    {/* FOOTER */}
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={totalDebit !== totalCredit}
                        className={`px-6 py-2 rounded text-white ${totalDebit !== totalCredit
                          ? "bg-gray-400"
                          : "bg-blue-700"
                          }`}
                      >
                        Submit
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="bg-gray-300 px-6 py-2 rounded"
                      >
                        Cancel
                      </button>
                    </div>

                    {errors.entries && typeof errors.entries === "string" && (
                      <p className="text-red-600 text-sm">{errors.entries}</p>
                    )}
                  </Form>
                );
              }}
            </Formik>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalEntries;
