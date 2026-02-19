const express = require('express');
const { body } = require('express-validator');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/dashboard', isAuth, adminController.getDashboard);
router.get('/add-product', isAuth, adminController.getAddProduct);
router.get('/products', isAuth, adminController.getProducts);
router.get('/orders', isAuth, adminController.getOrders);
router.get('/coupons', isAuth, adminController.getCoupons);

router.post(
  '/add-product',
  [
    body('title').isString().isLength({ min: 3 }).trim(),
    body('price').isFloat(),
    body('description').isLength({ min: 5, max: 400 }).trim(),
    body('stock').isInt({ min: 0 })
  ],
  isAuth,
  adminController.postAddProduct
);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post(
  '/edit-product',
  [
    body('title').isString().isLength({ min: 3 }).trim(),
    body('price').isFloat(),
    body('description').isLength({ min: 5, max: 400 }).trim(),
    body('stock').isInt({ min: 0 })
  ],
  isAuth,
  adminController.postEditProduct
);

router.post('/orders/status', isAuth, adminController.postOrderStatus);
router.post('/coupons', isAuth, adminController.postCoupon);
router.delete('/product/:productId', isAuth, adminController.deleteProduct);

module.exports = router;
