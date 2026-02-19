const express = require('express');

const shopController = require('../controllers/shop');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/', shopController.getIndex);
router.get('/products', shopController.getProducts);
router.get('/products/suggestions', shopController.getSearchSuggestions);
router.get('/products/:productId', shopController.getProduct);
router.post('/products/review', isAuth, shopController.postReview);

router.get('/wishlist', isAuth, shopController.getWishlist);
router.post('/wishlist/toggle', isAuth, shopController.postToggleWishlist);

router.get('/cart', isAuth, shopController.getCart);
router.post('/cart', isAuth, shopController.postCart);
router.post('/cart-delete-item', isAuth, shopController.postCartDeleteProduct);

router.get('/checkout', isAuth, shopController.getCheckout);
router.post('/checkout/coupon', isAuth, shopController.postApplyCoupon);
router.get('/checkout/success', isAuth, shopController.getCheckoutSuccess);
router.get('/checkout/cancel', isAuth, shopController.getCheckout);

router.post('/create-order', isAuth, shopController.postOrder);
router.get('/create-order', isAuth, (req, res) => res.redirect('/orders'));

router.get('/orders/:orderId/checkout', isAuth, shopController.getOrderCheckout);
router.get('/orders', isAuth, shopController.getOrders);
router.get('/orders/:orderId', isAuth, shopController.getInvoice);

module.exports = router;
