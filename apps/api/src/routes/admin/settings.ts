import type { AdminSettings } from '@cydemic/shared';
import { Router } from 'express';
import { z } from 'zod';
import { MAX_COOLDOWN_SECONDS } from '../../config';
import { backupSqlite, BACKUP_DIR } from '../../lib/backup';
import { HttpError } from '../../lib/http-error';
import { hashPassword } from '../../lib/password';
import { reqParam } from '../../lib/req';
import { requireAdminRole } from '../../middleware/admin-auth';
import { auditFromReq } from '../../services/audit';
import { getEffectiveSettings, getSettingsRow } from '../../services/settings';
import { readdirSync } from 'node:fs';
import type { AdminDeps } from './index';

const SettingsBody = z.object({
  signupLocked: z.boolean().optional(),
  maintenance: z.boolean().optional(),
  cooldownSeconds: z.number().int().min(1).max(MAX_COOLDOWN_SECONDS).nullable().optional(),
  newPlayersPerIp: z.number().int().min(1).nullable().optional(),
  maxPlayersPerTeam: z.number().int().min(0).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
});
const CreateAdminBody = z.object({ username: z.string().min(1).max(64), password: z.string().min(8).max(200), role: z.enum(['admin', 'viewer']).default('admin') });
const RoleBody = z.object({ role: z.enum(['admin', 'viewer']) });

export function settingsAdminRouter({ db, config }: AdminDeps) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const s = await getEffectiveSettings(db, config);
    const body: AdminSettings = {
      signupLocked: s.signupLocked,
      maintenance: s.maintenance,
      cooldownSeconds: s.cooldownSeconds,
      newPlayersPerIp: s.newPlayersPerIp,
      maxPlayersPerTeam: s.maxPlayersPerTeam,
      timezone: s.timezone,
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.put('/', requireAdminRole, async (req, res) => {
    const b = SettingsBody.parse(req.body);
    const before = await getSettingsRow(db);
    await db.settings.update({
      where: { id: 'main' },
      data: {
        ...(b.signupLocked !== undefined && { signupLocked: b.signupLocked }),
        ...(b.maintenance !== undefined && { maintenance: b.maintenance }),
        ...(b.cooldownSeconds !== undefined && { cooldownSeconds: b.cooldownSeconds }),
        ...(b.newPlayersPerIp !== undefined && { newPlayersPerIp: b.newPlayersPerIp }),
        ...(b.maxPlayersPerTeam !== undefined && { maxPlayersPerTeam: b.maxPlayersPerTeam }),
        ...(b.timezone !== undefined && { timezone: b.timezone }),
      },
    });
    await auditFromReq(db, req, 'settings.update', { before: { signupLocked: before.signupLocked, maintenance: before.maintenance }, after: b });
    res.json({ ok: true });
  });

  // --- Admin accounts ---
  router.get('/admins', async (_req, res) => {
    const admins = await db.adminAccount.findMany({ orderBy: { username: 'asc' }, select: { id: true, username: true, role: true, disabled: true, lastLoginAt: true } });
    res.json({ admins: admins.map((a) => ({ ...a, lastLoginAt: a.lastLoginAt?.toISOString() ?? null })) });
  });

  router.post('/admins', requireAdminRole, async (req, res) => {
    const b = CreateAdminBody.parse(req.body);
    const usernameKey = b.username.trim().toLowerCase();
    if (await db.adminAccount.findUnique({ where: { usernameKey } })) throw new HttpError(409, 'EXISTS', 'That admin username already exists.');
    const account = await db.adminAccount.create({ data: { username: b.username.trim(), usernameKey, role: b.role, passwordHash: await hashPassword(b.password) } });
    await auditFromReq(db, req, 'admin.create', { target: account.username, after: { role: b.role } });
    res.json({ id: account.id, username: account.username, role: account.role });
  });

  router.post('/admins/:id/disable', requireAdminRole, async (req, res) => {
    const disabled = z.object({ disabled: z.boolean() }).parse(req.body).disabled;
    const account = await db.adminAccount.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!account) throw new HttpError(404, 'NOT_FOUND', 'Admin not found');
    if (disabled && account.id === (await currentAdminId(db, req.admin!.username))) throw new HttpError(400, 'SELF', 'You cannot disable your own account.');
    await db.adminAccount.update({ where: { id: account.id }, data: { disabled } });
    if (disabled) await db.adminSession.deleteMany({ where: { adminId: account.id } });
    await auditFromReq(db, req, 'admin.disable', { target: account.username, after: { disabled } });
    res.json({ id: account.id, disabled });
  });

  router.post('/admins/:id/role', requireAdminRole, async (req, res) => {
    const { role } = RoleBody.parse(req.body);
    const account = await db.adminAccount.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!account) throw new HttpError(404, 'NOT_FOUND', 'Admin not found');
    await db.adminAccount.update({ where: { id: account.id }, data: { role } });
    await auditFromReq(db, req, 'admin.role', { target: account.username, before: { role: account.role }, after: { role } });
    res.json({ id: account.id, role });
  });

  router.post('/admins/:id/reset-password', requireAdminRole, async (req, res) => {
    const password = z.object({ password: z.string().min(8).max(200) }).parse(req.body).password;
    const account = await db.adminAccount.findUnique({ where: { id: reqParam(req, 'id') } });
    if (!account) throw new HttpError(404, 'NOT_FOUND', 'Admin not found');
    await db.adminAccount.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password) } });
    await db.adminSession.deleteMany({ where: { adminId: account.id } }); // force re-login
    await auditFromReq(db, req, 'admin.reset_password', { target: account.username });
    res.json({ ok: true });
  });

  // --- Backups ---
  router.get('/backups', async (_req, res) => {
    let files: string[] = [];
    try {
      files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort().reverse();
    } catch {
      /* no backups dir yet */
    }
    res.json({ backups: files, restoreHint: 'Stop the API and copy a backup over apps/api/dev.db (see README).' });
  });

  router.post('/backups', requireAdminRole, async (req, res) => {
    const path = await backupSqlite(config.databaseUrl, 10);
    await auditFromReq(db, req, 'backup.create');
    res.json({ ok: !!path, path: path ? path.split(/[\\/]/).pop() : null });
  });

  return router;
}

async function currentAdminId(db: AdminDeps['db'], username: string): Promise<string | null> {
  const a = await db.adminAccount.findUnique({ where: { usernameKey: username.toLowerCase() } });
  return a?.id ?? null;
}
