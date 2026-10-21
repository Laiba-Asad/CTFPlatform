# Retired challenges

These challenges were removed from the board before the 22 October 2026 event
(the board is for beginners on a one-hour clock). Their source is kept here,
unchanged, so they can be restored later. Nothing imports, seeds, starts or
expects anything in this folder.

| id | Title | Points | Port (freed) | Files |
|---|---|---|---|---|
| web3 | The VIP Lounge | 400 | 5003 | `web03.py`, `templates/login.html`, `templates/dashboard.html` |
| web6 | Forgotten Files | 450 | 5006 | `web06.py` |
| web7 | The Reading Room | 550 | 5007 | `web07.py` |
| web8 | The Ping Test | 600 | 5008 | `web08.py`, `templates/ping_test.html` |
| web11 | Cookie Stealer | 400 | 5011 | `web11.py` |
| web12 | Leaky Downloads | 450 | 5012 | `web12.py` |
| net2 | Whispers in the Wire | 500 | (capture) | `net2_capture.py` |

Their tests are in `retired_tests.py` (not collected by pytest). Their flags were
removed from the active `.flags.env`; a copy is kept only in the git-ignored
backup `challenge-services/.flags.env.pre-phase5.bak`.

## Restoring one

1. Move its module (and templates) back next to `serve.py` / into `templates/`.
2. Add it to `serve.MODULES`, to `seed/challenges.meta.json`, and its flag to `.flags.env`.
3. Remove its id from `apps/api/src/challenges/retired.ts`.
4. Move its tests back into `test_challenges.py`.
5. `npm run flag:hash`, then `npm run seed`.
