import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, Color, Piece, PlayerId, System, pieceKey } from '../engine';
import { Pyramid } from './Pyramid';
import { Selection, shipKey } from './selectors';
import { colorNames, pieceColors, theme } from './theme';

/** Colors with 3+ pieces at a system are one build away from a catastrophe. */
function dangers(system: System): { color: Color; count: number }[] {
  const out: { color: Color; count: number }[] = [];
  for (const c of COLORS) {
    let n = 0;
    for (const p of system.stars) if (p.color === c) n++;
    for (const side of system.ships) for (const p of side) if (p.color === c) n++;
    if (n >= 3) out.push({ color: c, count: n });
  }
  return out;
}

/** Two systems connect when their star sizes are completely disjoint. */
function connectedSystems(a: System, b: System): boolean {
  const sizes = new Set(a.stars.map((s) => s.size));
  return b.stars.every((s) => !sizes.has(s.size));
}

const NODE_W = 132;
const NODE_H = 118;

/** Fractional (x, y) slots for colonies, in stable order of appearance. */
const COLONY_SLOTS: [number, number][] = [
  [0.26, 0.38],
  [0.74, 0.38],
  [0.26, 0.62],
  [0.74, 0.62],
  [0.5, 0.5],
  [0.5, 0.3],
  [0.5, 0.7],
  [0.12, 0.5],
  [0.88, 0.5],
];

interface Layout {
  system: System;
  cx: number;
  cy: number;
}

function layoutSystems(
  systems: System[],
  humanPlayer: PlayerId,
  width: number,
  height: number
): Layout[] {
  const enemy: PlayerId = humanPlayer === 0 ? 1 : 0;
  const out: Layout[] = [];
  let slot = 0;
  for (const sys of [...systems].sort((a, b) => a.id - b.id)) {
    let fx: number;
    let fy: number;
    if (sys.home === enemy) {
      fx = 0.5;
      fy = 0.13;
    } else if (sys.home === humanPlayer) {
      fx = 0.5;
      fy = 0.87;
    } else {
      [fx, fy] = COLONY_SLOTS[slot % COLONY_SLOTS.length];
      slot++;
    }
    out.push({ system: sys, cx: fx * width, cy: fy * height });
  }
  return out;
}

