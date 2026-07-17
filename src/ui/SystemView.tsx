import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, Color, Piece, PlayerId, System, pieceKey } from '../engine';
import { Pyramid } from './Pyramid';
import { colorNames, pieceColors, theme } from './theme';

/** Colors with 3+ pieces here are one build away from a catastrophe. */
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

interface Props {
  system: System;
  humanPlayer: PlayerId;
  selectedShip: { system: number; ship: Piece } | null;
  /** System ids that are legal move destinations for the selected ship. */
  moveTargets: Set<number>;
  /** Enemy piece keys attackable in this system (when a ship here is selected). */
  attackTargets: Set<string>;
  onPressOwnShip: (system: number, ship: Piece) => void;
  onPressEnemyShip: (system: number, ship: Piece) => void;
  onPressSystem: (system: number) => void;
  interactive: boolean;
  /** True when a ship is selected elsewhere and this system is unreachable. */
  dimmed?: boolean;
  /** True when the AI touched this system on its last turn. */
  recent?: boolean;
}

export function SystemView({
  system,
  humanPlayer,
  selectedShip,
  moveTargets,
  attackTargets,
  onPressOwnShip,
  onPressEnemyShip,
  onPressSystem,
  interactive,
  dimmed,
  recent,
}: Props) {
  const danger = dangers(system);
  const enemy: PlayerId = humanPlayer === 0 ? 1 : 0;
  const isTarget = moveTargets.has(system.id);
  const selHere = selectedShip?.system === system.id;

  const label =
    system.home === humanPlayer
      ? `${system.name} (you)`
      : system.home !== undefined
      ? `${system.name} (opponent)`
      : system.name;

  return (
    <Pressable
      onPress={() => isTarget && onPressSystem(system.id)}
      disabled={!interactive || !isTarget}
      style={[
        styles.card,
        system.home !== undefined && styles.homeCard,
        isTarget && styles.target,
        dimmed && { opacity: 0.4 },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.name, isTarget && { color: theme.highlight }]}>
          {label}
          {isTarget ? '  ◉ move here' : ''}
        </Text>
        <View style={styles.badgeRow}>
          {danger.map((dz) => (
            <Text
              key={dz.color}
              style={[
                styles.dangerBadge,
                { color: pieceColors[dz.color], borderColor: pieceColors[dz.color] },
              ]}
            >
              {dz.count >= 4 ? '☄' : '⚠'} {colorNames[dz.color].toLowerCase()} ×{dz.count}
            </Text>
          ))}
          {recent && <Text style={styles.recentBadge}>⟡ opponent</Text>}
        </View>
      </View>

      <View style={styles.row}>
        {/* Enemy ships (point down) */}
        <View style={styles.shipGroup}>
          {system.ships[enemy].map((ship, i) => {
            const attackable = selHere && attackTargets.has(pieceKey(ship));
            return (
              <Pyramid
                key={`e${i}`}
                piece={ship}
                kind="shipDown"
                highlighted={attackable}
                onPress={
                  interactive && attackable ? () => onPressEnemyShip(system.id, ship) : undefined
                }
              />
            );
          })}
        </View>

        {/* Stars */}
        <View style={styles.stars}>
          {system.stars.map((star, i) => (
            <Pyramid key={`s${i}`} piece={star} kind="star" />
          ))}
        </View>

        {/* Own ships (point up) */}
        <View style={styles.shipGroup}>
          {system.ships[humanPlayer].map((ship, i) => {
            const isSel =
              selHere &&
              selectedShip !== null &&
              pieceKey(selectedShip.ship) === pieceKey(ship) &&
              // Highlight only the first matching copy.
              system.ships[humanPlayer].findIndex((x) => pieceKey(x) === pieceKey(ship)) === i;
            return (
              <Pyramid
                key={`m${i}`}
                piece={ship}
                kind="shipUp"
                selected={isSel}
                onPress={interactive ? () => onPressOwnShip(system.id, ship) : undefined}
              />
            );
          })}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  homeCard: { borderColor: '#4a5a8f', backgroundColor: theme.panelHi },
  target: { borderColor: theme.highlight, borderWidth: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: theme.textDim, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dangerBadge: {
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  recentBadge: { color: theme.accent, fontSize: 10, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  shipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    flex: 1,
    minHeight: 40,
    gap: 1,
  },
});
