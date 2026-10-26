import { Router } from 'express';
import { searchProducts, getFilters, suggest } from './controller.js';

const router = Router();

router.get('/products', searchProducts);
router.get('/products/filters', getFilters);
router.get('/products/suggest', suggest);
router.get('/filters', getFilters);

export default router;