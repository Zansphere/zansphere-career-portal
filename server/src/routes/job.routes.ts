import { Router, Request, Response } from 'express';
import prisma from '../config/db';

const router = Router();

// ── GET /api/jobs ─ List all open jobs ────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { department, workMode, search } = req.query;

    // We query the Zanpeople job_openings table directly (shared DB)
    // Using raw query to access Zanpeople's tables
    let whereClause = `WHERE jo.status = 'OPEN' AND jo.title != 'General Applications'`;
    const params: any[] = [];
    let paramIndex = 1;

    if (department && department !== 'all') {
      whereClause += ` AND d.name ILIKE $${paramIndex}`;
      params.push(`%${department}%`);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (jo.title ILIKE $${paramIndex} OR jo.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const jobs = await prisma.$queryRawUnsafe(`
      SELECT 
        jo.id,
        jo.title,
        jo.description,
        jo.vacancies,
        jo.status,
        jo.created_at as "createdAt",
        d.name as "departmentName",
        des.name as "designationName"
      FROM job_openings jo
      LEFT JOIN departments d ON jo.department_id = d.id
      LEFT JOIN designations des ON jo.designation_id = des.id
      ${whereClause}
      ORDER BY jo.created_at DESC
    `, ...params);

    res.json({ jobs });
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: 'Failed to fetch job openings.' });
  }
});

// ── GET /api/jobs/departments/list ─ Get all departments ─────
router.get('/departments/list', async (_req: Request, res: Response) => {
  try {
    const departments: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, name FROM departments WHERE is_active = true ORDER BY name
    `);
    res.json({ departments });
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments.' });
  }
});

// ── GET /api/jobs/:id ─ Get job details ──────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const jobs: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        jo.id,
        jo.title,
        jo.description,
        jo.vacancies,
        jo.status,
        jo.created_at as "createdAt",
        d.name as "departmentName",
        des.name as "designationName"
      FROM job_openings jo
      LEFT JOIN departments d ON jo.department_id = d.id
      LEFT JOIN designations des ON jo.designation_id = des.id
      WHERE jo.id = $1::uuid
    `, id);

    if (!jobs || jobs.length === 0) {
      res.status(404).json({ error: 'Job opening not found.' });
      return;
    }

    res.json({ job: jobs[0] });
  } catch (err) {
    console.error('Get job error:', err);
    res.status(500).json({ error: 'Failed to fetch job details.' });
  }
});

export default router;
