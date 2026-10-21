/**
 * Challenges retired before the 22 October 2026 event (too hard for a beginner
 * board, or not solvable with only a browser). Their source lives in challenge-services/_retired/ so they can be
 * restored later; nothing seeds, starts or expects them. `npm run challenges:retire`
 * removes them (and every row that references them) from an existing database.
 */
export const RETIRED_CHALLENGE_IDS: readonly string[] = [
  // Phase 5: too hard for a beginner board.
  'web3', 'web6', 'web7', 'web8', 'web11', 'web12', 'net2',
  // Phase 6: the board became browser-only (no Burp, nmap, Wireshark or other tools).
  'web4', 'web5', 'web9', 'web10', 'web13', 'net1', 'net3', 'net4',
];

export const isRetired = (id: string): boolean => RETIRED_CHALLENGE_IDS.includes(id);
