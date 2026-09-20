// pos/frontend/src/pages/items/websiteitemdetail.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { 
  FiArrowLeft, FiSave, FiImage, FiInfo, FiPackage, 
  FiTruck, FiShield, FiList, FiCheckCircle, FiXCircle,
  FiPlus, FiTrash2, FiUpload, FiClock, FiEdit2, FiGrid
} from 'react-icons/fi';
import { MdOutlineStorefront } from 'react-icons/md';
import api from '../../api/api';

// Types
interface Variant {
  id: number;
  purchasePrice: number;
  salesPrice: number; 
  mrp: number;
  barcode: string;
  opStock: number;
  basicAmount: number;
  discountAmount: number;
  taxAmount: number;
  netValue: number;
  current_stock: number;
  size?: string;
  color?: string;
  srno?: string;
  warrantydate?: string;
  variant_image?: string | null;
}

interface GalleryImage {
  id?: number;
  image: string;
  image_url?: string;
}

interface WebsiteItem {
  id: number;
  itemName: string;
  entry_type: string;
  branch_name: string;
  brand: { id: number | null; name: string } | null;
  category: { id: number | null; name: string } | null;
  subCategory: { id: number | null; name: string } | null;
  subsubCategory: { id: number | null; name: string } | null;
  unit: { id: number; name: string; symbol: string } | string | null; 
  hsnCode: string;
  taxSlab: string;
  variants: Variant[];
  gallery?: string[];
  
  // Product fields
  short_description: string;
  full_description: string;
  keywords: string;
  main_image: string | null;
  thumbnail_image: string | null;
  product_condition: string;
  return_policy: string;
  estimated_delivery_time: string;
  free_shipping: boolean;
  warranty_available: boolean;
  warranty_period: string;
  warranty_type: string;
  warranty_description: string;
  description_features: { id: number; value: string }[];
  specifications: { id: number; title: string; value: string }[];
  website_status: 'pending' | 'approved' | 'rejected' | 'draft';
  linked_product: number | null;
  created_at: string;
  updated_at: string;
}

const WebsiteItemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<WebsiteItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [newFeature, setNewFeature] = useState('');
  const [newSpecTitle, setNewSpecTitle] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [existingGalleryUrls, setExistingGalleryUrls] = useState<string[]>([]);
  const [variantImages, setVariantImages] = useState<{ [key: number]: File | null }>({});

  const isVariantProduct = item && item.variants && item.variants.length > 1;

  // Helper function for image URLs
 // Helper function for image URLs - FIXED
