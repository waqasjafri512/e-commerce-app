const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_KEY);
const PDFDocument = require('pdfkit');
const Product = require('../models/product');
const Order = require('../models/order');
const Review = require('../models/review');
const Coupon = require('../models/coupon');
const { getProductFilters, getSortOption } = require('../util/product-query');

const ITEMS_PER_PAGE = 8;

const getExchangeRate = currency => {
  const rates = { USD: 1, EUR: 0.92, PKR: 278 };
  return rates[currency] || 1;
};

const decorateProducts = (products, wishlist = []) => {
  const wishlistIds = wishlist.map(item => item.toString());
  return products.map(product => ({
    ...product.toObject(),
    isWishlisted: wishlistIds.includes(product._id.toString())
  }));
};

const calculateProductRating = async productId => {
  const stats = await Review.aggregate([
    { $match: { productId } },
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const averageRating = stats[0] ? Number(stats[0].averageRating.toFixed(1)) : 0;
  const reviewCount = stats[0]?.reviewCount || 0;
  await Product.updateOne({ _id: productId }, { averageRating, reviewCount });
};

const getRecommendedProducts = async product => {
  const alsoLike = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true
  })
    .limit(4)
    .sort({ averageRating: -1 });

  let boughtTogether = [];
  if (product.boughtTogether?.length) {
    boughtTogether = await Product.find({ _id: { $in: product.boughtTogether }, isActive: true }).limit(4);
  }

  return { alsoLike, boughtTogether };
};

exports.getProducts = async (req, res, next) => {
  try {
    const page = +req.query.page || 1;
    const filter = getProductFilters(req.query);
    const sort = getSortOption(req.query.sort);

    const [totalItems, products, facets] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort(sort).skip((page - 1) * ITEMS_PER_PAGE).limit(ITEMS_PER_PAGE),
      Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            categories: { $addToSet: '$category' },
            brands: { $addToSet: '$brand' },
            sizes: { $addToSet: '$size' },
            colors: { $addToSet: '$color' }
          }
        }
      ])
    ]);

    const prods = req.user ? decorateProducts(products, req.user.wishlist || []) : products;

    res.render('shop/product-list', {
      prods,
      pageTitle: 'Products',
      path: '/products',
      hasNextPage: ITEMS_PER_PAGE * page < totalItems,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      currentPage: page,
      lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      filters: req.query,
      facets: facets[0] || { categories: [], brands: [], sizes: [], colors: [] }
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const prodId = req.params.productId;
    const [product, reviews] = await Promise.all([
      Product.findById(prodId),
      Review.find({ productId: prodId }).sort({ createdAt: -1 })
    ]);

    const recommendations = await getRecommendedProducts(product);

    res.render('shop/product-detail', {
      product,
      reviews,
      pageTitle: product.title,
      path: '/products',
      recommendations,
      isWishlisted:
        req.user && (req.user.wishlist || []).some(item => item.toString() === product._id.toString())
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.postReview = async (req, res, next) => {
  try {
    const productId = req.body.productId;
    const rating = Number(req.body.rating);
    const comment = req.body.comment;

    await Review.findOneAndUpdate(
      { productId, userId: req.user._id },
      { rating, comment, userEmail: req.user.email },
      { upsert: true, new: true }
    );

    await calculateProductRating(productId);
    res.redirect(`/products/${productId}`);
  } catch (err) {
    next(new Error(err));
  }
};

exports.getIndex = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 }).limit(ITEMS_PER_PAGE);
    res.render('shop/index', {
      prods: req.user ? decorateProducts(products, req.user.wishlist || []) : products,
      pageTitle: 'Shop',
      path: '/'
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.getWishlist = async (req, res, next) => {
  try {
    await req.user.populate('wishlist');
    res.render('shop/wishlist', {
      path: '/wishlist',
      pageTitle: 'Wishlist',
      products: req.user.wishlist
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.postToggleWishlist = async (req, res, next) => {
  try {
    await req.user.toggleWishlist(req.body.productId);
    res.redirect('back');
  } catch (err) {
    next(new Error(err));
  }
};

exports.getSearchSuggestions = async (req, res, next) => {
  try {
    const term = req.query.term || '';
    const products = await Product.find({
      isActive: true,
      title: { $regex: term, $options: 'i' }
    })
      .limit(6)
      .select('title category brand');

    res.json(
      products.map(item => ({
        id: item._id,
        label: `${item.title} (${item.brand} • ${item.category})`
      }))
    );
  } catch (err) {
    next(new Error(err));
  }
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: user.cart.items
      });
    })
    .catch(err => next(new Error(err)));
};

exports.postCart = async (req, res, next) => {
  try {
    const prodId = req.body.productId;
    const product = await Product.findById(prodId);
    if (!product || !product.isActive || product.stock <= 0) {
      return res.redirect('/products');
    }
    await req.user.addToCart(product);
    res.redirect('/cart');
  } catch (err) {
    next(new Error(err));
  }
};

exports.postCartDeleteProduct = (req, res, next) => {
  req.user
    .removeFromCart(req.body.productId)
    .then(() => res.redirect('/cart'))
    .catch(err => next(new Error(err)));
};

exports.getCheckout = async (req, res, next) => {
  try {
    await req.user.populate('cart.items.productId');
    const products = req.user.cart.items.filter(item => item.productId && item.productId.isActive);

    let total = products.reduce((sum, item) => sum + item.quantity * item.productId.price, 0);
    let appliedCoupon = null;

    if (req.session.couponCode) {
      const coupon = await Coupon.findOne({
        code: req.session.couponCode,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });
      if (coupon) {
        total = total * (1 - coupon.discountPercent / 100);
        appliedCoupon = coupon;
      }
    }

    const lineItems = products.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.productId.title,
          description: item.productId.description,
          images: [req.protocol + '://' + req.get('host') + '/' + item.productId.imageUrl.replace(/\\/g, '/')]
        },
        unit_amount: Math.round(item.productId.price * 100)
      },
      quantity: item.quantity
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      ui_mode: 'embedded',
      return_url: req.protocol + '://' + req.get('host') + '/checkout/success?session_id={CHECKOUT_SESSION_ID}'
    });

    const currency = req.user.preferredCurrency || 'USD';
    const rate = getExchangeRate(currency);

    res.render('shop/checkout', {
      path: '/checkout',
      pageTitle: 'Checkout',
      products,
      totalSum: Number((total * rate).toFixed(2)),
      clientSecret: session.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUB_KEY || '',
      currency,
      appliedCoupon
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.postApplyCoupon = async (req, res, next) => {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    const coupon = await Coupon.findOne({ code, isActive: true, expiresAt: { $gt: new Date() } });
    if (!coupon || coupon.usedCount >= coupon.maxUses) {
      req.flash('error', 'Invalid or expired coupon code');
      return res.redirect('/checkout');
    }

    req.session.couponCode = code;
    res.redirect('/checkout');
  } catch (err) {
    next(new Error(err));
  }
};

exports.getCheckoutSuccess = async (req, res, next) => {
  try {
    await req.user.populate('cart.items.productId');

    const products = req.user.cart.items
      .filter(i => i.productId)
      .map(i => ({ quantity: i.quantity, product: { ...i.productId._doc } }));

    let totalAmount = products.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
    let couponData = null;

    if (req.session.couponCode) {
      const coupon = await Coupon.findOne({ code: req.session.couponCode, isActive: true });
      if (coupon && coupon.usedCount < coupon.maxUses) {
        couponData = { code: coupon.code, discountPercent: coupon.discountPercent };
        totalAmount = totalAmount * (1 - coupon.discountPercent / 100);
        coupon.usedCount += 1;
        await coupon.save();
      }
    }

    const order = new Order({
      user: { email: req.user.email, userId: req.user },
      products,
      status: 'Pending',
      trackingHistory: [{ status: 'Pending', note: 'Order placed' }],
      coupon: couponData,
      totalAmount
    });

    for (const item of products) {
      const nextStock = Math.max(0, Number(item.product.stock || 0) - Number(item.quantity));
      await Product.updateOne(
        { _id: item.product._id },
        { stock: nextStock, isActive: nextStock > 0 }
      );
    }

    await order.save();
    await req.user.clearCart();
    req.session.couponCode = null;
    res.redirect('/orders');
  } catch (err) {
    next(new Error(err));
  }
};


exports.postOrder = (req, res) => {
  res.redirect('/checkout');
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .sort({ createdAt: -1 })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders
      });
    })
    .catch(err => next(new Error(err)));
};

