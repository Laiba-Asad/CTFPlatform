/**
 * The team roster is fixed data, identical to seed/teams.json. It lives here so
 * the login screen can render the team dropdown immediately, without waiting for
 * any API call. The API still validates the chosen team on submit.
 *
 * Keep this in sync with seed/teams.json (a test asserts they match).
 */
export interface TeamInfo {
  id: string;
  name: string;
  /** Badge image path, e.g. /avatars/<id>.png. A placeholder shows until it exists. */
  avatar: string;
  tagline: string;
}

export const TEAMS: TeamInfo[] = [
  { id: 'z3r0d4y', name: 'Z3R0D4Y', avatar: '/avatars/z3r0d4y.png', tagline: 'Placeholder tagline' },
  { id: 'n0-tr4c3', name: 'N0_TR4C3', avatar: '/avatars/n0-tr4c3.png', tagline: 'Placeholder tagline' },
  { id: 'sh3llsh0ck', name: 'SH3LLSH0CK', avatar: '/avatars/sh3llsh0ck.png', tagline: 'Placeholder tagline' },
  { id: 'kr4ck-t3am', name: 'KR4CK_T3AM', avatar: '/avatars/kr4ck-t3am.png', tagline: 'Placeholder tagline' },
  { id: '0xdeadc0de', name: '0xDEADC0DE', avatar: '/avatars/0xdeadc0de.png', tagline: 'Placeholder tagline' },
  { id: 'gh0st-pr0t0', name: 'GH0ST.PR0T0', avatar: '/avatars/gh0st-pr0t0.png', tagline: 'Placeholder tagline' },
];
