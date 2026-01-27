const path = require('path');

const express = require('express');

const shopController = require('../controllers/shop');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/', shopController.getIndex);

router.get('/products', shopController.getProducts);

router.get('/products/:productId', shopController.getProduct);

router.get('/cart', isAuth, shopController.getCart);

router.post('/cart', isAuth, shopController.postCart);

router.post('/cart-delete-item', isAuth, shopController.postCartDeleteProduct);

router.get('/checkout', isAuth, shopController.getCheckout);

router.get('/checkout/success', shopController.getCheckoutSuccess);

router.get('/checkout/cancel', shopController.getCheckout);

router.post('/create-order', isAuth, shopController.postOrder);

// If a GET to /create-order happens (old links or accidental navigation),
// redirect to orders page so user ends up at the expected place.
router.get('/create-order', isAuth, (req, res, next) => {
	return res.redirect('/orders');
});

// Checkout for an existing order (from Orders page)
router.get('/orders/:orderId/checkout', isAuth, shopController.getOrderCheckout);

router.get('/orders', isAuth, shopController.getOrders);

router.get('/orders/:orderId', isAuth, shopController.getInvoice);

module.exports = router;
