# Project instructions

- Before adding or modifying a fighter, read `docs/CHARACTER-SPEC.md`.
- New character designs use `docs/templates/CHARACTER-BRIEF.md` and `docs/templates/character.template.json`.
- Preserve the shared P1/P2 controls and six-button resource contract. Fill all nine attack slots and corresponding sprite states explicitly.
- Keep the schema, engine, character configs, move list and specification consistent when introducing a mechanic. Do not claim support for effects the engine cannot execute.
- Run `npm test` and `npm run build` after gameplay/config changes; use the existing browser smoke test when browser QA is available.
- Direction attacks use forward or down plus attack. Up jumps immediately. Render one opaque fighter pose per frame; do not add crossfades or character afterimages.

- Default base max HP is 100; one shared multiplier (1/2/3/5) applies to both players. Damage values are designed directly at the lower level; never apply a global damage multiplier. Blocking takes 25% chip by default. All attack slots have no timer cooldown; reject nonzero move cooldowns. The shared dodge retains its separate cooldown. Keep recovery brief and preserve the 0.1-second attack input buffer. Never render numerical HP in battle. Charge converts at 100 per energy point, capped at 3 points. Skill costs 1 point; super costs 3. Successful moves spend points only, not partial charge.

- Prevent corner loops: preserve independent push velocity, diminishing hitstun, short recovery protection and post-throw protection. Normal punches/kicks must leave actionable repeat gaps. Stun caps: punch 12, kick 16, specials/skill 24, super 30 frames. Successful supers use the shared 0.18-second freeze and 0.58-second camera/flash cue; never add voiced super callouts or extra invulnerability.
