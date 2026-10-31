import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { Package, Plus, Layers, Tag, Check, AlertCircle } from 'lucide-react';

export function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState(null);

  const [productForm, setProductForm] = useState({
    name: '',
    productType: 'service',
    salesPrice: '',
    costPrice: '',
    notes: '',
    variantName: 'Brand',
    attributeValue: '',
    additionalPrice: ''
  });

  const [variantForm, setVariantForm] = useState({
    variantName: 'Brand',
    attributeValue: '',
    additionalPrice: ''
  });

  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products');
      if (res.success) {
        setProducts(res.products);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: productForm.name,
        productType: productForm.productType,
        salesPrice: parseFloat(productForm.salesPrice),
        costPrice: parseFloat(productForm.costPrice) || 0,
        notes: productForm.notes,
        variants: []
      };

      if (productForm.attributeValue.trim()) {
        payload.variants.push({
          variantName: productForm.variantName,
          attributeValue: productForm.attributeValue,
          additionalPrice: parseFloat(productForm.additionalPrice) || 0
        });
      }

      const res = await api.post('/products', payload);
      if (res.success) {
        setIsProductModalOpen(false);
        setAlertMsg({ text: `Product "${res.product.name}" created!`, type: 'success' });
        fetchProducts();
      }
    } catch (err) {
      alert(err.message || 'Failed to create product');
    }
  };

  const handleAddVariant = async (e) => {
    e.preventDefault();
    if (!targetProduct) return;
    try {
      const res = await api.post(`/products/${targetProduct.id}/variants`, {
        variantName: variantForm.variantName,
        attributeValue: variantForm.attributeValue,
        additionalPrice: parseFloat(variantForm.additionalPrice) || 0
      });
      if (res.success) {
        setIsVariantModalOpen(false);
        setAlertMsg({ text: `Variant added to ${targetProduct.name}!`, type: 'success' });
        fetchProducts();
      }
    } catch (err) {
      alert(err.message || 'Failed to add variant');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Products & Product Variants
          </h1>
          <p className="text-sm text-slate-500">
            Configure software products, recurring service items, and tiered variants (e.g. Odoo brand addition +₹560).
          </p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setIsProductModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center gap-2 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create Product
          </button>
        )}
      </div>

      {alertMsg.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${alertMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Products Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading catalog...</div>
        ) : products.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">No products configured yet.</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 text-base">{p.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {p.product_type}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">{p.notes || 'Standard recurring subscription software service.'}</p>

                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-black text-slate-900">
                    ₹{Number(p.sales_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-slate-400">base sales price</span>
                </div>

                {/* Variants List */}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-blue-500" /> Configured Variants:
                    </span>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => {
                          setTargetProduct(p);
                          setVariantForm({ variantName: 'Brand', attributeValue: '', additionalPrice: '' });
                          setIsVariantModalOpen(true);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        + Add Variant
                      </button>
                    )}
                  </div>

                  {p.variants && p.variants.length > 0 ? (
                    <div className="space-y-1.5">
                      {p.variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                          <span className="font-medium text-slate-800">
                            {v.variant_name}: <span className="font-bold text-blue-700">{v.attribute_value}</span>
                          </span>
                          <span className="font-semibold text-emerald-600">
                            {Number(v.additional_price) > 0 ? `+₹${Number(v.additional_price)}` : 'Included'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No variants configured for this product.</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Create New Product"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              placeholder="e.g. Brightloop ERP Core"
              className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sales Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={productForm.salesPrice}
                onChange={(e) => setProductForm({ ...productForm, salesPrice: e.target.value })}
                placeholder="12000.00"
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={productForm.costPrice}
                onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                placeholder="3000.00"
                className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Type</label>
            <select
              value={productForm.productType}
              onChange={(e) => setProductForm({ ...productForm, productType: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs capitalize"
            >
              <option value="service">Service (Subscription)</option>
              <option value="consumable">Consumable</option>
              <option value="storable">Storable</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
            <textarea
              rows={2}
              value={productForm.notes}
              onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
              placeholder="Module features, SLA details..."
              className="w-full p-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          {/* Optional initial variant */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">Initial Variant (Optional)</span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                placeholder="Variant type (e.g. Brand)"
                value={productForm.variantName}
                onChange={(e) => setProductForm({ ...productForm, variantName: e.target.value })}
                className="p-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                type="text"
                placeholder="Value (e.g. Odoo)"
                value={productForm.attributeValue}
                onChange={(e) => setProductForm({ ...productForm, attributeValue: e.target.value })}
                className="p-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                type="number"
                placeholder="Addl. Price (e.g. 560)"
                value={productForm.additionalPrice}
                onChange={(e) => setProductForm({ ...productForm, additionalPrice: e.target.value })}
                className="p-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            Save Product
          </button>
        </form>
      </Modal>

      {/* Add Variant Modal */}
      <Modal
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        title={`Add Variant to ${targetProduct?.name}`}
      >
        <form onSubmit={handleAddVariant} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Variant Name *</label>
            <input
              type="text"
              required
              value={variantForm.variantName}
              onChange={(e) => setVariantForm({ ...variantForm, variantName: e.target.value })}
              placeholder="e.g. Brand, Tier, Storage"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Attribute Value *</label>
            <input
              type="text"
              required
              value={variantForm.attributeValue}
              onChange={(e) => setVariantForm({ ...variantForm, attributeValue: e.target.value })}
              placeholder="e.g. Odoo Integrated Suite"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Additional Price (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={variantForm.additionalPrice}
              onChange={(e) => setVariantForm({ ...variantForm, additionalPrice: e.target.value })}
              placeholder="e.g. 560"
              className="w-full p-2 border border-slate-300 rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-xs"
          >
            Save Variant
          </button>
        </form>
      </Modal>
    </div>
  );
}
