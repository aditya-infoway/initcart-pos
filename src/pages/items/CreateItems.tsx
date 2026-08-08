// CreateItems.tsx - Complete fixed version with Unit fractional support

import React, { useEffect, useState } from "react";
import { Formik, Form, useField, useFormikContext } from "formik";
import * as Yup from "yup";
import { motion } from "framer-motion";
import { FaCheckCircle, FaEdit, FaPlus } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { useNavigate, useParams } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import api from "../../api/api";
import { toast } from "react-toastify";
import { useAuthStore } from "../../store/authStore";

// ------------------ Validation Schema ------------------
const generateBarcodeNumber = (): string => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  const b12 = ts + rand;
  let total = 0;
  for (let i = 0; i < 12; i++) {
    total += parseInt(b12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (total % 10)) % 10;
  return b12 + check;
};

const validationSchema = Yup.object({
  itemName: Yup.string().max(50, "Max 50 chars").required("Required"),
  brand: Yup.string(),
  category: Yup.string(),
  items: Yup.array().of(
    Yup.object().shape({
      purchasePrice: Yup.number().typeError("Must be a number").min(0, "Non-negative"),
      salesPrice: Yup.number().typeError("Must be a number").min(0, "Non-negative"),
      mrp: Yup.number()
        .typeError("Must be a number")
        .min(0, "Non-negative")
        .test(
          "sales-not-greater-than-mrp",
          "Sales Price cannot be greater than MRP",
          function (value) {
            const { salesPrice } = this.parent;
            if (value == null || salesPrice == null) return true;
            return Number(salesPrice) <= Number(value);
          }
        ),
      opStock: Yup.number().typeError("Must be a number").min(0, "Non-negative"),
      // ✅ Barcode validation - only required for Super Admin with company entry
      barcode: Yup.string()
        .matches(/^[a-zA-Z0-9]*$/, "Barcode can only contain letters and numbers")
        .nullable()
        .optional(), // ✅ Add optional()
    })
  ),
});
// ------------------ Form Components ------------------
const FormInput: React.FC<any> = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;

  return (
    <div className="text-xs sm:text-sm">
      <label className="block font-medium text-gray-600">{label}</label>
      <input
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded text-xs sm:text-sm bg-white`}
        {...field}
        {...props}
        value={field.value ?? (props.type === "number" ? 0 : "")}
      />
      {isInvalid && <div className="text-red-500 text-[10px] sm:text-xs">{meta.error}</div>}
    </div>
  );
};

interface SelectOption {
  label: string;
  value: string | number;
}

interface FormSelectProps {
  label: string;
  name: string;
  options?: SelectOption[];
}

const FormSelect: React.FC<FormSelectProps> = ({ label, options = [], ...props }) => {
  const [field, meta] = useField(props);
  const isInvalid = meta.touched && meta.error;
  return (
    <div className="text-xs sm:text-sm">
      <label className="block font-medium text-gray-600">{label}</label>
      <select
        className={`w-full p-1 sm:p-2 border ${isInvalid ? "border-red-500" : "border-gray-300"} rounded text-xs sm:text-sm bg-white`}
        {...field}
        {...props}
      >
        <option value="" disabled>Select</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {isInvalid && <div className="text-red-500 text-[10px] sm:text-xs">{meta.error}</div>}
    </div>
  );
};

const DisplayField: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="text-xs sm:text-sm">
    <label className="block font-medium text-gray-600">{label}</label>
    <input type="text" value={value} readOnly className="w-full p-1 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm bg-gray-100" />
  </div>
);

// ------------------ DataTable ------------------
interface VariantItem {
  id: number;
  purchasePrice: number;
  branchPrice: number;
  salesPrice: number;
  mrp: number;
  barcode: string;
  opStock: number;
  basicAmount: number;
  discountAmount: number;
  taxAmount: number;
  netValue: number;
  [key: string]: any;
}

interface Column<T> {
  key: keyof T | string;
  label: string;
}

interface DataTableProps<T extends { id: number }> {
  data: T[];
  columns: Column<T>[];
  onDelete?: (item: T) => void;
  onEdit?: (item: T) => void;
  totals: {
    totalQty: number;
    totalBasic: string;
    totalDiscount: string;
    totalTax: string;
    totalNet: string;
  };
}

const DataTable = <T extends { id: number }>({ data, columns, onDelete, onEdit, totals }: DataTableProps<T>) => (
  <div className="bg-white/90 rounded-lg shadow border border-gray-100">
    <div className="overflow-x-auto" style={{ maxHeight: "260px" }}>
      <table className="text-xs sm:text-sm text-gray-700 w-full">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
            <th className="px-2 py-1 sm:py-2 text-left font-semibold text-gray-600 w-10">#</th>
            {columns.map((col) => (
              <th key={String(col.key)} className="px-2 py-1 sm:py-2 text-left font-semibold text-gray-600 truncate">{col.label}</th>
            ))}
            {(onDelete || onEdit) && (
              <th className="px-2 py-1 sm:py-2 text-center font-semibold text-gray-600 w-20">Action</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item, index) => (
              <motion.tr key={item.id} whileHover={{ backgroundColor: "#f9fafb" }} className="border-b border-gray-100">
                <td className="px-2 py-1 sm:py-2 truncate">{index + 1}</td>
                {columns.map((col) => {
                  const value = (item as any)[col.key];
                  const displayValue = value && typeof value === 'object' ? value.name || value.label || '-' : value ?? '-';
                  return <td key={String(col.key)} className="px-2 py-1 sm:py-2 truncate">{displayValue}</td>;
                })}
                {(onDelete || onEdit) && (
                  <td className="px-2 py-1 sm:py-2">
                    <div className="flex gap-1 justify-center">
                      {onEdit && (
                        <motion.button
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onEdit(item)}
                          type="button"
                          title="Edit"
                          className="flex items-center justify-center w-8 h-8 border border-blue-400 rounded-full text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-200"
                        >
                          <FaEdit size={14} />
                        </motion.button>
                      )}
                      {onDelete && (
                        <motion.button
                          whileHover={{ scale: 1.12 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onDelete(item)}
                          type="button"
                          title="Delete"
                          className="flex items-center justify-center w-8 h-8 border border-red-400 rounded-full text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <MdDelete size={16} />
                        </motion.button>
                      )}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length + ((onDelete || onEdit) ? 2 : 1)}
                className="text-center text-gray-500 italic h-10 border-b border-gray-100"
              >
                No items added.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 border-t border-gray-200 font-semibold sticky bottom-0">
            <td className="px-2 py-1 sm:py-2" colSpan={(onDelete || onEdit) ? 2 : 1}>Total</td>
            {columns.map((col) => (
              <td key={String(col.key)} className="px-2 py-1 sm:py-2 truncate">
                {col.key === "opStock" ? totals.totalQty :
                  col.key === "basicAmount" ? totals.totalBasic :
                    col.key === "discountAmount" ? totals.totalDiscount :
                      col.key === "taxAmount" ? totals.totalTax :
                        col.key === "netValue" ? totals.totalNet : ""}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);
// ------------------ Utility Functions ------------------
const createItemRow = (fields: any[] = []) => {
  const base: any = {
    purchasePrice: "",
    salesPrice: "",
    mrp: "",
    barcode: "",
    opStock: "",
    branchPrice: "",  // ✅ Add branchPrice
    basicAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    netValue: 0,
  };
  fields.forEach(f => { 
    base[f.key] = f.type === "number" ? 0 : ""; 
  });
  return base;
};

// ------------------ Branch Fields ------------------
// ✅ FIXED: Keys should match model field names exactly
const FIELD_CONFIG: Record<string, any[]> = {
  fashion: [
    { key: "size", label: "Size", type: "text" },
    { key: "color", label: "Color", type: "text" },
  ],
  mart: [
    { key: "size", label: "Size", type: "text" },
  ],
  electronics: [
    { key: "size", label: "Size", type: "text" },
    { key: "color", label: "Color", type: "text" },
    { key: "srno", label: "Serial No", type: "text" },  // ✅ srno (lowercase)
    { key: "warrantydate", label: "Warranty Date", type: "date" },
  ],
};

// ------------------ Watchers ------------------
const BranchWatcher = ({ branchFields }: any) => {
  const { values, setFieldValue } = useFormikContext<any>();
  useEffect(() => {
    if (branchFields.length > 0 && (!values.items || values.items.length === 0)) {
      setFieldValue("items", [createItemRow(branchFields)], false);
    }
  }, [branchFields, values.items, setFieldValue]);
  return null;
};

const ItemCalculatorWatcher = () => {
  const { values, setFieldValue } = useFormikContext<any>();
  useEffect(() => {
    if (!values.items || !values.items[0]) return;

    const item = values.items[0];
    if (!item) return;

    const qty = Number(item.opStock) || 0;
    const price = Number(item.purchasePrice) || 0;
    const basicAmount = qty * price;
    const discountAmount = 0;
    const taxRate = item.taxSlab ? Number(String(item.taxSlab).replace("%", "")) || 0 : 0;
    const taxAmount = (basicAmount * taxRate) / 100;
    const netValue = basicAmount + taxAmount;

    setFieldValue("items[0].basicAmount", basicAmount.toFixed(2), false);
    setFieldValue("items[0].discountAmount", discountAmount.toFixed(2), false);
    setFieldValue("items[0].taxAmount", taxAmount.toFixed(2), false);
    setFieldValue("items[0].netValue", netValue.toFixed(2), false);
  }, [
    values.items?.[0]?.opStock,
    values.items?.[0]?.purchasePrice,
    values.items?.[0]?.taxSlab,
    setFieldValue,
    values.items
  ]);
  return null;
};

  interface GroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGroupCreated: (groupId: number, groupName: string) => void;
  }

  const CreateGroupModal: React.FC<GroupModalProps> = ({ isOpen, onClose, onGroupCreated }) => {
    const [groupName, setGroupName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateGroup = async () => {
      if (!groupName.trim()) {
        toast.error("Please enter group name");
        return;
      }

      setLoading(true);
      try {
        const token = sessionStorage.getItem("token");
        const response = await api.post(
          "groups/",
          { name: groupName.trim(), description: description.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.success) {
          toast.success("Group created successfully");
          // Return the new group id and name to parent component
          onGroupCreated(response.data.group.id, response.data.group.name);
          setGroupName("");
          setDescription("");
          onClose();
        } else {
          toast.error(response.data.message || "Failed to create group");
        }
      } catch (error: any) {
        console.error("Error creating group:", error);
        const errorMsg = error.response?.data?.errors?.name?.[0] ||
          error.response?.data?.message ||
          "Failed to create group";
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Create New Group</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group Name *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Electronics, Clothing, Grocery"
className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreateGroup}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Group"}
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
// ------------------ Main Component ------------------
const CreateItems: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [branchFields, setBranchFields] = useState<any[]>([]);
  const [branchLoaded, setBranchLoaded] = useState(false);
  const [addedItems, setAddedItems] = useState<VariantItem[]>([]);
  const [toggleOk, setToggleOk] = useState<boolean>(false);
  const [entryType, setEntryType] = useState<"company" | "manual">("company");
  const [loading, setLoading] = useState(true);
  const [initialItemData, setInitialItemData] = useState<any>(null);
  const [dataFetchComplete, setDataFetchComplete] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const [groups, setGroups] = useState<Array<{ id: number, name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: number, name: string, symbol: string, supports_fractional: boolean }>>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string>("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [checkingBarcode, setCheckingBarcode] = useState<boolean>(false);
  const [currentBarcode, setCurrentBarcode] = useState<string>("");
  const [groupsAndUnitsLoaded, setGroupsAndUnitsLoaded] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'superadmin';

  const [selectedUnit, setSelectedUnit] = useState<{
    id: number;
    name: string;
    symbol: string;
    supports_fractional: boolean;
  } | null>(null);

const checkBarcodeUniqueness = async (barcode: string, variantId?: number) => {

  if (!barcode || barcode.length < 3) {
    setBarcodeError("");
    return true;
  }

  setCheckingBarcode(true);
  try {
    const token = sessionStorage.getItem("token");
    let url = `barcodes/check-branch-barcode/?barcode=${encodeURIComponent(barcode)}`;
    if (variantId && variantId > 0) {
      url += `&exclude_variant=${variantId}`;
    }

    const res = await api.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.exists) {
      setBarcodeError(` Barcode "${barcode}" already exists in this branch`);
      return false;
    } else {
      setBarcodeError("");
      return true;
    }
  } catch (error) {
    console.error("Barcode check error:", error);
    setBarcodeError("");
    return true;
  } finally {
    setCheckingBarcode(false);
  }
};


const handleEditVariant = (row: VariantItem, setFieldValue: any) => {
  setFieldValue("items[0]", {
    purchasePrice: row.purchasePrice,
    salesPrice: row.salesPrice,
    mrp: row.mrp,
    barcode: row.barcode,
    opStock: row.opStock,
    branchPrice: row.branchPrice,
    basicAmount: row.basicAmount,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    netValue: row.netValue,
    ...branchFields.reduce((acc: any, f: any) => ({ ...acc, [f.key]: row[f.key] || "" }), {}),
  }, false);
  setEditingId(row.id);
  setBarcodeError("");
};

const handleCancelEdit = (setFieldValue: any) => {
  setFieldValue("items[0]", createItemRow(branchFields), false);
  setEditingId(null);
};


useEffect(() => {
  const fetchBranchType = async () => {
    try {
      const res = await api.get("user-branch/", {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      
      // ✅ Get branch_type and convert to lowercase for matching
      const type = res.data.branch_type?.toLowerCase() || "fashion";
      
      // ✅ Get fields from config, fallback to empty array
      const fields = FIELD_CONFIG[type] || [];
      setBranchFields(fields);
      setBranchLoaded(true);
      
      console.log("✅ Branch type:", type);
      console.log("✅ Branch fields:", fields);
    } catch (error) {
      console.error("Error fetching branch type:", error);
      setBranchFields([]);
      setBranchLoaded(true);
    }
  };
  fetchBranchType();
}, []);

  useEffect(() => {
    const fetchGroupsAndUnits = async () => {
      const token = sessionStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      setLoadingGroups(true);
      setLoadingUnits(true);

      try {
        const [groupsRes, unitsRes] = await Promise.all([
          api.get("all-groups/", { headers }),
          api.get("all-units/", { headers })
        ]);

        if (groupsRes.data && groupsRes.data.success) {
          setGroups(groupsRes.data.groups || []);
        }

        if (unitsRes.data && unitsRes.data.success) {
          setUnits(unitsRes.data.units || []);
        }

        console.log(" Groups loaded:", groupsRes.data.groups?.length || 0);
        console.log(" Units loaded:", unitsRes.data.units?.length || 0);
      } catch (error) {
        console.error("Error fetching groups/units:", error);
      } finally {
        setLoadingGroups(false);
        setLoadingUnits(false);
        setGroupsAndUnitsLoaded(true); // ✅ Flag set karo
      }
    };

    fetchGroupsAndUnits();
  }, []);

  useEffect(() => {
    const fetchCategoriesAndBrands = async () => {
      try {
        const token = sessionStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const [categoriesRes, brandsRes] = await Promise.all([
          api.get("categories/", { headers }),
          api.get("brands/", { headers })
        ]);

        setCategories(categoriesRes.data || []);
        const brandList = Array.isArray(brandsRes.data) ? brandsRes.data : brandsRes.data.results || [];
        setBrands(brandList);

        console.log(" Categories loaded:", categoriesRes.data?.length || 0);
        console.log(" Brands loaded:", brandList.length);
      } catch (error) {
        console.error("Error fetching categories/brands:", error);
      }
    };

    if (entryType === "company") {
      fetchCategoriesAndBrands();
    }
  }, [entryType]);
  useEffect(() => {
    if (!isSuperAdmin) {
      setEntryType("manual");
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!branchLoaded) return;

    if (isEditMode && id) {
      let isMounted = true;  // ✅ Prevent state updates after unmount

      const fetchItemData = async () => {
        setLoading(true);
        try {
          const token = sessionStorage.getItem("token");

          // ✅ Fetch units fresh inside this function
          const unitsRes = await api.get("all-units/", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const allUnits = unitsRes.data.units || [];

          const response = await api.get(`items/${id}/with-variants/`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!isMounted) return;

          if (response.data.success) {
            const itemData = response.data.item;
            const variantsData = response.data.variants;
            const entryTypeVal = itemData.entry_type || "company";

              if (!isSuperAdmin && itemData.created_by_superadmin) {
    toast.error("You can only edit manually created items.");
    navigate("/AddItems");
    return;
  }

            setEntryType(entryTypeVal);

            let brandId = "";
            let categoryId = "";
            let subCategoryId = "";
            let subSubCategoryId = "";

            if (entryTypeVal === "company") {
              // ✅ FIX: brand/category ab objects hain {id, name} — .id se lo
              brandId = itemData.brand?.id ? String(itemData.brand.id) : "";
              categoryId = itemData.category?.id ? String(itemData.category.id) : "";
              subCategoryId = itemData.subCategory?.id ? String(itemData.subCategory.id) : "";
              subSubCategoryId = itemData.subsubCategory?.id ? String(itemData.subsubCategory.id) : "";
            } else {
              brandId = itemData.manual_brand || "";
              categoryId = itemData.manual_category || "";
              subCategoryId = itemData.manual_subCategory || "";
              subSubCategoryId = itemData.manual_subSubCategory || "";
            }

            // ✅ FIX: group aur unit ab objects hain {id, name} — .id se lo
            const groupId = itemData.group?.id ? String(itemData.group.id) : "";
            const unitId = itemData.unit?.id ? String(itemData.unit.id) : "";

            // ✅ selectedUnit set karo directly from itemData (fresh fetch ki zaroorat nahi)
            if (itemData.unit?.id) {
              setSelectedUnit({
                id: itemData.unit.id,
                name: itemData.unit.name,
                symbol: itemData.unit.symbol || "",
                supports_fractional: itemData.unit.supports_fractional || false,
              });
            }

            setInitialItemData({
              itemName: itemData.itemName || "",
              brand: brandId,
              category: categoryId,
              subCategory: subCategoryId,
              subSubCategory: subSubCategoryId,
              group: groupId,
              unit: unitId,
              hsnCode: itemData.hsnCode || "",
              taxSlab: itemData.taxSlab || "",
              items: [createItemRow(branchFields)],
            });

            setToggleOk(itemData.website_display || false);

            const mappedVariants = variantsData.map((variant: any) => ({
              id: variant.id,
              purchasePrice: variant.purchasePrice,
              salesPrice: variant.salesPrice,
              mrp: variant.mrp,
              branchPrice: variant.branchPrice,
              barcode: variant.barcode || "",
              opStock: variant.opStock,
              basicAmount: variant.basicAmount,
              discountAmount: variant.discountAmount,
              taxAmount: variant.taxAmount,
              netValue: variant.netValue,
              ...branchFields.reduce((acc: any, f: any) => {
                acc[f.key] = variant[f.key] || "";
                return acc;
              }, {}),
            }));

            setAddedItems(mappedVariants);
          }
          setDataFetchComplete(true);
        } catch (error) {
          if (isMounted) {
            console.error("Error fetching item:", error);
            toast.error("Failed to load item data");
            navigate("/AddItems");
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchItemData();

      // ✅ Cleanup function to prevent state update on unmount
      return () => {
        isMounted = false;
      };
    } else {
      setLoading(false);
      setDataFetchComplete(true);
    }
  }, [id, isEditMode, branchFields, branchLoaded, navigate]); // ✅ REMOVED 'units' dependency

  const handleFinalSave = async (values: any) => {
    if (addedItems.length === 0) {
      toast.error("At least one variant required ");
      return;
    }

    console.log("=== SAVE DEBUG ===");
    console.log("isEditMode:", isEditMode);
    console.log("entryType:", entryType);
    console.log("addedItems:", addedItems.map(v => ({ id: v.id, barcode: v.barcode })));

    let groupIdValue = values.group;
    // ✅ FIX: Agar form value empty hai aur edit mode hai, initialItemData se lo
    if (!groupIdValue && isEditMode && initialItemData?.group) {
      groupIdValue = initialItemData.group;
    }
    if (groupIdValue === "undefined" || groupIdValue === "" || groupIdValue === null) {
      groupIdValue = null;
    } else if (groupIdValue && !isNaN(Number(groupIdValue))) {
      groupIdValue = Number(groupIdValue);
    }

    let unitIdValue = values.unit;
    // ✅ FIX: Agar form value empty hai aur edit mode hai, initialItemData se lo
    if (!unitIdValue && isEditMode && initialItemData?.unit) {
      unitIdValue = initialItemData.unit;
    }
    if (unitIdValue === "undefined" || unitIdValue === "" || unitIdValue === null) {
      unitIdValue = null;
    } else if (unitIdValue && !isNaN(Number(unitIdValue))) {
      unitIdValue = Number(unitIdValue);
    }

    // ✅ FIX: Handle brand, category based on entry type
    let brandValue = values.brand;
    let categoryValue = values.category;
    let subCategoryValue = values.subCategory;
    let subSubCategoryValue = values.subSubCategory;

    if (entryType === "company") {
      // Company entry: convert to number if possible, otherwise null
      brandValue = brandValue && !isNaN(Number(brandValue)) ? Number(brandValue) : null;
      categoryValue = categoryValue && !isNaN(Number(categoryValue)) ? Number(categoryValue) : null;
      subCategoryValue = subCategoryValue && !isNaN(Number(subCategoryValue)) ? Number(subCategoryValue) : null;
      subSubCategoryValue = subSubCategoryValue && !isNaN(Number(subSubCategoryValue)) ? Number(subSubCategoryValue) : null;
    }
    // Manual entry: keep as string (text values)

    // ✅ Create payload directly - NO LOOP that causes TypeScript error
    const payload = {
      itemName: values.itemName,
      entry_type: entryType,
      brand: brandValue,
      category: categoryValue,
      subCategory: subCategoryValue,
      subSubCategory: subSubCategoryValue,
      group_id: groupIdValue,
      unit_id: unitIdValue,
      hsnCode: values.hsnCode,
      taxSlab: values.taxSlab,
      website_display: toggleOk,
      variants: addedItems.map((v) => {
        const variantPayload: any = {
          purchasePrice: Number(v.purchasePrice),
          salesPrice: Number(v.salesPrice),
          mrp: Number(v.mrp),
          branchPrice: Number(v.branchPrice) || Number(v.purchasePrice),
          barcode: v.barcode || "",
          opStock: Number(v.opStock),
          basicAmount: Number(v.basicAmount),
          discountAmount: Number(v.discountAmount),
          taxAmount: Number(v.taxAmount),
          netValue: Number(v.netValue),
        };

        // Only include id if it's a positive number (existing variant)
        if (v.id && v.id > 0) {
          variantPayload.id = v.id;
        }


        // Add branch-specific fields
        branchFields.forEach((f) => {
          variantPayload[f.key] = v[f.key] || null;
        });

        return variantPayload;
      }),
    };

    console.log("📤 Final Payload:", JSON.stringify(payload, null, 2));

    try {
      const token = sessionStorage.getItem("token");

      if (isEditMode) {
        const response = await api.put(`item-update/${id}/`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("✅ Update response:", response.data);
        toast.success("Item updated successfully ");
      } else {
        const response = await api.post("item-create/", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("✅ Create response:", response.data);
        toast.success("Item & Variants saved successfully ");
      }

      setAddedItems([]);
      navigate("/AddItems");
    } catch (err: any) {
      console.error("Save failed:", err.response?.data || err);
      if (err.response?.data) {
        // Show detailed error
        const errors = err.response.data;
        if (typeof errors === 'object') {
          Object.keys(errors).forEach(key => {
            toast.error(`${key}: ${errors[key]}`);
          });
        } else {
          toast.error(errors.toString());
        }
      } else {
        toast.error(isEditMode ? "Update failed " : "Save failed ");
      }
    }
  };

const handleAddVariant = async (values: any, setFieldValue: any) => {
  if (!values.items || !values.items[0]) {
    toast.error("Please fill in variant details first");
    return;
  }
  const cur = values.items[0];
  if (!cur.purchasePrice || !cur.salesPrice || !cur.mrp) {
    toast.error("Please fill in Purchase Price, Sales Price, and MRP");
    return;
  }

  if (isSuperAdmin && cur.barcode && cur.barcode.trim() !== "") {
    // ✅ apna hi barcode dobara check na kare jab edit kar rahe ho
    const isUnique = await checkBarcodeUniqueness(cur.barcode, editingId ?? undefined);
    if (!isUnique) {
      toast.error(`Barcode "${cur.barcode}" already exists in this branch. Please use a different barcode.`);
      return;
    }
  }

  const variantPayload = {
    purchasePrice: Number(cur.purchasePrice),
    salesPrice: Number(cur.salesPrice),
    mrp: Number(cur.mrp),
    branchPrice: Number(cur.branchPrice) || Number(cur.purchasePrice),
    barcode: cur.barcode || "",
    opStock: Number(cur.opStock) || 0,
    basicAmount: Number(cur.basicAmount) || 0,
    discountAmount: Number(cur.discountAmount) || 0,
    taxAmount: Number(cur.taxAmount) || 0,
    netValue: Number(cur.netValue) || 0,
    ...branchFields.reduce((acc, f) => ({ ...acc, [f.key]: cur[f.key] || "" }), {}),
  };

  if (editingId !== null) {
    // ✅ UPDATE existing row (id preserved so backend knows it's an existing variant)
    setAddedItems(prev => prev.map(v => v.id === editingId ? { ...v, ...variantPayload, id: editingId } : v));
    toast.success("Variant updated successfully");
    setEditingId(null);
  } else {
    const newVariant = { id: -Date.now(), ...variantPayload };
    setAddedItems(prev => [...prev, newVariant]);
    toast.success("Variant added successfully");
  }

  setFieldValue("items[0]", createItemRow(branchFields), false);
  setBarcodeError("");
};

  const deleteVariant = async (row: VariantItem) => {
    if (!window.confirm("Delete this variant?")) return;

    if (row.id && row.id > 0) {
      try {
        await api.delete(`variant-delete/${row.id}/`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        });
        toast.success("Variant deleted successfully");
} catch (err: any) {
        console.error("Delete failed:", err);
        const msg = err.response?.data?.error || "Failed to delete variant";
        toast.error(msg);
        return;
      }
    }

    setAddedItems(prev => prev.filter(v => v.id !== row.id));
  }
 

  const calculateTotals = (items: VariantItem[]) => ({
    totalQty: items.reduce((sum, it) => sum + Number(it.opStock || 0), 0),
    totalBasic: items.reduce((sum, it) => sum + Number(it.basicAmount || 0), 0).toFixed(2),
    totalDiscount: items.reduce((sum, it) => sum + Number(it.discountAmount || 0), 0).toFixed(2),
    totalTax: items.reduce((sum, it) => sum + Number(it.taxAmount || 0), 0).toFixed(2),
    totalNet: items.reduce((sum, it) => sum + Number(it.netValue || 0), 0).toFixed(2),
  });

  if (loading || !branchLoaded || !dataFetchComplete || !groupsAndUnitsLoaded) {
    return (
      <div className="bg-gray-100 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="flex items-center justify-between p-2">
        <div className="bg-blue-200 p-2 rounded-lg">
          <span className="text-blue-800 font-bold text-sm sm:text-base">
            {isEditMode ? "EDIT ITEM" : "ITEM CREATION"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/AddItems")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow flex items-center gap-1"
        >
          <MdArrowBack /> Back
        </button>
      </div>

      <Formik
        enableReinitialize
        initialValues={initialItemData || {
          itemName: "",
          brand: "",
          category: "",
          subCategory: "",
          subSubCategory: "",
          group: "",
          unit: "",
          hsnCode: "",
          taxSlab: "",
          items: [createItemRow(branchFields)],
        }}
        validationSchema={validationSchema}
        validateOnChange={true}
        validateOnBlur={true}
        // ✅ Pass entryType to validation context
        context={{ entryType }}
        onSubmit={handleFinalSave}
      >
        {({
    values,
    setFieldValue,
    validateForm,
    setTouched,
}) => {
          const totals = calculateTotals(addedItems);

          // ✅ YAHAN PAR handleGroupCreated FUNCTION DEFINE KAREIN
          const handleGroupCreated = (groupId: number, groupName: string) => {
            // Add the new group to the groups list
            setGroups(prevGroups => [...prevGroups, { id: groupId, name: groupName }]);
            // Automatically select the newly created group - setFieldValue available hai
            setFieldValue("group", String(groupId));
            toast.success(`Group "${groupName}" created and selected`);
          };

          useEffect(() => {
            const fetchSubCategories = async () => {
              const categoryId = values.category || (isEditMode && initialItemData?.category);

              // ✅ FIX: Only fetch if categoryId is a valid number (for company entry)
              if (!categoryId || !String(categoryId).match(/^\d+$/)) {
                setSubCategories([]);
                if (!isEditMode) {
                  setFieldValue("subCategory", "");
                }
                return;
              }

              try {
                const res = await api.get(`subcategories/?category=${categoryId}`);
                setSubCategories(res.data);

                if (isEditMode && initialItemData?.subCategory && !values.subCategory) {
                  setFieldValue("subCategory", String(initialItemData.subCategory));
                }
              } catch (error) {
                console.error("Error fetching subcategories:", error);
                setSubCategories([]);
              }
            };

            fetchSubCategories();
          }, [values.category, isEditMode, initialItemData?.category, setFieldValue]);

          useEffect(() => {
            const fetchSubSubCategories = async () => {
              const subCategoryId = values.subCategory || (isEditMode && initialItemData?.subCategory);

              // ✅ FIX: Only fetch if subCategoryId is a valid number
              if (!subCategoryId || !String(subCategoryId).match(/^\d+$/)) {
                setSubSubCategories([]);
                if (!isEditMode) {
                  setFieldValue("subSubCategory", "");
                }
                return;
              }

              try {
                const res = await api.get(`subsubcategories/?subcategory=${subCategoryId}`);
                setSubSubCategories(res.data);

                if (isEditMode && initialItemData?.subSubCategory && !values.subSubCategory) {
                  setFieldValue("subSubCategory", String(initialItemData.subSubCategory));
                }
              } catch (error) {
                console.error("Error fetching subsubcategories:", error);
                setSubSubCategories([]);
              }
            };

            fetchSubSubCategories();
          }, [values.subCategory, isEditMode, initialItemData?.subCategory, setFieldValue]);

          // CreateItems.tsx - Fixed version (remove duplicate grid)

          return (
            <Form className="bg-white p-2 sm:p-3 md:p-4">
              <BranchWatcher branchFields={branchFields} />
              <ItemCalculatorWatcher />

              {/* Entry Type Selection */}
              <div className="col-span-full flex items-center justify-between mt-1 gap-6">
                <div className="flex gap-6 items-center">
                  {isSuperAdmin && (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="radio"
                        checked={entryType === "company"}
                        onChange={() => setEntryType("company")}
                        disabled={isEditMode}
                      />
                      Company
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      checked={entryType === "manual"}
                      onChange={() => setEntryType("manual")}
                      disabled={isEditMode}
                    />
                    Manual
                  </label>
                </div>
              </div>

              {/* Item Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="col-span-full border-b pb-1">
                  <h2 className="text-sm font-semibold text-blue-700">Item Details</h2>
                </div>

                <FormInput label="Item Name" name="itemName" />

                {entryType === "company" ? (
                  <>
                    <FormSelect
                      label="Brand"
                      name="brand"
                      options={brands.map(b => ({ label: b.brand_name, value: String(b.id) }))}
                    />
                    <FormSelect
                      label="Category"
                      name="category"
                      options={categories.map(c => ({ label: c.name, value: String(c.id) }))}
                    />
                    <FormSelect
                      label="Sub Category"
                      name="subCategory"
                      options={subCategories.map(sc => ({ label: sc.name, value: String(sc.id) }))}
                    />
                    <FormSelect
                      label="Sub Sub Category"
                      name="subSubCategory"
                      options={subSubCategories.map(ssc => ({ label: ssc.name, value: String(ssc.id) }))}
                    />
                  </>
                ) : (
                  <>
                    <FormInput label="Brand" name="brand" />
                    <FormInput label="Category" name="category" />
                    <FormInput label="Sub Category" name="subCategory" />
                    <FormInput label="Sub Sub Category" name="subSubCategory" />
                  </>
                )}

                {/* Group Select */}
                <div className="text-xs sm:text-sm">
                  <label className="block font-medium text-gray-600">Group</label>
                  <div className="flex gap-2">
                    <select
                      className="w-full p-1 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm bg-white"
                      name="group"
                      value={values.group || ''}
                      onChange={(e) => setFieldValue("group", e.target.value)}
                    >
                      <option value="">Select Group</option>
                      {loadingGroups ? (
                        <option disabled>Loading groups...</option>
                      ) : groups.length === 0 ? (
                        <option disabled>No groups available</option>
                      ) : (
                        groups.map((g) => (
                          <option key={g.id} value={String(g.id)}>
                            {g.name}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowGroupModal(true)}
                      className="bg-blue-500 text-white px-3 rounded text-xs hover:bg-blue-600 whitespace-nowrap flex items-center gap-1"
                    >
                      <FaPlus size={12} /> New
                    </button>
                  </div>
                </div>

                {/* Unit Dropdown */}
                <div className="text-xs sm:text-sm">
                  <label className="block font-medium text-gray-600">Unit</label>
                  <div className="flex gap-2">
                    <select
                      className="w-full p-1 sm:p-2 border border-gray-300 rounded text-xs sm:text-sm bg-white"
                      name="unit"
                      value={values.unit || ''}
                      onChange={(e) => {
                        const unitId = e.target.value;
                        setFieldValue("unit", unitId);
                        const unit = units.find(u => String(u.id) === unitId);
                        if (unit) setSelectedUnit(unit);
                      }}
                    >
                      <option value="">Select Unit</option>
                      {loadingUnits ? (
                        <option disabled>Loading units...</option>
                      ) : units.length === 0 ? (
                        <option disabled>No units available</option>
                      ) : (
                        units.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {u.name} {u.symbol && `(${u.symbol})`} {u.supports_fractional && " Fractional"}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <FormInput label="HSN Code" name="hsnCode" />
                <FormSelect label="Tax Slab" name="taxSlab" options={["5%", "12%", "18%", "28%", "Tax Free"].map(t => ({ label: t, value: t }))} />
              </div>

{/* ✅ Size/Price Details Section - Variant fields pehle, prices baad mein */}
<div className="col-span-full mt-3 rounded-b-lg shadow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pb-10">
  <div className="col-span-full border-b pb-1">
    <h2 className="text-sm font-semibold text-blue-700">Size / Price Details</h2>
  </div>

  {/* ✅ MAIN GRID - Variant fields PEHLE, prices BAAD mein */}
  <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2 bg-gray-50 p-2 rounded">

    {/* ✅ STEP 1: VARIANT FIELDS PEHLE (size, color, srno, warrantydate) */}
    {branchFields.length > 0 && (
      <>
        {branchFields.map((field) => (
          <FormInput
            key={field.key}
            label={field.label}
            name={`items[0].${field.key}`}
            type={field.type === "date" ? "date" : "text"}
          />
        ))}
      </>
    )}

    {/* ✅ STEP 2: PRICES - P.Price (Source) */}
    <FormInput label="P.Price (Source)" name="items[0].purchasePrice" type="number" />

    {/* ✅ STEP 3: Branch Price (only for Super Admin) */}
    {isSuperAdmin && (
      <FormInput label="Branch Price" name="items[0].branchPrice" type="number" />
    )}

    {/* ✅ STEP 4: Sales Price */}
    <FormInput label="S.Price" name="items[0].salesPrice" type="number" />

    {/* ✅ STEP 5: MRP */}
    <FormInput label="M.R.P" name="items[0].mrp" type="number" />

{/* STEP 6: Barcode - Now completely optional for everyone */}
<div className="text-xs sm:text-sm">
  <label className="block font-medium text-gray-600">
    Barcode
    
  </label>
  <input
    type="text"
    name="items[0].barcode"
    value={values.items?.[0]?.barcode || ""}
    onChange={(e) => {
      const newValue = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
      setFieldValue("items[0].barcode", newValue);
      setCurrentBarcode(newValue);
      
      // Still check uniqueness if user enters a barcode, but don't require it
      if (newValue.length >= 3) {
        setTimeout(async () => {
          if (currentBarcode === newValue) {
            await checkBarcodeUniqueness(newValue, editingId ?? undefined);
          }
        }, 500);
      } else {
        setBarcodeError("");
      }
    }}
    onBlur={async () => {
      const val = values.items?.[0]?.barcode;
      if (val && val.length >= 3) {
        await checkBarcodeUniqueness(val, editingId ?? undefined);
      }
    }}

    className={`w-full p-1 sm:p-2 border ${
      barcodeError ? "border-red-500" : "border-gray-300"
    } rounded text-xs sm:text-sm bg-white`}
  />
  {barcodeError && (
    <div className="text-red-500 text-[10px] sm:text-xs mt-1">{barcodeError}</div>
  )}
  
</div>

    {/* ✅ STEP 7: Opening Stock */}
    <FormInput label="Op.Stock" name="items[0].opStock" type="number" />

    {/* ✅ STEP 8: Net Value (Display only) */}
    <DisplayField label="Net" value={values.items?.[0]?.netValue || "0.00"} />

{/* ✅ STEP 9: Add / Update Button */}
    <div className="flex items-end gap-1">
      <button
        type="button"
        onClick={async () => {

    const errors = await validateForm();

    setTouched({
        items: [
            {
                purchasePrice: true,
                salesPrice: true,
                mrp: true,
                opStock: true,
                barcode: true,
            },
        ],
    });

    if (errors.items) {
        return;
    }

    handleAddVariant(values, setFieldValue);
}}
        className="bg-green-600 text-white flex-1 p-1 sm:p-2 rounded hover:bg-green-700 flex items-center justify-center text-xs h-8 sm:h-9"
      >
        <FaCheckCircle className="mr-1" /> {editingId !== null ? "Update" : "Add"}
      </button>
      {editingId !== null && (
        <button
          type="button"
          onClick={() => handleCancelEdit(setFieldValue)}
          className="bg-gray-400 text-white px-2 rounded hover:bg-gray-500 text-xs h-8 sm:h-9"
        >
          Cancel
        </button>
      )}
    </div>
  </div>


                {/* Fractional unit info display */}
                {selectedUnit?.supports_fractional && (
                  <div className="col-span-full mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-xs text-blue-700">
                      <span className="font-semibold">{selectedUnit.symbol}</span> - Proportional pricing active
                      {values.items?.[0]?.opStock && values.items?.[0]?.purchasePrice && Number(values.items[0].opStock) > 0 && (
                        <span className="ml-2">
                          total amount for {selectedUnit.symbol}: ₹{(
                            Number(values.items[0].purchasePrice) * Number(values.items[0].opStock)
                          ).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* DataTable */}
                <div className="col-span-full mt-2 overflow-x-auto">
                  <DataTable
                    data={addedItems}
                    columns={[
                      ...branchFields.map(f => ({ key: f.key, label: f.label })),
                      { key: "purchasePrice", label: "P.Price" },
                      ...(isSuperAdmin ? [{ key: "branchPrice", label: "Branch Price" }] : []),
                      { key: "salesPrice", label: "S.Price" },
                      { key: "mrp", label: "M.R.P" },
                      { key: "barcode", label: "Barcode" },
                      { key: "opStock", label: "Op.Stock" },
                    ]}
                    totals={totals}
                    onEdit={(row) => handleEditVariant(row, setFieldValue)}
                    onDelete={deleteVariant}
                  />
                </div>

                {/* Website Display (only for company items) */}
                {entryType === "company" && (
                  <div className="col-span-full mt-4 p-3 border rounded bg-gray-50 flex items-center gap-3 max-w-xs">
                    <label className="font-semibold text-gray-700 text-sm">Website Display</label>
                    <input
                      type="checkbox"
                      checked={toggleOk}
                      onChange={() => setToggleOk(!toggleOk)}
                      className="w-6 h-6 rounded border border-gray-300 cursor-pointer checked:bg-blue-600 checked:border-blue-600 transition"
                    />
                    <span className="text-sm font-medium text-gray-600">
                      {toggleOk ? "Ok" : ""}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="col-span-full flex fixed bottom-0 left-0 right-0 bg-white p-2 sm:p-3 shadow gap-2 flex-wrap justify-center z-10">
                  <button type="submit" className="bg-blue-500 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-blue-600">
                    {isEditMode ? "Update" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/pendingBarcodes")}
                    className="bg-blue-500 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm hover:bg-blue-600 flex items-center gap-1"
                  >
                    🔲 Pending Barcodes
                  </button>
                </div>
              </div>
            </Form>
          );
        }}
      </Formik>

      {/* ✅ MODAL YAHAN RENDER KARO — Formik ke bahar */}
      {showGroupModal && (
        <CreateGroupModal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onGroupCreated={(groupId, groupName) => {
            setGroups(prev => [...prev, { id: groupId, name: groupName }]);
            // ⚠️ setFieldValue yahan available nahi — isliye sirf groups update karo
            // User manually select karega ya auto-select ke liye neeche wala approach use karo
            toast.success(`Group "${groupName}" created and added to list`);
          }}
        />
      )}
    </div>
  );
};

export default CreateItems;