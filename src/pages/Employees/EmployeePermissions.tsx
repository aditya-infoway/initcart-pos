// src/pages/employees/EmployeePermissions.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { toast } from "react-toastify";
import { menuItems } from "../../components/layout/AppLayout";
import { MdArrowBack, MdSave } from "react-icons/md";
import { getSuperAdminMenuItems } from "../../components/layout/AppLayout";

interface FlatPage { page_key: string; page_label: string; group: string; }
interface PermissionRow extends FlatPage {
  can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean;
}

// ✅ Page-wise allowed actions map — jis page pe jo action allowed hai wahi checkbox render hoga,
// baaki sab cells me dash (-) aayega (non-applicable / non-editable).
// Ye mapping aapke diye gaye screenshots ke exact state se banaya gaya hai.
type ActionField = "can_view" | "can_add" | "can_edit" | "can_delete";
type AllowedActions = Record<ActionField, boolean>;

const PAGE_ALLOWED_ACTIONS: Record<string, AllowedActions> = {
  // ── Master ──────────────────────────────
  "/addAccounts":        { can_view: true, can_add: true,  can_edit: true,  can_delete: false }, // Account Creation
  "/branchMaster":        { can_view: true, can_add: true,  can_edit: true,  can_delete: true },  // Branch Master
  "/AddItems":             { can_view: true, can_add: true,  can_edit: true,  can_delete: true },  // Add Items
  "/WebItems":             { can_view: true, can_add: true,  can_edit: true,  can_delete: true },  // Website Items
  "/PendingBarcodes":      { can_view: true, can_add: true,  can_edit: true,  can_delete: false }, // Item Barcodes
  "/Orders":                { can_view: true, can_add: false, can_edit: true, can_delete: false }, // Orders
  "/createGroup":           { can_view: true, can_add: true,  can_edit: true,  can_delete: true },  // Group
  "/ExcelImportExport":     { can_view: true, can_add: true,  can_edit: false, can_delete: false }, // Item Import

  // ── Stock related ───────────────────────
  "/stockReturnverification":     { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Stock Return Verification
  "/b2bstockReturnverification":  { can_view: true, can_add: false, can_edit: false, can_delete: false }, // B2B Stock Returns
  "/stockTransfer":                { can_view: true, can_add: true,  can_edit: false, can_delete: false }, // Stock Transfer

  // ── purchase ─────────────────────────────
  "/Addpurchaseitem":    { can_view: true, can_add: true,  can_edit: false, can_delete: false }, // Purchase Entry
  "/purchaseimport":    { can_view: true, can_add: true,  can_edit: false, can_delete: false },
  "/purchaseReturnList": { can_view: true, can_add: true,  can_edit: false, can_delete: true },  // Purchase Return

  // ── sales ────────────────────────────────
  "/Addsalesitem":     { can_view: true, can_add: true,  can_edit: false, can_delete: false }, // Sales Entry & Report
  "/salesentry2":       { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Sales Entry2
  "/b2bsales":           { can_view: true, can_add: true,  can_edit: false, can_delete: false }, // B2B Sales
  "/salesReturnList":    { can_view: true, can_add: true, can_edit: false, can_delete: true },  // Sales Return & Report

  // ── payment ──────────────────────────────
  "/Bank-payment":  { can_view: true, can_add: true, can_edit: false, can_delete: false },
  "/Bank-receipt":  { can_view: true, can_add: true, can_edit: false, can_delete: false },
  "/Cash-Payment":  { can_view: true, can_add: true, can_edit: false, can_delete: false },
  "/Cash-receipt":  { can_view: true, can_add: true, can_edit: false, can_delete: false },
  "/Contra":         { can_view: true, can_add: true, can_edit: false, can_delete: false },
  "/JournalEntries": { can_view: false, can_add: false, can_edit: false, can_delete: false }, // sab dash

  // ── standalone reports ──────────────────
  "/stock-report":   { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Stock Report
  "/SchemeOffer":     { can_view: true, can_add: true,  can_edit: true,  can_delete: true },  // Scheme Offers
  "/ledger-report":   { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Ledger Report

  // ── Report group ─────────────────────────
  "/outStandingReport":       { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Outstanding
  "/salesEntryRegister":       { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Sales Register
  "/purchaseRegister":         { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Purchase Register
  "/salesReturnRegister":      { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Sales Return Register
  "/purchaseReturnRegister":   { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Purchase Return Register
  "/duePaymentReport":         { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Due Payment

  // ── books / other ────────────────────────
  "/dayBook":            { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Day Book
  "/salesProfitReport":  { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Sales Profit Report
  "/cashBook":           { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Cash Book
  "/bankBook":           { can_view: true, can_add: false, can_edit: false, can_delete: false }, // Bank Book
};

// Fallback: agar koi naya page_key is map me na mile toh safety ke liye sab allowed rakho
// (taaki kabhi accidentally koi permission silently hide na ho jaaye).
const DEFAULT_ALLOWED: AllowedActions = { can_view: true, can_add: true, can_edit: true, can_delete: true };

const isActionAllowed = (page_key: string, field: ActionField): boolean => {
  const allowed = PAGE_ALLOWED_ACTIONS[page_key] ?? DEFAULT_ALLOWED;
  return allowed[field];
};

const flattenMenu = (): FlatPage[] => {
  const pages: FlatPage[] = [];
  const superAdminMenu = getSuperAdminMenuItems();
 
  superAdminMenu.forEach((category) => {
    category.items.forEach((item) => {
      // ✅ SKIP: Employee Management — Employee ko ye permission nahi milni chahiye
      if (item.title === "Employee Management") return;
      if (item.title === "Logout" || item.title === "Dashboard") return;
      
      if (item.to && item.to !== "#") {
        pages.push({ 
          page_key: item.to, 
          page_label: item.title, 
          group: item.title 
        });
      }
      
      item.submenu?.forEach((sub) => {
        // ✅ SKIP: Employee Management ke submenu items bhi skip karo
        if (item.title === "Employee Management") return;
        if (sub.to && sub.to !== "#") {
          pages.push({ 
            page_key: sub.to, 
            page_label: sub.name, 
            group: item.title 
          });
        }
      });
    });
  });
  return pages;
};
 

const EmployeePermissions = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employeeName, setEmployeeName] = useState("");
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`employees/${id}/permissions/`);
        const employee = res.data.data;
        setEmployeeName(employee.full_name);

        const existing: Record<string, any> = {};
        (employee.permissions || []).forEach((p: any) => { existing[p.page_key] = p; });

        const merged = flattenMenu().map((p) => ({
          ...p,
          can_view: isActionAllowed(p.page_key, "can_view") ? (existing[p.page_key]?.can_view ?? false) : false,
          can_add: isActionAllowed(p.page_key, "can_add") ? (existing[p.page_key]?.can_add ?? false) : false,
          can_edit: isActionAllowed(p.page_key, "can_edit") ? (existing[p.page_key]?.can_edit ?? false) : false,
          can_delete: isActionAllowed(p.page_key, "can_delete") ? (existing[p.page_key]?.can_delete ?? false) : false,
        }));
        setRows(merged);
      } catch {
        toast.error("Failed to load employee permissions");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggle = (page_key: string, field: keyof PermissionRow) => {
    // Not-applicable field pe toggle hi na ho (safety guard, UI me bhi checkbox render nahi hota)
    if (field !== "page_key" && field !== "page_label" && field !== "group") {
      if (!isActionAllowed(page_key, field as ActionField)) return;
    }

    setRows((prev) => prev.map((r) => {
      if (r.page_key !== page_key) return r;
      const updated = { ...r, [field]: !r[field] };
      if (field !== "can_view" && updated[field]) updated.can_view = true;   // add/edit/delete on -> view auto on
      if (field === "can_view" && !updated.can_view) {                       // view off -> sab off
        updated.can_add = false; updated.can_edit = false; updated.can_delete = false;
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`employees/${id}/permissions/`, {
        permissions: rows.map(({ page_key, page_label, can_view, can_add, can_edit, can_delete }) =>
          ({ page_key, page_label, can_view, can_add, can_edit, can_delete })),
      });
      toast.success("Permissions updated successfully");
      navigate("/allEmployees");
    } catch {
      toast.error("Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 flex justify-center items-center min-h-[300px]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  const grouped = rows.reduce<Record<string, PermissionRow[]>>((acc, row) => {
    acc[row.group] = acc[row.group] || [];
    acc[row.group].push(row);
    return acc;
  }, {});

  // Reusable cell renderer: allowed -> checkbox, not allowed -> dash
  const renderCell = (row: PermissionRow, field: ActionField) => {
    if (!isActionAllowed(row.page_key, field)) {
      return <span className="text-gray-400 select-none">-</span>;
    }
    return (
      <input
        type="checkbox"
        checked={row[field]}
        onChange={() => toggle(row.page_key, field)}
        className="w-4 h-4 cursor-pointer"
      />
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Set Access — {employeeName}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate("/allEmployees")} className="flex items-center gap-1.5 px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"><MdArrowBack /> Back</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"><MdSave /> {saving ? "Saving..." : "Save Access"}</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-3 border border-gray-300 text-left">Menu</th>
              <th className="p-3 border border-gray-300 text-left">Page</th>
              <th className="p-3 border border-gray-300 text-center w-20">View</th>
              <th className="p-3 border border-gray-300 text-center w-20">Add</th>
              <th className="p-3 border border-gray-300 text-center w-20">Edit</th>
              <th className="p-3 border border-gray-300 text-center w-20">Delete</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, items]) => items.map((row, idx) => (
              <tr key={row.page_key} className="hover:bg-gray-50">
                {idx === 0 && <td className="p-3 border border-gray-300 font-semibold bg-gray-50 align-top" rowSpan={items.length}>{group}</td>}
                <td className="p-3 border border-gray-300">{row.page_label}</td>
                <td className="p-3 border border-gray-300 text-center">{renderCell(row, "can_view")}</td>
                <td className="p-3 border border-gray-300 text-center">{renderCell(row, "can_add")}</td>
                <td className="p-3 border border-gray-300 text-center">{renderCell(row, "can_edit")}</td>
                <td className="p-3 border border-gray-300 text-center">{renderCell(row, "can_delete")}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeePermissions;