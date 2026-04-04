import Risk from '../models/Risk.js';

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
    
    Object.assign(risk, req.body);
    risk.updatedBy = req.user._id;
    const updatedRisk = await risk.save();
    res.json({ success: true, data: updatedRisk });
  } catch (error) { next(error); }
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
