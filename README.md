# Binary Homeworlds

Single-player Binary Homeworlds (the 2-player Looney Pyramids game) vs an AI
opponent. React Native / Expo, TypeScript, fully offline — no backend, no
accounts, no network calls.

## Run

```bash
npm install
npm start          # scan the QR code with Expo Go (Android/iOS)
```

## Test

```bash
npm test           # Jest suite for the rules engine and AI legality
npx tsc --noEmit   # typecheck
```

## Architecture

- `src/engine/` — pure, UI-independent rules engine. Immutable `GameState`;
  the only entry points are `getLegalMoves(state)` and `applyMove(state, move)`.
  All rules live here: setup, the four color actions, sacrifice chains,
  catastrophes, star connectivity, win/loss/draw detection, and standard
  Homeworlds notation (`moveToNotation`).
- `src/ai/` — three difficulties. Easy plays a one-ply greedy move with noise;
  medium/hard run a time-capped (~1.5 s) alpha-beta search over the public
  engine API, counting depth per turn change so sacrifice chains are searched
  whole. The AI never touches engine internals.
- `src/store/` — Zustand store; game, log, undo history, and settings persist
  to AsyncStorage so a closed app resumes where it left off.
- `src/ui/` — dark-themed portrait UI. Pyramids are plain-View triangles
  (stars are diamonds); every tappable target is derived from `getLegalMoves`,
  so no illegal move can be offered.

## Rules notes (deliberate choices)

- A system that ever has zero ships fades immediately (stars to the bank) —
  including homeworlds, so abandoning your home even mid-sacrifice destroys it.
- Homeworld destruction loses immediately; "no ships at your own home" is
  evaluated at end of turn. Both at once is a draw.
- A sacrifice's remaining actions may be forfeited with End Turn.
