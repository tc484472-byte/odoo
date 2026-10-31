const db = require('../db');
const { recordAuditLog } = require('../middleware/audit');

// List Products with Variants
async function getProducts(req, res) {
  try {
    const productsRes = await db.query(
      `SELECT * FROM products ORDER BY name ASC`
    );

    const variantsRes = await db.query(
      `SELECT * FROM product_variants WHERE is_active = true ORDER BY id ASC`
    );

    // Group variants by product
    const variantMap = {};
    variantsRes.rows.forEach(v => {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
      variantMap[v.product_id].push(v);
    });

    const products = productsRes.rows.map(p => ({
      ...p,
      variants: variantMap[p.id] || []
    }));

    return res.json({ success: true, products });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create Product (Admin Only)
async function createProduct(req, res) {
  const { name, productType, salesPrice, costPrice, notes, variants } = req.body;

  if (!name || salesPrice === undefined) {
    return res.status(400).json({ success: false, message: 'Product name and sales price are required.' });
  }

  if (Number(salesPrice) < 0 || (costPrice !== undefined && Number(costPrice) < 0)) {
    return res.status(400).json({ success: false, message: 'Prices cannot be negative.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO products (name, product_type, sales_price, cost_price, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name.trim(), productType || 'service', Number(salesPrice), Number(costPrice || 0), notes || null, true]
    );

    const product = result.rows[0];
    const createdVariants = [];

    if (Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        if (v.variantName && v.attributeValue) {
          const varRes = await client.query(
            `INSERT INTO product_variants (product_id, variant_name, attribute_value, additional_price, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [product.id, v.variantName.trim(), v.attributeValue.trim(), Number(v.additionalPrice || 0), true]
          );
          createdVariants.push(varRes.rows[0]);
        }
      }
    }

    await client.query('COMMIT');
    client.release();

    recordAuditLog(req, {
      action: 'CREATE_PRODUCT',
      entityType: 'products',
      entityId: product.id,
      newValues: { name: product.name, salesPrice: product.sales_price }
    });

    return res.status(201).json({
      success: true,
      product: { ...product, variants: createdVariants }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update Product (Admin Only)
async function updateProduct(req, res) {
  const { id } = req.params;
  const { name, productType, salesPrice, costPrice, notes, isActive } = req.body;

  if (salesPrice !== undefined && Number(salesPrice) < 0) {
    return res.status(400).json({ success: false, message: 'Price cannot be negative.' });
  }

  try {
    const result = await db.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           product_type = COALESCE($2, product_type),
           sales_price = COALESCE($3, sales_price),
           cost_price = COALESCE($4, cost_price),
           notes = COALESCE($5, notes),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, productType, salesPrice, costPrice, notes, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    return res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Add Variant to Product (Admin Only)
async function addVariant(req, res) {
  const { productId } = req.params;
  const { variantName, attributeValue, additionalPrice } = req.body;

  if (!variantName || !attributeValue) {
    return res.status(400).json({ success: false, message: 'Variant name and attribute value are required.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO product_variants (product_id, variant_name, attribute_value, additional_price, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [productId, variantName.trim(), attributeValue.trim(), Number(additionalPrice || 0)]
    );

    return res.status(201).json({ success: true, variant: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  addVariant
};
