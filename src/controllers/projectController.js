import Project from '../models/Project.js';
import Risk from '../models/Risk.js';

const isValidObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(value || '');

const normalizeDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return date;
};

export const createProject = async (req, res, next) => {
  try {
    const { title, description, owner, startDate, endDate } = req.body;

    if (!title || !title.trim()) {
      res.status(400);
      throw new Error('title is required');
    }

    const parsedStartDate = normalizeDate(startDate, 'startDate');
    const parsedEndDate = normalizeDate(endDate, 'endDate');
    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      res.status(400);
      throw new Error('endDate must be greater than or equal to startDate');
    }

    const project = await Project.create({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      owner: owner ?? req.user?._id?.toString?.(),
      startDate: parsedStartDate,
      endDate: parsedEndDate
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('[project-create-error]', { path: req.originalUrl, message: error.message });
    next(error);
  }
};

export const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find().sort('-createdAt');
    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      res.status(400);
      throw new Error('Invalid projectId format');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      res.status(400);
      throw new Error('Invalid projectId format');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    const allowedFields = ['title', 'description', 'owner', 'startDate', 'endDate'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    }

    const parsedStartDate = normalizeDate(project.startDate, 'startDate');
    const parsedEndDate = normalizeDate(project.endDate, 'endDate');
    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      res.status(400);
      throw new Error('endDate must be greater than or equal to startDate');
    }

    project.startDate = parsedStartDate;
    project.endDate = parsedEndDate;

    const updatedProject = await project.save();
    res.status(200).json({ success: true, data: updatedProject });
  } catch (error) {
    console.error('[project-update-error]', {
      path: req.originalUrl,
      projectId: req.params?.projectId,
      message: error.message
    });
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      res.status(400);
      throw new Error('Invalid projectId format');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    await Risk.deleteMany({ projectId });
    await project.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