const getFullUrl = (mediaPath: string | null | undefined): string | null => {
    if (!mediaPath) return null;
    
    // If it's already a full URL, return as is
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
        return mediaPath;
    }
    
    // Django backend URL - make sure this matches your backend
    const API_BASE_URL = "http://localhost:8000";
    
    // If path starts with /media/, append directly
    if (mediaPath.startsWith('/media/')) {
        return `${API_BASE_URL}${mediaPath}`;
    }
    
    // If path doesn't start with /media/, add it
    return `${API_BASE_URL}/media/${mediaPath}`;
};
// Add this helper function at the top of your component (after getFullUrl)
const getUnitDisplay = (unit: { id: number; name: string; symbol: string } | string | null | undefined): string => {
  if (!unit) return '-';
  if (typeof unit === 'object' && unit.name) {
    return unit.name;
  }
  if (typeof unit === 'string') {
    return unit;
  }
  return '-';
};

  useEffect(() => {
    if (id) {
      fetchItem();
    }
    return () => {
      // Cleanup preview URLs
      galleryPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);

// Update fetchItem to handle gallery as string[]
const fetchItem = async (): Promise<void> => {
    setLoading(true);
    try {
        const response = await api.get<{ item: WebsiteItem }>(`website-items/${id}/`);
        
        if (response.data && response.data.item) {
            const fetchedItem = response.data.item;
            
            // Ensure arrays exist
            fetchedItem.description_features = fetchedItem.description_features || [];
            fetchedItem.specifications = fetchedItem.specifications || [];
            fetchedItem.gallery = fetchedItem.gallery || [];
            
            setItem(fetchedItem);
            
            // Set image previews
            if (fetchedItem.main_image) {
                setMainImagePreview(getFullUrl(fetchedItem.main_image));
            }
            if (fetchedItem.thumbnail_image) {
                setThumbnailPreview(getFullUrl(fetchedItem.thumbnail_image));
            }
            
            // Set existing gallery images - gallery is array of strings (paths)
            if (fetchedItem.gallery && fetchedItem.gallery.length > 0) {
                const galleryUrls = fetchedItem.gallery.map(path => getFullUrl(path) || '');
                setExistingGalleryUrls(galleryUrls.filter(url => url));
            }
        }
    } catch (error) {
        console.error('Error fetching item:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to load item details',
            icon: 'error',
            confirmButtonColor: '#3085d6'
        });
        navigate('/WebItems');
    } finally {
        setLoading(false);
    }
};

  const handleFieldChange = (field: string, value: any) => {
    if (item) {
      setItem({ ...item, [field]: value });
    }
  };

  const handleDescriptionFeatureChange = (id: number, value: string) => {
    if (item) {
      const updatedFeatures = item.description_features.map(f => 
        f.id === id ? { ...f, value } : f
      );
      setItem({ ...item, description_features: updatedFeatures });
    }
  };

  const addDescriptionFeature = () => {
    if (item && newFeature.trim()) {
      const newId = Math.max(0, ...item.description_features.map(f => f.id), 0) + 1;
      setItem({
        ...item,
        description_features: [...item.description_features, { id: newId, value: newFeature.trim() }]
      });
      setNewFeature('');
    }
  };

  const removeDescriptionFeature = (id: number) => {
    if (item) {
      setItem({
        ...item,
        description_features: item.description_features.filter(f => f.id !== id)
      });
    }
  };

  const handleSpecificationChange = (id: number, field: 'title' | 'value', value: string) => {
    if (item) {
      const updatedSpecs = item.specifications.map(spec =>
        spec.id === id ? { ...spec, [field]: value } : spec
      );
      setItem({ ...item, specifications: updatedSpecs });
    }
  };

  const addSpecification = () => {
    if (item && newSpecTitle.trim() && newSpecValue.trim()) {
      const newId = Math.max(0, ...item.specifications.map(s => s.id), 0) + 1;
      setItem({
        ...item,
        specifications: [...item.specifications, { 
          id: newId, 
          title: newSpecTitle.trim(), 
          value: newSpecValue.trim() 
        }]
      });
      setNewSpecTitle('');
      setNewSpecValue('');
    }
  };

  const removeSpecification = (id: number) => {
    if (item) {
      setItem({
        ...item,
        specifications: item.specifications.filter(spec => spec.id !== id)
      });
    }
  };

const handleImageUpload = async (type: 'main' | 'thumbnail', file: File) => {
    if (!item) return;

    const formData = new FormData();
    
    // ✅ CRITICAL: Include ALL existing data along with the image
    formData.append(`${type}_image`, file);
    
    // ✅ Preserve all text fields
    formData.append('short_description', item.short_description || '');
    formData.append('full_description', item.full_description || '');
    formData.append('keywords', item.keywords || '');
    formData.append('product_condition', item.product_condition || 'New');
    formData.append('return_policy', item.return_policy || '');
    formData.append('estimated_delivery_time', item.estimated_delivery_time || '');
    formData.append('free_shipping', item.free_shipping ? 'true' : 'false');
    formData.append('warranty_available', item.warranty_available ? 'true' : 'false');
    formData.append('warranty_period', item.warranty_period || '');
    formData.append('warranty_type', item.warranty_type || '');
    formData.append('warranty_description', item.warranty_description || '');
    
    // ✅ Preserve JSON fields
    formData.append('description_features', JSON.stringify(item.description_features || []));
    formData.append('specifications', JSON.stringify(item.specifications || []));
    
    // ✅ Preserve existing gallery URLs
    if (existingGalleryUrls.length > 0) {
        const galleryPaths = existingGalleryUrls.map(url => {
            let path = url;
            if (url.includes('http://localhost:8000')) {
                path = url.replace('http://localhost:8000', '');
            }
            return path;
        });
        formData.append('existing_gallery_urls', JSON.stringify(galleryPaths));
    }

    try {
        const response = await api.patch(`website-items/${id}/update/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (type === 'main') {
            setMainImagePreview(URL.createObjectURL(file));
            setItem({ ...item, main_image: response.data.item.main_image });
        } else {
            setThumbnailPreview(URL.createObjectURL(file));
            setItem({ ...item, thumbnail_image: response.data.item.thumbnail_image });
        }
        
        await Swal.fire({
            title: 'Success',
            text: 'Image uploaded successfully',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
        
        // Refresh to get updated data
        await fetchItem();
        
    } catch (error) {
        console.error('Error uploading image:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to upload image',
            icon: 'error',
            confirmButtonColor: '#d33'
        });
    }
};

  const handleGalleryImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 5) {
      Swal.fire('Warning', 'Maximum 5 gallery images allowed', 'warning');
      return;
    }
    
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        Swal.fire('Error', `File ${file.name} is not an image`, 'error');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Error', `File ${file.name} is too large (max 5MB)`, 'error');
        return false;
      }
      return true;
    });
    
    setGalleryImages(validFiles);
    
    // Create previews
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    // Cleanup old previews
    galleryPreviews.forEach(url => URL.revokeObjectURL(url));
    setGalleryPreviews(newPreviews);
  };

  const removeGalleryImage = (index: number, isExisting: boolean = false, existingIndex?: number) => {
    if (isExisting && existingIndex !== undefined) {
      // Remove existing gallery image (you may need to call API to delete)
      const newUrls = [...existingGalleryUrls];
      newUrls.splice(existingIndex, 1);
      setExistingGalleryUrls(newUrls);
    } else {
      // Remove newly added image
      const newImages = [...galleryImages];
      newImages.splice(index, 1);
      setGalleryImages(newImages);
      
      // Revoke and update previews
      URL.revokeObjectURL(galleryPreviews[index]);
      const newPreviews = galleryPreviews.filter((_, i) => i !== index);
      setGalleryPreviews(newPreviews);
    }
  };

const handleVariantImageUpload = async (variantIndex: number, file: File) => {
    if (!item) return;

    const formData = new FormData();
    formData.append(`variant_images_${variantIndex}`, file);
    
    // ✅ Preserve ALL existing data
    formData.append('short_description', item.short_description || '');
    formData.append('full_description', item.full_description || '');
    formData.append('keywords', item.keywords || '');
    formData.append('product_condition', item.product_condition || 'New');
    formData.append('return_policy', item.return_policy || '');
    formData.append('estimated_delivery_time', item.estimated_delivery_time || '');
    formData.append('free_shipping', item.free_shipping ? 'true' : 'false');
    formData.append('warranty_available', item.warranty_available ? 'true' : 'false');
    formData.append('warranty_period', item.warranty_period || '');
    formData.append('warranty_type', item.warranty_type || '');
    formData.append('warranty_description', item.warranty_description || '');
    formData.append('description_features', JSON.stringify(item.description_features || []));
    formData.append('specifications', JSON.stringify(item.specifications || []));
    
    // Preserve existing gallery URLs
    if (existingGalleryUrls.length > 0) {
        const galleryPaths = existingGalleryUrls.map(url => {
            let path = url;
            if (url.includes('http://localhost:8000')) {
                path = url.replace('http://localhost:8000', '');
            }
            return path;
        });
        formData.append('existing_gallery_urls', JSON.stringify(galleryPaths));
    }

    try {
        const response = await api.patch(`website-items/${id}/update/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        setVariantImages(prev => ({ ...prev, [variantIndex]: null }));
        await fetchItem();
        
        await Swal.fire({
            title: 'Success',
            text: 'Variant image uploaded successfully',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Error uploading variant image:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to upload variant image',
            icon: 'error',
            confirmButtonColor: '#d33'
        });
    }
}; 
const handleSave = async () => {
    if (!item) return;
    
    setSaving(true);
    try {
        const formData = new FormData();
        
        // Log current state for debugging
        console.log('💾 SAVING ITEM DATA:', {
            short_description: item.short_description,
            full_description: item.full_description,
            keywords: item.keywords,
            description_features: item.description_features,
            specifications: item.specifications,
            warranty_available: item.warranty_available,
            gallery: item.gallery,
            existingGalleryUrls: existingGalleryUrls
        });
        
        // Add all text fields - ALWAYS send even if empty
        formData.append('short_description', item.short_description || '');
        formData.append('full_description', item.full_description || '');
        formData.append('keywords', item.keywords || '');
        formData.append('product_condition', item.product_condition || 'New');
        formData.append('return_policy', item.return_policy || '');
        formData.append('estimated_delivery_time', item.estimated_delivery_time || '');
        formData.append('free_shipping', item.free_shipping ? 'true' : 'false');
        formData.append('warranty_available', item.warranty_available ? 'true' : 'false');
        formData.append('warranty_period', item.warranty_period || '');
        formData.append('warranty_type', item.warranty_type || '');
        formData.append('warranty_description', item.warranty_description || '');
        
        // JSON fields - ALWAYS send as JSON strings
        const featuresJson = JSON.stringify(item.description_features || []);
        const specsJson = JSON.stringify(item.specifications || []);
        
        formData.append('description_features', featuresJson);
        formData.append('specifications', specsJson);
        
        console.log('📤 Sending JSON:', {
            description_features: featuresJson,
            specifications: specsJson
        });
        
        // Add new gallery images
        if (galleryImages.length > 0) {
            galleryImages.forEach((file) => {
                formData.append('gallery_images', file);
                console.log('📸 Adding gallery image:', file.name);
            });
        }
        
        // Add existing gallery URLs to keep - convert to paths
        if (existingGalleryUrls.length > 0) {
            const galleryPaths = existingGalleryUrls.map(url => {
                // Extract just the path from full URL
                let path = url;
                if (url.includes('http://localhost:8000')) {
                    path = url.replace('http://localhost:8000', '');
                }
                return path;
            });
            formData.append('existing_gallery_urls', JSON.stringify(galleryPaths));
            console.log('📸 Keeping gallery paths:', galleryPaths);
        }
        
        // Send the request
        const response = await api.patch(`website-items/${id}/update/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        console.log('✅ Save response:', response.data);
        
        await Swal.fire({
            title: 'Success!',
            text: response.data.message || 'Item details saved successfully',
            icon: 'success',
            confirmButtonColor: '#3085d6'
        });
        
        // Refresh to get updated data
        await fetchItem();
        
        // Clear gallery images after successful save
        setGalleryImages([]);
        galleryPreviews.forEach(url => URL.revokeObjectURL(url));
        setGalleryPreviews([]);
        
    } catch (error: any) {
        console.error('❌ Error saving item:', error);
        console.error('Response data:', error.response?.data);
        await Swal.fire({
            title: 'Error',
            text: error.response?.data?.error || 'Failed to save item details',
            icon: 'error',
            confirmButtonColor: '#d33'
        });
    } finally {
        setSaving(false);
    }
};

  const handleSubmitForApproval = async () => {
    if (!item) return;
    
    const result = await Swal.fire({
      title: 'Submit for Approval?',
      html: `
        <p>Submit "${item.itemName}" for website approval?</p>
        <p class="text-sm text-gray-600 mt-2">The admin will review this item and approve it for the website.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Submit!'
    });
    
    if (result.isConfirmed) {
      setSaving(true);
      try {
        await api.patch(`website-items/${id}/update/`, {
          website_status: 'pending'
        });
        
        await Swal.fire({
          title: 'Submitted!',
          text: 'Item has been submitted for admin approval',
          icon: 'success',
          confirmButtonColor: '#3085d6'
        });
        
        fetchItem();
      } catch (error) {
        console.error('Error submitting item:', error);
        await Swal.fire({
          title: 'Error',
          text: 'Failed to submit item for approval',
          icon: 'error',
          confirmButtonColor: '#d33'
        });
      } finally {
        setSaving(false);
      }
    }
  };

  const getStatusBadge = () => {
    if (!item) return null;
    
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending Approval', icon: FiClock },
      approved: { color: 'bg-green-100 text-green-800', text: 'Approved & Live', icon: FiCheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', text: 'Rejected', icon: FiXCircle },
      draft: { color: 'bg-gray-100 text-gray-800', text: 'Draft', icon: FiPackage }
    };
    
    const config = statusConfig[item.website_status];
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon size={16} />
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Item not found</p>
        <button
          onClick={() => navigate('/WebItems')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/WebItems')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <FiArrowLeft /> Back to List
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{item.itemName}</h1>
            <div className="flex items-center gap-3 mt-2">
              {getStatusBadge()}
              {item.linked_product && (
                <span className="text-sm text-blue-600">Product ID: {item.linked_product}</span>
              )}
              {isVariantProduct && (
                <span className="text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                  {item.variants.length} Variants Available
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-3">
            {item.website_status === 'draft' && (
              <button
                onClick={handleSubmitForApproval}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <FiCheckCircle /> Submit for Approval
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <FiSave /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner for Variant Products */}
      {isVariantProduct && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FiInfo className="text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-purple-800">Variant Product</h4>
              <p className="text-purple-700 text-sm mt-1">
                This product has {item.variants.length} variants. Each variant will appear as a separate option on the website.
                You can upload variant-specific images below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {[
              { id: 'basic', label: 'Basic Info', icon: FiInfo },
              { id: 'images', label: 'Images', icon: FiImage },
              { id: 'description', label: 'Description & Features', icon: FiList },
              { id: 'specifications', label: 'Specifications', icon: FiPackage },
              { id: 'warranty', label: 'Warranty & Shipping', icon: FiShield },
              { id: 'variants', label: 'Variants', icon: FiPackage }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    value={item.itemName}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={item.branch_name}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={item.category?.name || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
                  <input
                    type="text"
                    value={item.subCategory?.name || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={item.brand?.name || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                
                <div>


  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
  <input
    type="text"
    value={getUnitDisplay(item.unit)}
    readOnly
    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
  />
</div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={item.hsnCode || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Slab</label>
                  <input
                    type="text"
                    value={item.taxSlab || '-'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                <textarea
                  rows={3}
                  value={item.short_description || ''}
                  onChange={(e) => handleFieldChange('short_description', e.target.value)}
                  placeholder="Enter a short description for the product"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
                <textarea
                  rows={5}
                  value={item.full_description || ''}
                  onChange={(e) => handleFieldChange('full_description', e.target.value)}
                  placeholder="Enter detailed product description"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma separated)</label>
                <input
                  type="text"
                  value={item.keywords || ''}
                  onChange={(e) => handleFieldChange('keywords', e.target.value)}
                  placeholder="e.g., shoes, running, sports"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <div className="space-y-8">
              {isVariantProduct ? (
                // Variant Product Images
                <>
                  {/* Thumbnail Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thumbnail Image (Optional)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {thumbnailPreview ? (
                        <div className="relative">
                          <img
                            src={thumbnailPreview}
                            alt="Thumbnail"
                            className="mx-auto max-h-48 object-contain rounded"
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              e.currentTarget.src = "https://placehold.co/400x400/f0f4f8/94a3b8?text=No+Image";
                            }}
                          />
                          <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                            <FiUpload size={16} />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageUpload('thumbnail', e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <FiImage className="mx-auto text-gray-400 text-4xl mb-2" />
                          <p className="text-gray-500">Click to upload thumbnail</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleImageUpload('thumbnail', e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      )}
                      <p className="text-xs text-gray-500 mt-2">Recommended: 400x400px, JPG/PNG</p>
                    </div>
                  </div>

                  {/* Variant Images Section */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-4">Variant Images</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {item.variants.map((variant, idx) => (
                        <div key={variant.id} className="border rounded-lg p-4">
                          <p className="font-medium text-gray-700 mb-2">
                            Variant {idx + 1}: {variant.color || '-'} / {variant.size || '-'}
                          </p>
                          <div className="border-2 border-dashed border-purple-300 rounded-lg p-3 text-center">
                            {variant.variant_image ? (
                              <div className="relative">
                                <img
                                  src={getFullUrl(variant.variant_image) || ''}
                                  alt={`Variant ${idx + 1}`}
                                  className="mx-auto max-h-32 object-contain rounded"
                                  onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    e.currentTarget.src = "https://placehold.co/100x100/f0f4f8/94a3b8?text=No+Image";
                                  }}
                                />
                                <label className="absolute bottom-2 right-2 bg-purple-600 text-white p-1 rounded-full cursor-pointer hover:bg-purple-700">
                                  <FiEdit2 size={12} />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        handleVariantImageUpload(idx, e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <label className="cursor-pointer block">
                                <FiUpload className="mx-auto text-purple-400 text-2xl mb-1" />
                                <p className="text-xs text-purple-600">Upload variant image</p>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleVariantImageUpload(idx, e.target.files[0]);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Upload variant-specific images. These will be displayed when customers select different variants.
                    </p>
                  </div>

                  {/* Gallery Images for Variant Products */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <FiGrid className="text-blue-600" /> Gallery Images (Optional)
                    </h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <label className="cursor-pointer block">
                        <FiImage className="mx-auto text-gray-400 text-4xl mb-2" />
                        <p className="text-gray-600">Click to upload gallery images</p>
                        <p className="text-xs text-gray-500 mt-1">Maximum 5 images, JPG/PNG, up to 5MB each</p>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleGalleryImagesChange}
                        />
                      </label>
                    </div>
                    
                    {/* Gallery Preview */}
                    {(galleryPreviews.length > 0 || existingGalleryUrls.length > 0) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Gallery Preview</h4>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {/* Existing Gallery Images */}
                          {existingGalleryUrls.map((url, idx) => (
                            <div key={`existing-${idx}`} className="relative group">
                              <img
                                src={url}
                                alt={`Gallery ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                  e.currentTarget.src = "https://placehold.co/100x100/f0f4f8/94a3b8?text=No+Image";
                                }}
                              />
                              <button
                                onClick={() => removeGalleryImage(idx, true, idx)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <FiXCircle size={14} />
                              </button>
                            </div>
                          ))}
                          {/* New Gallery Images */}
                          {galleryPreviews.map((preview, idx) => (
                            <div key={`new-${idx}`} className="relative group">
                              <img
                                src={preview}
                                alt={`New Gallery ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <button
                                onClick={() => removeGalleryImage(idx)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <FiXCircle size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // Simple Product Images
                <>
                  {/* Main Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Main Image *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {mainImagePreview ? (
                        <div className="relative">
                          <img
                            src={mainImagePreview}
                            alt="Main"
                            className="mx-auto max-h-48 object-contain rounded"
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              e.currentTarget.src = "https://placehold.co/400x400/f0f4f8/94a3b8?text=No+Image";
                            }}
                          />
                          <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                            <FiUpload size={16} />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageUpload('main', e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <FiImage className="mx-auto text-gray-400 text-4xl mb-2" />
                          <p className="text-gray-500">Click to upload main image</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleImageUpload('main', e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      )}
                      <p className="text-xs text-gray-500 mt-2">Recommended: 800x800px, JPG/PNG</p>
                    </div>
                    {!item.main_image && (
                      <p className="text-red-500 text-xs mt-1">Main image is required for simple products</p>
                    )}
                  </div>

                  {/* Thumbnail Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thumbnail Image (Optional)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      {thumbnailPreview ? (
                        <div className="relative">
                          <img
                            src={thumbnailPreview}
                            alt="Thumbnail"
                            className="mx-auto max-h-48 object-contain rounded"
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              e.currentTarget.src = "https://placehold.co/400x400/f0f4f8/94a3b8?text=No+Image";
                            }}
                          />
                          <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                            <FiUpload size={16} />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageUpload('thumbnail', e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <FiImage className="mx-auto text-gray-400 text-4xl mb-2" />
                          <p className="text-gray-500">Click to upload thumbnail</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleImageUpload('thumbnail', e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      )}
                      <p className="text-xs text-gray-500 mt-2">Recommended: 400x400px, JPG/PNG</p>
                    </div>
                  </div>

                  {/* Gallery Images for Simple Products */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <FiGrid className="text-blue-600" /> Gallery Images (Optional)
                    </h3>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <label className="cursor-pointer block">
                        <FiImage className="mx-auto text-gray-400 text-4xl mb-2" />
                        <p className="text-gray-600">Click to upload additional gallery images</p>
                        <p className="text-xs text-gray-500 mt-1">Maximum 5 images, JPG/PNG, up to 5MB each</p>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleGalleryImagesChange}
                        />
                      </label>
                    </div>
                    
                    {/* Gallery Preview */}
                    {(galleryPreviews.length > 0 || existingGalleryUrls.length > 0) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Gallery Preview</h4>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {existingGalleryUrls.map((url, idx) => (
                            <div key={`existing-${idx}`} className="relative group">
                              <img
                                src={url}
                                alt={`Gallery ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                  e.currentTarget.src = "https://placehold.co/100x100/f0f4f8/94a3b8?text=No+Image";
                                }}
                              />
                              <button
                                onClick={() => removeGalleryImage(idx, true, idx)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <FiXCircle size={14} />
                              </button>
                            </div>
                          ))}
                          {galleryPreviews.map((preview, idx) => (
                            <div key={`new-${idx}`} className="relative group">
                              <img
                                src={preview}
                                alt={`New Gallery ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg border"
                              />
                              <button
                                onClick={() => removeGalleryImage(idx)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                              >
                                <FiXCircle size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Description & Features Tab */}
          {activeTab === 'description' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Features</label>
                <div className="space-y-3">
                  {item.description_features.map((feature, index) => (
                    <div key={feature.id} className="flex gap-3 items-start">
                      <span className="text-gray-500 mt-2 w-20">Feature {index + 1}:</span>
                      <input
                        type="text"
                        value={feature.value}
                        onChange={(e) => handleDescriptionFeatureChange(feature.id, e.target.value)}
                        placeholder="Enter product feature"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeDescriptionFeature(feature.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3 mt-4">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add new feature..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addDescriptionFeature}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <FiPlus /> Add Feature
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Specifications Tab */}
          {activeTab === 'specifications' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Specifications</label>
                <div className="space-y-3">
                  {item.specifications.map((spec) => (
                    <div key={spec.id} className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={spec.title}
                        onChange={(e) => handleSpecificationChange(spec.id, 'title', e.target.value)}
                        placeholder="Specification title"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={spec.value}
                          onChange={(e) => handleSpecificationChange(spec.id, 'value', e.target.value)}
                          placeholder="Specification value"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => removeSpecification(spec.id)}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <input
                    type="text"
                    value={newSpecTitle}
                    onChange={(e) => setNewSpecTitle(e.target.value)}
                    placeholder="Specification title"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSpecValue}
                      onChange={(e) => setNewSpecValue(e.target.value)}
                      placeholder="Specification value"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addSpecification}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <FiPlus /> Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warranty & Shipping Tab */}
          {activeTab === 'warranty' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <input
                  type="checkbox"
                  checked={item.warranty_available}
                  onChange={(e) => handleFieldChange('warranty_available', e.target.checked)}
                  className="w-5 h-5"
                />
                <label className="font-medium text-gray-700">Warranty Available</label>
              </div>
              
              {item.warranty_available && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Type</label>
                    <select
                      value={item.warranty_type || ''}
                      onChange={(e) => handleFieldChange('warranty_type', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Warranty Type</option>
                      <option value="Manufacturer Warranty">Manufacturer Warranty</option>
                      <option value="Seller Warranty">Seller Warranty</option>
                      <option value="Extended Warranty">Extended Warranty</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Period</label>
                    <select
                      value={item.warranty_period || ''}
                      onChange={(e) => handleFieldChange('warranty_period', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Period</option>
                      <option value="3 Months">3 Months</option>
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="2 Years">2 Years</option>
                      <option value="3 Years">3 Years</option>
                      <option value="Lifetime">Lifetime</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Description</label>
                    <textarea
                      rows={3}
                      value={item.warranty_description || ''}
                      onChange={(e) => handleFieldChange('warranty_description', e.target.value)}
                      placeholder="Describe warranty coverage"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Policy</label>
                  <select
                    value={item.return_policy || ''}
                    onChange={(e) => handleFieldChange('return_policy', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Return Policy</option>
                    <option value="7 Days Return">7 Days Return</option>
                    <option value="15 Days Return">15 Days Return</option>
                    <option value="30 Days Return">30 Days Return</option>
                    <option value="No Return">No Return</option>
                    <option value="Exchange Only">Exchange Only</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery Time</label>
                  <input
                    type="text"
                    value={item.estimated_delivery_time || ''}
                    onChange={(e) => handleFieldChange('estimated_delivery_time', e.target.value)}
                    placeholder="e.g., 3-5 business days"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Condition</label>
                  <select
                    value={item.product_condition || 'New'}
                    onChange={(e) => handleFieldChange('product_condition', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="New">New</option>
                    <option value="Refurbished">Refurbished</option>
                    <option value="Used">Used</option>
                    <option value="Like New">Like New</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <input
                    type="checkbox"
                    checked={item.free_shipping}
                    onChange={(e) => handleFieldChange('free_shipping', e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div>
                    <label className="font-medium text-gray-700">Free Shipping</label>
                    <p className="text-xs text-gray-500">Offer free shipping on this product</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Variants Tab */}
          {activeTab === 'variants' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Image</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Color</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">MRP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Selling Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {item.variants.map((variant, index) => (
                      <tr key={variant.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          {variant.variant_image ? (
                            <img 
                              src={getFullUrl(variant.variant_image) || ''}
                              alt={`Variant ${index + 1}`}
                              className="h-10 w-10 object-cover rounded border"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                e.currentTarget.src = "https://placehold.co/100x100/f0f4f8/94a3b8?text=No+Image";
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                              <FiImage className="text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{variant.size || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{variant.color || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{variant.mrp}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">₹{variant.salesPrice}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{variant.current_stock || variant.opStock}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{variant.barcode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <FiInfo className="text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Variant Information</h4>
                    <p className="text-blue-700 text-sm mt-1">
                      Total {item.variants.length} variant(s) available. 
                      {isVariantProduct 
                        ? ' Each variant will be created as a separate option in the product.'
                        : ' This is a simple product with one variant.'}
                    </p>
                    <p className="text-blue-600 text-xs mt-2">
                      For variant products, you can upload variant-specific images in the Images tab.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Card for Draft/Approval Status */}
      {item.website_status === 'draft' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiClock className="text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Ready for Submission</h4>
              <p className="text-yellow-700 text-sm mt-1">
                Fill in all the product details above, then save changes next click "Submit for Approval" to send this item to the admin for review.
                Once approved, it will appear on the website.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebsiteItemDetail;