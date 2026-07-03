// CreateGroup.tsx - Updated with DataTable
import React, { useState, useEffect } from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { MdArrowBack, MdSave } from "react-icons/md";
import api from "../../api/api";
import { toast } from "react-toastify";
import DataTable from "../../components/common/DataTable";

// Validation Schema
const groupValidationSchema = Yup.object({
  name: Yup.string()
    .required("Group name is required")
    .max(100, "Max 100 characters"),
  description: Yup.string()
    .max(200, "Max 200 characters"),
});

interface Group {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch all groups
// ✅ NAYA CODE - WITH PAGINATION SUPPORT
// CreateGroup.tsx - Fix fetchGroups function
const fetchGroups = async (page = 1) => {
  setLoading(true);
  try {
    const token = sessionStorage.getItem("token");
    const response = await api.get(`groups/?page=${page}&page_size=${pageSize}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // ✅ Handle both paginated and non-paginated responses
    if (response.data.results) {
      // Paginated response: { count, next, previous, results: { success, groups } }
      const results = response.data.results;
      if (results && results.groups) {
        setGroups(results.groups);
      } else if (Array.isArray(results)) {
        setGroups(results);
      } else {
        setGroups([]);
      }
      setTotalItems(response.data.count || 0);
    } 
    // ✅ Direct response format
    else if (response.data.success && response.data.groups) {
      setGroups(response.data.groups);
      setTotalItems(response.data.groups.length);
    }
    // ✅ Array response format
    else if (Array.isArray(response.data)) {
      setGroups(response.data);
      setTotalItems(response.data.length);
    }
  } catch (error) {
    console.error("Error fetching groups:", error);
    toast.error("Failed to fetch groups");
  } finally {
    setLoading(false);
  }
};

// ✅ Jab page ya pageSize change ho toh fetch karo
useEffect(() => {
  fetchGroups(currentPage);
}, [currentPage, pageSize]);

  // Create/Update group
  const handleSubmit = async (values: any, { resetForm }: any) => {
    try {
      const token = sessionStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      if (editingGroup) {
        const response = await api.put(
          `groups/${editingGroup.id}/`,
          values,
          { headers }
        );
        if (response.data.success) {
          toast.success("Group updated successfully");
          fetchGroups();
          setEditingGroup(null);
          resetForm();
          setShowForm(false);
        }
      } else {
        const response = await api.post("groups/", values, { headers });
        if (response.data.success) {
          toast.success("Group created successfully");
          fetchGroups();
          resetForm();
          setShowForm(false);
        }
      }
    } catch (error: any) {
      console.error("Error saving group:", error);
      const errorMsg = error.response?.data?.errors?.name?.[0] || 
                       error.response?.data?.message || 
                       "Failed to save group";
      toast.error(errorMsg);
    }
  };

  // Delete group
  const handleDelete = async (group: Group) => {
    if (!window.confirm(`Are you sure you want to delete group "${group.name}"?`)) {
      return;
    }
    
    try {
      const token = sessionStorage.getItem("token");
      const response = await api.delete(`groups/${group.id}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success("Group deleted successfully");
        fetchGroups();
      } else {
        toast.error(response.data.message || "Failed to delete group");
      }
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast.error(error.response?.data?.message || "Failed to delete group");
    }
  };

  // Edit group
  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setShowForm(true);
  };

  // Cancel edit
  const handleCancel = () => {
    setEditingGroup(null);
    setShowForm(false);
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "description", label: "Description", render: (item: Group) => item.description || "-" },
    { 
      key: "created_at", 
      label: "Created At",
      render: (item: Group) => new Date(item.created_at).toLocaleDateString()
    }
  ];

  // Paginate groups locally since backend doesn't support pagination
  /* const paginatedGroups = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize); */

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <MdArrowBack size={20} />
                <span>Back</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Manage Groups</h1>
            </div>
            {!showForm && (
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setShowForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Create New Group
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">
              {editingGroup ? "Edit Group" : "Create New Group"}
            </h2>
            <Formik
              initialValues={{
                name: editingGroup?.name || "",
                description: editingGroup?.description || "",
              }}
              validationSchema={groupValidationSchema}
              onSubmit={handleSubmit}
              enableReinitialize
            >
              {({ errors, touched, isSubmitting }) => (
                <Form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Group Name *
                    </label>
                    <Field
                      name="name"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Electronics, Clothing, Grocery"
                    />
                    {errors.name && touched.name && (
                      <div className="text-red-600 text-sm mt-1">{errors.name}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <Field
                      name="description"
                      as="textarea"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional description"
                    />
                    {errors.description && touched.description && (
                      <div className="text-red-600 text-sm mt-1">{errors.description}</div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <MdSave />
                      {isSubmitting ? "Saving..." : editingGroup ? "Update" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        )}

        {/* Groups List using DataTable */}
        <DataTable
          data={groups}           // ✅ Direct groups array
          columns={columns}
          title="All Groups"
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loading}
          totalItems={totalItems}  // ✅ Server se aaya total count
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
};

export default CreateGroup;