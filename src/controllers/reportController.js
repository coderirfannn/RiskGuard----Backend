import { Parser } from 'json2csv';
import Risk from '../models/Risk.js';
import Project from '../models/Project.js';

export const exportRisksCSV = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Fetch user's projects to verify ownership
        const projects = await Project.find({
            $or: [{ owner: userId }, { members: userId }]
        }).lean();
        const projectIds = projects.map(p => p._id);

        // Fetch all risks belonging to these projects
        const risks = await Risk.find({ project: { $in: projectIds } })
            .populate('project', 'title name')
            .populate('owner', 'name email')
            .lean();

        if (!risks || risks.length === 0) {
            return res.status(404).json({ success: false, message: 'No risks found to export', data: null, error: null });
        }

        // Map data to flat CSV structure
        const csvData = risks.map(risk => ({
            'Risk ID': risk._id.toString(),
            'Project Name': risk.project?.title || risk.project?.name || 'Global',
            'Risk Title': risk.title || 'Untitled',
            'Severity': risk.impact || 'Unknown',
            'Probability': risk.probability || 'Unknown',
            'Status': risk.currentStatus || risk.status || 'Open',
            'Owner': risk.owner?.name || risk.owner?.email || 'Unassigned',
            'Created Date': risk.createdAt ? new Date(risk.createdAt).toISOString().split('T')[0] : 'Unknown'
        }));

        // Parse to CSV
        const parser = new Parser({
            fields: ['Risk ID', 'Project Name', 'Risk Title', 'Severity', 'Probability', 'Status', 'Owner', 'Created Date']
        });
        const csv = parser.parse(csvData);

        // Set response headers to trigger download natively
        const dateStr = new Date().toISOString().split('T')[0];
        res.header('Content-Type', 'text/csv');
        res.attachment(`RiskGuard_Master_Report_${dateStr}.csv`);
        res.send(csv);

    } catch (error) {
        next(error);
    }
};