/** A thin rotated View from (x1,y1) to (x2,y2). */
function Line({
  x1,
  y1,
  x2,
  y2,
  color,
  thick,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  thick?: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - len / 2,
        top: (y1 + y2) / 2 - (thick ? 1.5 : 0.5),
        width: len,
        height: thick ? 3 : 1,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

interface Props {
  systems: System[];
  humanPlayer: PlayerId;
  selected: Selection | null;
  /** System ids that are legal move destinations for the selected ship. */
  moveTargets: Set<number>;
  /** Enemy piece keys attackable at the selected ship's system. */
  attackTargets: Set<string>;
  /** shipKey()s of own ships that offer at least one action if tapped. */
  actionable: Set<string>;
  /** Systems the AI touched last turn. */
  recent: number[];
  interactive: boolean;
  onPressOwnShip: (system: number, ship: Piece) => void;
  onPressEnemyShip: (system: number, ship: Piece) => void;
  onPressSystem: (system: number) => void;
}

/**
 * The playing field as a 2D star map: homeworlds pinned top/bottom, colonies
 * floating between, connection lines shown for the selected ship's reach.
 * Pure Views — no SVG or image assets.
 */
export function GalaxyMap({
  systems,
  humanPlayer,
  selected,
  moveTargets,
  attackTargets,
  actionable,
  recent,
  interactive,
  onPressOwnShip,
  onPressEnemyShip,
  onPressSystem,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layouts = layoutSystems(systems, humanPlayer, size.w, size.h);
  const byId = new Map(layouts.map((l) => [l.system.id, l]));
  const selLayout = selected ? byId.get(selected.system) : undefined;

  // Faint web of all connections while a ship is selected; bright lines to
  // legal move targets.
  const lines: React.ReactElement[] = [];
  if (selLayout) {
    for (const l of layouts) {
      if (l.system.id === selLayout.system.id) continue;
      if (!connectedSystems(selLayout.system, l.system)) continue;
      const isTarget = moveTargets.has(l.system.id);
      lines.push(
        <Line
          key={`ln${l.system.id}`}
          x1={selLayout.cx}
          y1={selLayout.cy}
          x2={l.cx}
          y2={l.cy}
          color={isTarget ? theme.highlight : theme.border}
          thick={isTarget}
        />
      );
    }
  }

  return (
    <View
      style={styles.field}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size.w > 0 && lines}
      {size.w > 0 &&
        layouts.map((l) => (
          <SystemNode
            key={l.system.id}
            layout={l}
            humanPlayer={humanPlayer}
            selected={selected}
            isMoveTarget={moveTargets.has(l.system.id)}
            attackTargets={attackTargets}
            actionable={actionable}
            recent={recent.includes(l.system.id)}
            interactive={interactive}
            dimmed={
              selected !== null &&
              l.system.id !== selected.system &&
              !moveTargets.has(l.system.id)
            }
            onPressOwnShip={onPressOwnShip}
            onPressEnemyShip={onPressEnemyShip}
            onPressSystem={onPressSystem}
          />
        ))}
    </View>
  );
}

function SystemNode({
  layout,
  humanPlayer,
  selected,
  isMoveTarget,
  attackTargets,
  actionable,
  recent,
  interactive,
  dimmed,
  onPressOwnShip,
  onPressEnemyShip,
  onPressSystem,
}: {
  layout: Layout;
  humanPlayer: PlayerId;
  selected: Selection | null;
  isMoveTarget: boolean;
  attackTargets: Set<string>;
  actionable: Set<string>;
  recent: boolean;
  interactive: boolean;
  dimmed: boolean;
  onPressOwnShip: (system: number, ship: Piece) => void;
  onPressEnemyShip: (system: number, ship: Piece) => void;
  onPressSystem: (system: number) => void;
}) {
  const { system, cx, cy } = layout;
  const enemy: PlayerId = humanPlayer === 0 ? 1 : 0;
  const selHere = selected?.system === system.id;
  const danger = dangers(system);

  const label =
    system.home === humanPlayer
      ? `${system.name} · you`
      : system.home !== undefined
      ? `${system.name} · foe`
      : system.name;

  return (
    <Pressable
      onPress={() => isMoveTarget && onPressSystem(system.id)}
      disabled={!interactive || !isMoveTarget}
      style={[
        styles.node,
        {
          left: cx - NODE_W / 2,
          top: cy - NODE_H / 2,
        },
        system.home !== undefined && styles.homeNode,
        isMoveTarget && styles.targetNode,
        selHere && styles.selNode,
        dimmed && { opacity: 0.35 },
      ]}
    >
      {/* Enemy ships (point down) */}
      <View style={styles.shipRow}>
        {system.ships[enemy].map((ship, i) => {
          const attackable = selHere && attackTargets.has(pieceKey(ship));
          return (
            <Pyramid
              key={`e${i}`}
              piece={ship}
              kind="shipDown"
              scale={0.68}
              highlighted={attackable}
              onPress={
                interactive && attackable
                  ? () => onPressEnemyShip(system.id, ship)
                  : undefined
              }
            />
          );
        })}
      </View>

      {/* Stars */}
      <View style={styles.starRow}>
        {system.stars.map((star, i) => (
          <Pyramid key={`s${i}`} piece={star} kind="star" scale={0.62} />
        ))}
      </View>

      {/* Own ships (point up) */}
      <View style={styles.shipRow}>
        {system.ships[humanPlayer].map((ship, i) => {
          const isSel =
            selHere &&
            selected !== null &&
            pieceKey(selected.ship) === pieceKey(ship) &&
            system.ships[humanPlayer].findIndex((x) => pieceKey(x) === pieceKey(ship)) === i;
          const canAct = interactive && actionable.has(shipKey(system.id, ship));
          return (
            <Pyramid
              key={`m${i}`}
              piece={ship}
              kind="shipUp"
              scale={0.68}
              selected={isSel}
              highlighted={!isSel && !selected && canAct}
              onPress={interactive ? () => onPressOwnShip(system.id, ship) : undefined}
            />
          );
        })}
      </View>

      <Text style={[styles.name, isMoveTarget && { color: theme.highlight }]} numberOfLines={1}>
        {isMoveTarget ? `◉ ${label}` : label}
      </Text>

      {(danger.length > 0 || recent) && (
        <View style={styles.badgeRow}>
          {danger.map((dz) => (
            <Text
              key={dz.color}
              style={[styles.dangerBadge, { color: pieceColors[dz.color], borderColor: pieceColors[dz.color] }]}
            >
              {dz.count >= 4 ? '☄' : '⚠'}
              {colorNames[dz.color][0]}×{dz.count}
            </Text>
          ))}
          {recent && <Text style={styles.recentBadge}>⟡</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1 },
  node: {
    position: 'absolute',
    width: NODE_W,
    minHeight: NODE_H,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  homeNode: { borderColor: '#4a5a8f', backgroundColor: theme.panelHi },
  targetNode: { borderColor: theme.highlight, borderWidth: 2 },
  selNode: { borderColor: theme.accent, borderWidth: 2 },
  shipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: 24,
  },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: theme.textDim, fontSize: 10, fontWeight: '700', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center' },
  dangerBadge: {
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  recentBadge: { color: theme.accent, fontSize: 10, fontWeight: '700' },
});
