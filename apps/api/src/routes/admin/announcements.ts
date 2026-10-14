import type { AnnouncementRow } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { reqParam } from '../../lib/req';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import type { AdminDeps } from './index';

const Body = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  active: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const toRow = (a: { id: string; title: string; body: string; active: boolean; expiresAt: Date | null; createdAt: Date }): AnnouncementRow => ({
  id: a.id,
  title: a.title,
  body: a.body,
  active: a.active,
  expiresAt: a.expiresAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
});

export function announcementsAdminRouter({ db }: AdminDeps) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const list = await db.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    res.set('Cache-Control', 'no-store').json({ announcements: list.map(toRow) });
  });

  router.post('/', requireAdminRole, async (req, res) => {
    const b = Body.parse(req.body);
    const created = await db.announcement.create({ data: { title: b.title, body: b.body, active: b.active ?? true, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null } });
    await auditFromReq(db, req, 'announcement.create', { target: created.id, after: { title: b.title } });
    res.json(toRow(created));
  });

  router.patch('/:id', requireAdminRole, async (req, res) => {
    const b = Body.partial().parse(req.body);
    const existing = await db.announcement.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found');
    const updated = await db.announcement.update({
      where: { id: existing.id },
      data: {
        ...(b.title !== undefined && { title: b.title }),
        ...(b.body !== undefined && { body: b.body }),
        ...(b.active !== undefined && { active: b.active }),
        ...(b.expiresAt !== undefined && { expiresAt: b.expiresAt ? new Date(b.expiresAt) : null }),
      },
    });
    await auditFromReq(db, req, 'announcement.update', { target: existing.id });
    res.json(toRow(updated));
  });

  router.delete('/:id', requireAdminRole, async (req, res) => {
    const existing = await db.announcement.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Announcement not found');
    await db.announcement.delete({ where: { id: existing.id } });
    await auditFromReq(db, req, 'announcement.delete', { target: existing.id, before: { title: existing.title } });
    res.json({ ok: true });
  });

  return router;
}
