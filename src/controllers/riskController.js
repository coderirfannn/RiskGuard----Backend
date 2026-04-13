import Risk from '../models/Risk.js';
import Project from '../models/Project.js';

const VALID_RISK_STATUSES = ['Open', 'Monitoring', 'Mitigated', 'Closed'];
const VALID_PROBABILITIES = ['Low', 'Medium', 'High'];
const VALID_IMPACTS = ['Low', 'Medium', 'High', 'Critical'];
const MAX_HISTORY_ENTRIES = 200;
const LEGACY_STATUS_MAP = {
  identified: 'Open',
  mitigating: 'Monitoring',
  resolved: 'Closed'
};

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

const normalizeRiskStatus = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const legacyMapped = LEGACY_STATUS_MAP[trimmed.toLowerCase()];
  if (legacyMapped) return legacyMapped;

  const directMatch = VALID_RISK_STATUSES.find((status) => status.toLowerCase() === trimmed.toLowerCase());
  return directMatch || null;
};

const appendHistoryEntry = (risk, { status, note, changedBy }) => {
  // Reject repeated transitions to keep history meaningful and audit-safe.
  const latest = risk.history[risk.history.length - 1];
  if (latest?.status === status) {
    throw buildBadRequest('Duplicate status transition is not allowed');
  }

  risk.history.push({
    status,
    note: typeof note === 'string' ? note.trim() : '',
    changedBy,
    timestamp: new Date()
  });

  if (risk.history.length > MAX_HISTORY_ENTRIES) {
    // Keep a bounded in-document history size for write/read performance.
    risk.history = risk.history.slice(-MAX_HISTORY_ENTRIES);
  }
};

export const createProjectRisk = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    ensureObjectId(projectId, 'projectId');
    ensureObjectId(req.user?._id?.toString?.(), 'createdBy');

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

    if (description !== undefined && typeof description !== 'string') {
      setStatusAndThrow(res, buildBadRequest('description must be a string'));
    }

    if (note !== undefined && typeof note !== 'string') {
      setStatusAndThrow(res, buildBadRequest('note must be a string'));
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

    const initialStatus = currentStatus === undefined ? 'Open' : normalizeRiskStatus(currentStatus);
    if (!initialStatus) {
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
      .sort('-createdAt')
      .lean();

    res.status(200).json({ success: true, count: risks.length, data: risks });
  } catch (error) {
    next(error);
  }
};

export const getRiskById = async (req, res, next) => {
  try {
    const riskId = (req.params.riskId || req.params.id || '').trim();
    const projectId = (req.params.projectId || '').trim();
    ensureObjectId(riskId, 'riskId');

    const query = { _id: riskId };
    if (projectId) {
      ensureObjectId(projectId, 'projectId');
      query.projectId = projectId;
    }

    const risk = await Risk.findOne(query).populate('createdBy updatedBy history.changedBy', 'name email').lean();
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
    ensureObjectId(req.user?._id?.toString?.(), 'updatedBy');

    const risk = await Risk.findById(riskId);
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    if (req.body.title !== undefined) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        setStatusAndThrow(res, buildBadRequest('title must be a non-empty string'));
      }
      req.body.title = req.body.title.trim();
    }

    if (req.body.description !== undefined) {
      if (typeof req.body.description !== 'string') {
        setStatusAndThrow(res, buildBadRequest('description must be a string'));
      }
      req.body.description = req.body.description.trim();
    }

    if (req.body.mitigationActions !== undefined) {
      if (typeof req.body.mitigationActions !== 'string' || !req.body.mitigationActions.trim()) {
        setStatusAndThrow(res, buildBadRequest('mitigationActions must be a non-empty string'));
      }
      req.body.mitigationActions = req.body.mitigationActions.trim();
    }

    if (req.body.note !== undefined && typeof req.body.note !== 'string') {
      setStatusAndThrow(res, buildBadRequest('note must be a string'));
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
      const nextStatus = normalizeRiskStatus(req.body.currentStatus);
      if (!nextStatus) {
        setStatusAndThrow(res, buildBadRequest(`currentStatus must be one of: ${VALID_RISK_STATUSES.join(', ')}`));
      }

      if (nextStatus === risk.currentStatus) {
        setStatusAndThrow(res, buildBadRequest('currentStatus is already set to this value'));
      }

      risk.currentStatus = nextStatus;
      appendHistoryEntry(risk, {
        status: nextStatus,
        note: typeof req.body.note === 'string' ? req.body.note : 'Status changed during risk update',
        changedBy: req.user._id
      });
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
    ensureObjectId(req.user?._id?.toString?.(), 'updatedBy');

    if (typeof status !== 'string' || !status.trim()) {
      setStatusAndThrow(res, buildBadRequest('status is required and must be a non-empty string'));
    }

    if (note !== undefined && typeof note !== 'string') {
      setStatusAndThrow(res, buildBadRequest('note must be a string'));
    }

    const normalizedStatus = normalizeRiskStatus(status);
    if (!normalizedStatus) {
      setStatusAndThrow(res, buildBadRequest(`Invalid status. Allowed values: ${VALID_RISK_STATUSES.join(', ')}`));
    }

    const risk = await Risk.findById(riskId);
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    if (risk.currentStatus === normalizedStatus) {
      setStatusAndThrow(res, buildBadRequest('status is already set to this value'));
    }

    risk.currentStatus = normalizedStatus;
    risk.updatedBy = req.user._id;
    appendHistoryEntry(risk, {
      status: normalizedStatus,
      note: typeof note === 'string' ? note : 'Status updated',
      changedBy: req.user._id
    });
    await risk.save();

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

    const risk = await Risk.findById(riskId).populate('history.changedBy', 'name email').lean();
    if (!risk) {
      setStatusAndThrow(res, buildNotFound('Risk not found'));
    }

    const history = [...risk.history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    next(error);
  }
};

export const getAllUserRisks = async (req, res, next) => {
  try {
    const risks = await Risk.find({ createdBy: req.user._id })
      .populate('projectId createdBy updatedBy history.changedBy', 'name email title')
      .sort('-createdAt')
      .lean();
    res.status(200).json({ success: true, count: risks.length, data: risks });
  } catch (error) {
    next(error);
  }
};

export { VALID_RISK_STATUSES };
