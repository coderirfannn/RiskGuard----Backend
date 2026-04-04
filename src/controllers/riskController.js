import Risk from '../models/Risk.js';

const VALID_RISK_STATUSES = ['Identified', 'Mitigating', 'Resolved'];

const validateObjectId = (id) => /^[a-fA-F0-9]{24}$/.test(id);

export const getRisks = async (req, res, next) => {
  try {
    const risks = await Risk.find().populate('createdBy', 'name email').sort('-createdAt');
    res.json({ success: true, data: risks });
  } catch (error) { next(error); }
};

export const getRisk = async (req, res, next) => {
  try {
    const risk = await Risk.findById(req.params.id).populate('createdBy updatedBy history.changedBy', 'name');
    if (!risk) { res.status(404); throw new Error('Risk not found'); }
    res.json({ success: true, data: risk });
  } catch (error) { next(error); }
};

export const createRisk = async (req, res, next) => {
  try {
    const risk = new Risk({
      ...req.body,
      createdBy: req.user._id,
      history: [{ status: req.body.status || 'Identified', changedBy: req.user._id }]
    });
    const savedRisk = await risk.save();
    res.status(201).json({ success: true, data: savedRisk });
  } catch (error) { next(error); }
};

export const updateRisk = async (req, res, next) => {
  try {
    const risk = await Risk.findById(req.params.id);
    if (!risk) { res.status(404); throw new Error('Risk not found'); }
    
    // Auto-update history if status changes
    if (req.body.status && req.body.status !== risk.status) {
      risk.history.push({ status: req.body.status, changedBy: req.user._id });
    }
    
    const allowedFields = ['title', 'description', 'probability', 'impact', 'mitigationPlan', 'status'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        risk[field] = req.body[field];
      }
    });

    risk.updatedBy = req.user._id;
    const updatedRisk = await risk.save();
    res.json({ success: true, data: updatedRisk });
  } catch (error) { next(error); }
};

export const updateRiskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!validateObjectId(id)) {
      res.status(400);
      throw new Error('Invalid risk id format');
    }

    if (typeof status !== 'string' || !status.trim()) {
      res.status(400);
      throw new Error('status is required and must be a non-empty string');
    }

    if (!VALID_RISK_STATUSES.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status. Allowed values: ${VALID_RISK_STATUSES.join(', ')}`);
    }

    const risk = await Risk.findById(id);
    if (!risk) {
      res.status(404);
      throw new Error('Risk not found');
    }

    if (risk.status !== status) {
      risk.status = status;
      risk.history.push({ status, changedBy: req.user?._id });
      risk.updatedBy = req.user?._id;
      await risk.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Risk status updated successfully',
      data: {
        id: risk._id,
        status: risk.status,
        updatedAt: risk.updatedAt
      }
    });
  } catch (error) {
    console.error('[risk-status-update-error]', {
      method: req.method,
      path: req.originalUrl,
      riskId: req.params?.id,
      userId: req.user?._id?.toString?.(),
      bodyKeys: Object.keys(req.body || {}),
      message: error.message
    });
    next(error);
  }
};

export const deleteRisk = async (req, res, next) => {
  try {
    const risk = await Risk.findById(req.params.id);
    if (!risk) { res.status(404); throw new Error('Risk not found'); }
    await risk.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) { next(error); }
};

export const getStats = async (req, res, next) => {
  try {
    const total = await Risk.countDocuments();
    const highAndCritical = await Risk.countDocuments({ impact: { $in: ['High', 'Critical'] } });
    const resolved = await Risk.countDocuments({ status: 'Resolved' });
    res.json({ success: true, data: { total, highAndCritical, resolved } });
  } catch (error) { next(error); }
};

export { VALID_RISK_STATUSES };
