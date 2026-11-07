# Increment plans

One directory per session increment: `docs/plans/<YYYY-MM-DD>-<slug>/`.

Three files are required, and `npm run check-loop-artifacts` fails without
them:

| File | Contract |
|---|---|
| `plan.md` | What is being done, why, the blast radius, and a `**Done bar:**` line. A plan over a few files points at the reviewed artifact and its `sha256`. |
| `tasks.md` | The plan as checkboxes, in execution order. A step is ticked only when it is verified. |
| `aar.md` | What happened, what went right, what went wrong, findings with a terminal disposition, and a final `LOOP PAUSED` or `LOOP OPEN`. |

Rules:

- The directory date is the session date. The slug is lowercase and hyphenated.
- A missing `**Done bar:**` is a warning, not an error: it is a planning
  quality signal, not a completion gate.
- `LOOP PAUSED` requires a green gate suite and no open P0/P1 beyond what
  `ROADMAP.md` schedules. `LOOP OPEN` names the action that is still open.
- A deviation from the plan is recorded in `aar.md` and, when it changes scope,
  as an amendment to `plan.md`.
- Plans are not edited after close. A follow-on change is a new increment.
