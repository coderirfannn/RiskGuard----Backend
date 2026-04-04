import express from 'express';
import { getRisks, getRisk, createRisk, updateRisk, deleteRisk, getStats } from '../controllers/riskController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes protected

router.route('/').get(getRisks).post(createRisk);
router.route('/stats').get(getStats);
router.route('/:id').get(getRisk).put(updateRisk).patch(updateRisk).delete(deleteRisk);

export default router;
