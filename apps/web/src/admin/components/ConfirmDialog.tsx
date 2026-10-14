import { useEffect, useState, type ReactNode } from 'react';
import { Button, Input, Modal, Notice } from '../../components/ui';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  kicker?: string;
  children: ReactNode;
  confirmLabel?: string;
  /** When set, the operator must type this exact text (e.g. a player name) to enable confirm. */
  requireText?: string;
  tone?: 'default' | 'danger';
  loading?: boolean;
  error?: string | null;
}

/**
 * Confirmation for destructive admin actions. The most dangerous ones pass
 * `requireText`, forcing the operator to type the exact target name first.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  kicker = 'Confirm',
  children,
  confirmLabel = 'Confirm',
  requireText,
  tone = 'default',
  loading = false,
  error,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const ready = !requireText || typed === requireText;

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker={kicker}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!ready} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-body text-ink/80">
        {tone === 'danger' && <Notice tone="warning" title="This cannot be undone">This action is permanent. A database backup is taken first.</Notice>}
        <div>{children}</div>
        {requireText && (
          <Input
            label={`Type "${requireText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
