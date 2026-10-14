import {
  Binary,
  Bug,
  Cpu,
  Eye,
  Flag,
  Globe,
  KeyRound,
  Network,
  Puzzle,
  ScanSearch,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

/**
 * Categories are data, so this maps known names to icons and falls back to a
 * flag for anything new. Category is shown by icon + label, never by color.
 */
const icons: Record<string, LucideIcon> = {
  web: Globe,
  network: Network,
  crypto: KeyRound,
  cryptography: KeyRound,
  forensics: ScanSearch,
  pwn: Bug,
  exploit: Bug,
  reversing: Cpu,
  reverse: Cpu,
  rev: Cpu,
  osint: Eye,
  stego: Binary,
  steganography: Binary,
  mobile: Smartphone,
  misc: Puzzle,
};

export function categoryIcon(category: string): LucideIcon {
  return icons[category.trim().toLowerCase()] ?? Flag;
}
