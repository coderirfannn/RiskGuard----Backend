import Risk from '../models/Risk.js';
import Project from '../models/Project.js';

const VALID_RISK_STATUSES = ['Open', 'Monitoring', 'Mitigated', 'Closed'];
const VALID_PROBABILITIES = ['Low', 'Medium', 'High'];
const VALID_IMPACTS = ['Low', 'Medium', 'High', 'Critical'];

const isValidObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(value || '');

const ensureObjectId = (value, label) => {
  if (!isValidObjectId(value)) {
    const error = new Error(`Invalid ${label} format`);
    error.status = 400;
    throw error;
  }
};

const buildBadRequest = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const buildNotFound = (message) => {
  const error = new Error(message);
  error.status = 404;
  return error;
};

const setStatusAndThrow = (res, error) => {
  res.status(error.status || 500);
  throw error;
};

export const createProjectRisk = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    ensureObjectId(projectId, 'projectId');

    const project = await Project.findById(projectId);
    if (!project) {
      setStatusAndThrow(res, buildNotFound('Project not found'));
    }

    const {
      title,
      description,
      probability,
      impact,
      mitigationActions,
      currentStatus,
      note
    } = req.body;

    if (!title || !title.trim()) {
      setStatusAndThrow(res, buildBadRequest('title is required'));
    }
    if (!mitigationActions || !mitigationActions.trim()) {
      setStatusAndThrow(res, buildBadRequest('mitigationActions is required'));
    }
    if (!VALID_PROBABILITIES.includes(probability)) {
      setStatusAndThrow(res, buildBadRequest(`probability must be one of: ${VALID_PROBABILITIES.join(', ')}`));
    }
    if (!VALID_IMPACTS.includes(impact)) {
      setStatusAndThrow(res, buildBadRequest(`impact must be one of: ${VALID_IMPACTS.join(', ')}`));
    }

    const initialStatus = currentStatus || 'Open';
    if (!VALID_RISK_STATUSES.includes(initialStatus)) {
      setStatusAndThrow(res, buildBadRequest(`currentStatus must be one of: ${VALID_RISK_STATUSES.join(', ')}`));
    }

    const risk = await Risk.create({
      projectId,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      probability,
      impact,
      mitigationActions: mitigationActions.trim(),
      currentStatus: initialStatus,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      history: [{
        status: initialStatus,
        note: typeof note === 'string' ? note.trim() : 'Risk created',
        changedBy: req.user._id,
        timestamp: new Date()
      }]
    });

    res.status(201).json({ success: true, data: risk });
  } catch (error) {
    console.error('[risk-create-error]', {
      method: req.method,
      path: req.originalUrl,
      projectId: req.params?.projectId,
      bodyKeys: Object.keys(req.body || {}),
      message: error.message
    });
    next(error);
  }
};

export const getProjectRisks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    ensureObjectId(projectId, 'projectId');

    const projectExists = await Project.exists({ _id: projectId });
    if (!projectExists) {
      setStatusAndThrow(res, buildNotFound('Project not found'));
    }

    const risks = await Risk.find({ projectId })
      .populate('createdBy updatedBy history.changedBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: risks.length, data: risks });
  } catch (error) {
    next(error);
  }
};

export const getRiskById = async (req, res, next) => {
  try {
    const { riskId } = req.params;
    ensureObjectId(riskId, 'riskId');

    const risk = await Risk.findById(riskId).populate('createdBy updatedBy history.changedBy', 'name email');
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    res.status(200).json({ success: true, data: risk });
  } catch (error) {
    next(error);
  }
};

export const updateRisk = async (req, res, next) => {
  try {
    const { riskId } = req.params;
    ensureObjectId(riskId, 'riskId');

    const risk = await Risk.findById(riskId);
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    if (req.body.probability && !VALID_PROBABILITIES.includes(req.body.probability)) {
      setStatusAndThrow(res, buildBadRequest(`probability must be one of: ${VALID_PROBABILITIES.join(', ')}`));
    }

    if (req.body.impact && !VALID_IMPACTS.includes(req.body.impact)) {
      setStatusAndThrow(res, buildBadRequest(`impact must be one of: ${VALID_IMPACTS.join(', ')}`));
    }

    const allowedFields = ['title', 'description', 'probability', 'impact', 'mitigationActions'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        risk[field] = req.body[field];
      }
    }

    if (req.body.currentStatus !== undefined) {
      const nextStatus = req.body.currentStatus;
      if (!VALID_RISK_STATUSES.includes(nextStatus)) {
        setStatusAndThrow(res, buildBadRequest(`currentStatus must be one of: ${VALID_RISK_STATUSES.join(', ')}`));
      }

      if (nextStatus !== risk.currentStatus) {
        risk.currentStatus = nextStatus;
        risk.history.push({
          status: nextStatus,
          note: typeof req.body.note === 'string' ? req.body.note.trim() : 'Status changed during risk update',
          changedBy: req.user._id,
          timestamp: new Date()
        });
      }
    }

    risk.updatedBy = req.user._id;

    const updatedRisk = await risk.save();
    res.status(200).json({ success: true, data: updatedRisk });
  } catch (error) {
    next(error);
  }
};

export const deleteRisk = async (req, res, next) => {
  try {
    const { riskId } = req.params;
    ensureObjectId(riskId, 'riskId');

    const risk = await Risk.findById(riskId);
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    await risk.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const updateRiskStatus = async (req, res, next) => {
  try {
    const { riskId } = req.params;
    const { status, note } = req.body;

    ensureObjectId(riskId, 'riskId');

    if (typeof status !== 'string' || !status.trim()) {
      setStatusAndThrow(res, buildBadRequest('status is required and must be a non-empty string'));
    }

    if (!VALID_RISK_STATUSES.includes(status)) {
      setStatusAndThrow(res, buildBadRequest(`Invalid status. Allowed values: ${VALID_RISK_STATUSES.join(', ')}`));
    }

    const risk = await Risk.findById(riskId);
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    if (risk.currentStatus !== status) {
      risk.currentStatus = status;
      risk.updatedBy = req.user._id;
      risk.history.push({
        status,
        note: typeof note === 'string' ? note.trim() : 'Status updated',
        changedBy: req.user._id,
        timestamp: new Date()
      });
      await risk.save();
    }

    res.status(200).json({
      success: true,
      message: 'Risk status updated successfully',
      data: {
        id: risk._id,
        currentStatus: risk.currentStatus,
        updatedAt: risk.updatedAt
      }
    });
  } catch (error) {
    console.error('[risk-status-update-error]', {
      method: req.method,
      path: req.originalUrl,
      riskId: req.params?.riskId,
      userId: req.user?._id?.toString?.(),
      bodyKeys: Object.keys(req.body || {}),
      message: error.message
    });
    next(error);
  }
};

export const getRiskHistory = async (req, res, next) => {
  try {
    const { riskId } = req.params;
    ensureObjectId(riskId, 'riskId');

    const risk = await Risk.findById(riskId).populate('history.changedBy', 'name email');
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    const history = [...risk.history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    next(error);
  }
};

export { VALID_RISK_STATUSES };
