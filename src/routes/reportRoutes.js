import express from 'express';
import { exportRisksCSV } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Ensure all reports require valid token
router.get('/csv', exportRisksCSV);

export default router;
