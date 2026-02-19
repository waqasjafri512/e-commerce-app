const fileHelper = require('../util/file');
const { validationResult } = require('express-validator');
const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const Coupon = require('../models/coupon');

exports.getAddProduct = (req, res) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: []
  });
};

exports.postAddProduct = async (req, res, next) => {
  try {
    const { title, price, description, category, brand, size, color, stock } = req.body;
    const image = req.file;
    if (!image) {
      return res.status(422).render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: true,
        product: { title, price, description, category, brand, size, color, stock },
        errorMessage: 'Attached file is not an image.',
        validationErrors: []
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        editing: false,
        hasError: true,
        product: { title, price, description, category, brand, size, color, stock },
        errorMessage: errors.array()[0].msg,
        validationErrors: errors.array()
      });
    }

    const product = new Product({
      title,
      price,
      description,
      imageUrl: image.path,
      category,
      brand,
      size,
      color,
      stock: Number(stock || 0),
      isActive: Number(stock || 0) > 0,
      userId: req.user
    });

    await product.save();
    res.redirect('/admin/products');
  } catch (err) {
    next(new Error(err));
  }
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) return res.redirect('/');
  Product.findById(req.params.productId)
    .then(product => {
      if (!product) return res.redirect('/');
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product,
        hasError: false,
        errorMessage: null,
        validationErrors: []
      });
    })
    .catch(err => next(new Error(err)));
};

exports.postEditProduct = (req, res, next) => {
  const { productId, title, price, description, category, brand, size, color, stock } = req.body;
  const image = req.file;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/edit-product',
      editing: true,
      hasError: true,
      product: { title, price, description, category, brand, size, color, stock, _id: productId },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array()
    });
  }

  Product.findById(productId)
    .then(product => {
      if (product.userId.toString() !== req.user._id.toString()) return res.redirect('/');
      product.title = title;
      product.price = price;
      product.description = description;
      product.category = category;
      product.brand = brand;
      product.size = size;
      product.color = color;
      product.stock = Number(stock || 0);
      product.isActive = product.stock > 0;
      if (image) {
        fileHelper.deleteFile(product.imageUrl);
        product.imageUrl = image.path;
      }
      return product.save();
    })
    .then(() => res.redirect('/admin/products'))
    .catch(err => next(new Error(err)));
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    .then(products => {
      res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products'
      });
    })
    .catch(err => next(new Error(err)));
};

exports.deleteProduct = (req, res) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) throw new Error('Product not found.');
      fileHelper.deleteFile(product.imageUrl);
      return Product.deleteOne({ _id: prodId, userId: req.user._id });
    })
    .then(() => res.status(200).json({ message: 'Success!' }))
    .catch(() => res.status(500).json({ message: 'Deleting product failed.' }));
};

exports.getDashboard = async (req, res, next) => {
  try {
    const [totalUsers, totalOrders, lowStockProducts, popularProducts, salesData] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Product.find({ stock: { $lte: 5 } }).sort({ stock: 1 }).limit(10),
      Product.find().sort({ reviewCount: -1 }).limit(5),
      Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        {
          $group: {
            _id: '$status',
            revenue: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.render('admin/dashboard', {
      pageTitle: 'Admin Dashboard',
      path: '/admin/dashboard',
      totalUsers,
      totalOrders,
      lowStockProducts,
      popularProducts,
      salesData
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
    res.render('admin/orders', {
      pageTitle: 'Manage Orders',
      path: '/admin/orders',
      orders
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.postOrderStatus = async (req, res, next) => {
  try {
    const { orderId, status } = req.body;
    await Order.updateOne(
      { _id: orderId },
      {
        status,
        $push: { trackingHistory: { status, updatedAt: new Date(), note: `Status updated to ${status}` } }
      }
    );
    res.redirect('/admin/orders');
  } catch (err) {
    next(new Error(err));
  }
};

exports.getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render('admin/coupons', {
      pageTitle: 'Coupons',
      path: '/admin/coupons',
      coupons
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.postCoupon = async (req, res, next) => {
  try {
    const { code, discountPercent, expiresAt, maxUses } = req.body;
    await Coupon.create({
      code: code.toUpperCase(),
      discountPercent: Number(discountPercent),
      expiresAt: new Date(expiresAt),
      maxUses: Number(maxUses || 100)
    });
    res.redirect('/admin/coupons');
  } catch (err) {
    next(new Error(err));
  }
};
