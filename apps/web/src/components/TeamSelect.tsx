import type { TeamPublic } from '@cydemic/shared';
import { Check, ChevronDown, OctagonAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './ui/Avatar';

interface TeamSelectProps {
  label: string;
  teams: TeamPublic[];
  value: string | null;
  onChange: (teamId: string) => void;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * Team picker following the WAI-ARIA "select-only combobox" pattern.
 * Focus stays on the combobox; options are announced via aria-activedescendant.
 * Keys: Down/Up/Home/End move, Enter/Space/Tab choose, Esc closes, typing jumps.
 * Each option shows the team badge (placeholder until real art exists).
 */
export function TeamSelect({ label, teams, value, onChange, error, disabled, className }: TeamSelectProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: '', at: 0 });

  const selectedIndex = teams.findIndex((t) => t.id === value);
  const selected = selectedIndex >= 0 ? teams[selectedIndex] : undefined;

  const openAt = (index: number) => {
    setActive(Math.max(0, Math.min(teams.length - 1, index)));
    setOpen(true);
  };
  const choose = (index: number) => {
    const team = teams[index];
    if (team) onChange(team.id);
    setOpen(false);
  };

  // Keep the active option visible while navigating.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`);
    // scrollIntoView is unavailable in some test environments (jsdom).
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const jumpTo = (char: string) => {
    const now = Date.now();
    const t = typeahead.current;
    t.text = now - t.at > 600 ? char : t.text + char;
    t.at = now;
    const start = open ? active : Math.max(0, selectedIndex);
    const order = [...teams.keys()].map((i) => (start + (t.text.length === 1 ? 1 : 0) + i) % teams.length);
    const match = order.find((i) => teams[i]!.name.toLowerCase().startsWith(t.text.toLowerCase()));
    if (match !== undefined) openAt(match);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || teams.length === 0) return;
    const last = teams.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : e.key === 'ArrowUp' ? last : 0);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        openAt(e.key === 'Home' ? 0 : last);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        jumpTo(e.key);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) choose(active);
        else setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
      case 'PageUp':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
      case 'PageDown':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Tab':
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) jumpTo(e.key);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <span id={labelId} className="mb-1.5 block font-label text-micro font-bold uppercase tracking-label text-ink/70">
        {label}
      </span>
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : 0))}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
        className={cn(
          'flex h-12 cursor-pointer select-none items-center gap-3 rounded-control border-[1.5px] bg-white px-3 text-base text-ink transition-colors',
          error ? 'border-dashed border-ink' : open ? 'border-ink' : 'border-line hover:border-ink/40',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {selected ? (
          <>
            <Avatar src={selected.avatar} name={selected.name} size="sm" decorative />
            <span className="flex-1 truncate font-mono font-semibold tracking-wide">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-ink/60">Choose your team</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-ink/60 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </div>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        tabIndex={-1}
        hidden={!open}
        className="scrollbar-thin absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-control border-[1.5px] border-line bg-white p-1.5"
      >
        {teams.map((team, i) => {
          const isSelected = team.id === value;
          return (
            <li
              key={team.id}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onPointerMove={() => active !== i && setActive(i)}
              className={cn(
                'flex h-11 cursor-pointer items-center gap-3 rounded-[8px] px-2.5 text-base text-ink',
                isSelected ? (i === active ? 'bg-teal/25' : 'bg-teal/15') : i === active && 'bg-ink/5',
              )}
            >
              <Avatar src={team.avatar} name={team.name} size="sm" decorative />
              <span className="flex-1 truncate font-mono font-semibold tracking-wide">{team.name}</span>
              {isSelected && <Check className="size-4 text-teal-dark" strokeWidth={2.5} aria-hidden="true" />}
            </li>
          );
        })}
      </ul>

      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-sm text-ink">
          <OctagonAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
