const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Product = require('../models/product');
const Order = require('../models/order');

exports.getProducts = (req, res, next) => {
  Product.find()
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products'
      });
    })
    .catch(err => next(new Error(err)));
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => next(new Error(err)));
};

exports.getIndex = (req, res, next) => {
  Product.find()
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/'
      });
    })
    .catch(err => next(new Error(err)));
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

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => req.user.addToCart(product))
    .then(() => res.redirect('/cart'))
    .catch(err => next(new Error(err)));
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(() => res.redirect('/cart'))
    .catch(err => next(new Error(err)));
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items.map(i => ({
        quantity: i.quantity,
        product: { ...i.productId._doc }
      }));

      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });

      return order.save();
    })
    .then(() => req.user.clearCart())
    .then(() => res.redirect('/orders'))
    .catch(err => next(new Error(err)));
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => next(new Error(err)));
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

      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );

      doc.pipe(fs.createWriteStream(invoicePath));
      doc.pipe(res);

      const leftMargin = 50;
      const rightMargin = 50;
      const pageWidth = doc.page.width;
      const usableWidth = pageWidth - leftMargin - rightMargin;

      const productX = leftMargin;
      const qtyX = leftMargin + Math.round(usableWidth * 0.65);
      const priceX = leftMargin + Math.round(usableWidth * 0.80);

      const lineHeight = 18;
      let currentY = 50;
      const bottomMargin = 50;
      const pageHeightLimit = doc.page.height - bottomMargin;

      function addPageHeader() {
        // --- SHOP INFO ---
        doc.fontSize(20).font('Helvetica-Bold').text('MY SHOP', leftMargin, currentY);
        doc.fontSize(10).font('Helvetica')
          .text('Street 55, I10/1 Islamabad, Pakistan', leftMargin, currentY + 22)
          .text('Phone: +92 300 0000000', leftMargin, currentY + 36)
          .text('Email: support@myshop.com', leftMargin, currentY + 50);

        currentY += 95;

        // --- ORDER DETAILS HEADING ---
        doc.fontSize(14).font('Helvetica-Bold').text('Order Details', leftMargin, currentY);

        currentY += 20;

        // --- INVOICE INFO ---
        doc.fontSize(12).font('Helvetica')
          .text(`Invoice Number: ${orderId}`, leftMargin, currentY)
          .text(`Invoice Date: ${new Date().toLocaleDateString()}`, leftMargin, currentY + 15)
          .text(`Customer Email: ${order.user.email}`, leftMargin, currentY + 30);

        currentY += 60; // space before table
      }

      function addTableHeader() {
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text('Product', productX, currentY);
        doc.text('Qty', qtyX, currentY);
        doc.text('Price', priceX, currentY);

        doc.moveTo(productX, currentY + 16)
          .lineTo(pageWidth - rightMargin, currentY + 16)
          .stroke();

        currentY += 24;
        doc.font('Helvetica');
      }

      function checkForNewPage() {
        if (currentY + lineHeight > pageHeightLimit) {
          doc.addPage();
          currentY = 50;
          addPageHeader();
          addTableHeader();
        }
      }

      addPageHeader();

      // ❌ "INVOICE" TITLE REMOVED HERE

      addTableHeader();

      let totalPrice = 0;

      order.products.forEach(prod => {
        const qty = Number(prod.quantity);
        const price = Number(prod.product.price);
        const lineTotal = qty * price;
        totalPrice += lineTotal;

        checkForNewPage();

        const rowY = currentY;

        const productColumnWidth = qtyX - productX - 10;
        doc.fontSize(12);

        const productTitle = String(prod.product.title);

        doc.text(productTitle, productX, rowY, {
          width: productColumnWidth,
          align: 'left'
        });

        const productTextHeight = doc.heightOfString(productTitle, {
          width: productColumnWidth
        });

        doc.text(String(qty), qtyX, rowY);
        doc.text('Rs ' + price.toFixed(2), priceX, rowY);

        currentY += Math.max(productTextHeight, lineHeight);

        doc.moveTo(productX, currentY - 4)
          .lineTo(pageWidth - rightMargin, currentY - 4)
          .strokeColor('#eeeeee')
          .lineWidth(0.5)
          .stroke()
          .strokeColor('black')
          .lineWidth(1);
      });

      if (currentY + 60 > pageHeightLimit) {
        doc.addPage();
        currentY = 50;
      }

      // --- TOTAL AMOUNT ---
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Total Amount:', productX, currentY + 10);

      doc.text('Rs ' + totalPrice.toFixed(2), priceX, currentY + 10, {
        width: 100,
        align: 'left'
      });

      doc.font('Helvetica');

      currentY += 70;

      doc.fontSize(10).text(
        'Thank you for shopping with us!',
        leftMargin,
        currentY,
        { align: 'center', width: usableWidth }
      );

      doc.text(
        'This is a computer-generated invoice and does not require signature.',
        { align: 'center', width: usableWidth }
      );

      doc.end();
    })
    .catch(err => next(err));
};
