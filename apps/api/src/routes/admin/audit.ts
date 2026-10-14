import type { AuditRow } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AdminDeps } from './index';

const Query = z.object({
  admin: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** Read-only audit log. No create/update/delete routes exist (append-only). */
export function auditAdminRouter({ db }: AdminDeps) {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = Query.parse(req.query);
    const where: Record<string, unknown> = {};
    if (q.admin) where.admin = q.admin;
    if (q.action) where.action = { contains: q.action };
    if (q.from || q.to) where.createdAt = { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) };
    const [total, rows] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    const items: AuditRow[] = rows.map((a) => ({
      id: a.id,
      admin: a.admin,
      action: a.action,
      target: a.target,
      before: a.before,
      after: a.after,
      ip: a.ip,
      at: a.createdAt.toISOString(),
    }));
    res.set('Cache-Control', 'no-store').json({ items, total, page: q.page, pageSize: q.pageSize });
  });

  return router;
}
