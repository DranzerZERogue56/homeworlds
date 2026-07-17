# Roadmap (planned 2026-07-17)

Owner-approved plan. Phases ship in order; each phase ends with tests green,
a version bump, a pushed commit, and a GitHub release with a sideload APK.

## Phase 8 — Foundation: HUD look, zoom/pan, settings
**Vibe: military starship HUD** — sharp corners, thin cyan/amber glow lines,
hex-grid underlay behind the galaxy map, monospace data readouts
(SYS/FLT/TRN counters), targeting brackets on the selected ship/system.
- Theme pass across GameScreen / GalaxyMap / ActionSheet / TurnGuide / menus.
- Pinch-zoom + pan on the galaxy map (RN Gesture via built-in PanResponder —
  no new native deps).
- Settings screen: animations on/off, eval bar on/off (default off),
  confirm-before-move, colorblind piece patterns, sound (future-proof toggle).

## Phase 9 — Insight: eval bar, AI explanations, replay viewer
- **Advantage meter**: normalized `evaluate()` (balanced weights) → thin
  chess.com-style bar. Toggle in settings, off by default, tap-to-peek in
  game; always shown in replays. Show ±score and a "who's ahead" arrow.
- **AI move explanations**: template text from the chosen move + before/after
  state ("Krayt sacrificed a yellow to invade your homeworld"). Shown in the
  ticker and move log.
- **Replay viewer**: step through any finished game on the galaxy map
  (store already logs notation; will need to persist move list as structured
  Moves, replaying from initial state). Eval graph over the whole game.

## Phase 10 — Animations
- Ships glide between systems; captured ships flip sides; catastrophes
  burst; sacrificed/built pieces dissolve to/from the bank. RN Animated only.
- Respect the settings toggle.

## Phase 11 — Scenario system: tutorial, then puzzles
- Scripted-scenario engine: fixed start state + allowed-move constraints +
  goal check + guidance text.
- Interactive tutorial as scenario chain (setup → each color → sacrifice →
  catastrophe).
- Puzzle packs: "win in 2", "survive the invasion", sacrifice-chain drills.

## Phase 12 — Commander campaign (ladder + stars)
- Linear ladder Bloop → … → Nyx; beat one to unlock the next.
- Per-commander star ratings: ★ win, ★ win without losing a large ship,
  ★ win by turn N. Progress + stars on the menu; persisted.

## Phase 13 — Pass-and-play 2P
- Local two-player: board flips per turn with a privacy hand-off screen;
  no AI, both sides human; same guided UX.

## Deferred / not planned
- Sound & haptics (toggle reserved in settings), achievements outside the
  campaign stars, multiple save slots, online play.