exports.getOrderCheckout = async (req, res, next) => {
  const orderId = req.params.orderId;
  try {
    const order = await Order.findById(orderId);
    if (!order) return next(new Error('No order found.'));
    if (order.user.userId.toString() !== req.user._id.toString()) {
      return next(new Error('Unauthorized'));
    }

    const products = order.products.map(i => ({
      quantity: i.quantity,
      productId: {
        title: i.product.title,
        description: i.product.description || '',
        imageUrl: i.product.imageUrl || '',
        price: i.product.price
      }
    }));

    const total = order.products.reduce((sum, p) => sum + Number(p.quantity) * Number(p.product.price), 0);

    const lineItems = order.products.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: i.product.title,
          description: i.product.description,
          images: [req.protocol + '://' + req.get('host') + '/' + String(i.product.imageUrl).replace(/\\/g, '/')]
        },
        unit_amount: Math.round(Number(i.product.price) * 100)
      },
      quantity: i.quantity
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      ui_mode: 'embedded',
      return_url: req.protocol + '://' + req.get('host') + '/orders'
    });

    res.render('shop/checkout', {
      path: '/checkout',
      pageTitle: 'Checkout',
      products,
      totalSum: total,
      clientSecret: session.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUB_KEY || ''
    });
  } catch (err) {
    next(new Error(err));
  }
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;

  Order.findById(orderId)
    .then(order => {
      if (!order) return next(new Error('No order found.'));
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }

      const invoiceName = `invoice-${orderId}.pdf`;
      const invoicePath = path.join('data', 'invoices', invoiceName);
      const invoicesDir = path.join('data', 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');

      doc.pipe(fs.createWriteStream(invoicePath));
      doc.pipe(res);
      doc.fontSize(24).text('Invoice', { underline: true });
      doc.text('------------------------------------------');

      let totalPrice = 0;
      order.products.forEach(prod => {
        totalPrice += prod.quantity * prod.product.price;
        doc.fontSize(14).text(`${prod.product.title} - ${prod.quantity} x $${prod.product.price}`);
      });

      doc.text('---');
      doc.fontSize(18).text(`Total Price: $${totalPrice}`);
      doc.end();
    })
    .catch(err => next(new Error(err)));
};
