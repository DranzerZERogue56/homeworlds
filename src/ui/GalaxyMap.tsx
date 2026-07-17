import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, Color, Move, Piece, PlayerId, System, pieceKey } from '../engine';
import { useGameStore } from '../store/gameStore';
import { Pyramid } from './Pyramid';
import { Selection, shipKey } from './selectors';
import { colorNames, pieceColors, theme } from './theme';

const APressable = Animated.createAnimatedComponent(Pressable);

/** A transient board effect keyed by log length so each move animates once. */
export interface MapFx {
  key: number;
  move: Move;
}

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
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;
const GRID_STEP = 44;

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

/** Faint tactical grid underlay; drawn oversized so panning never shows edges. */
function TacticalGrid({ w, h }: { w: number; h: number }) {
  if (w === 0) return null;
  const lines: React.ReactElement[] = [];
  for (let x = -w; x <= 2 * w; x += GRID_STEP) {
    lines.push(
      <View
        key={`v${x}`}
        style={{ position: 'absolute', left: x, top: -h, width: 1, height: 3 * h, backgroundColor: theme.accent, opacity: 0.05 }}
      />
    );
  }
  for (let y = -h; y <= 2 * h; y += GRID_STEP) {
    lines.push(
      <View
        key={`h${y}`}
        style={{ position: 'absolute', top: y, left: -w, height: 1, width: 3 * w, backgroundColor: theme.accent, opacity: 0.05 }}
      />
    );
  }
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{lines}</View>;
}

/** Amber corner brackets around the selected node — HUD target lock. */
function TargetBrackets() {
  const c = (edge: object) => (
    <View pointerEvents="none" style={[styles.bracket, edge]} />
  );
  return (
    <>
      {c({ top: -5, left: -5, borderTopWidth: 2, borderLeftWidth: 2 })}
      {c({ top: -5, right: -5, borderTopWidth: 2, borderRightWidth: 2 })}
      {c({ bottom: -5, left: -5, borderBottomWidth: 2, borderLeftWidth: 2 })}
      {c({ bottom: -5, right: -5, borderBottomWidth: 2, borderRightWidth: 2 })}
    </>
  );
}

interface Props {
  systems: System[];
  humanPlayer: PlayerId;
  selected: Selection | null;
  moveTargets: Set<number>;
  attackTargets: Set<string>;
  /** shipKey()s of own ships that offer at least one action if tapped. */
  actionable: Set<string>;
  recent: number[];
  interactive: boolean;
  /** Last-move effect to animate (null = none / animations off). */
  fx?: MapFx | null;
  onPressOwnShip: (system: number, ship: Piece) => void;
  onPressEnemyShip: (system: number, ship: Piece) => void;
  onPressSystem: (system: number) => void;
}

/** Expanding ring that plays once on mount, then reports done. */
function FlashRing({
  x,
  y,
  color,
  big,
  onDone,
}: {
  x: number;
  y: number;
  color: string;
  big?: boolean;
  onDone: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: big ? 650 : 450, useNativeDriver: true }).start(
      onDone
    );
  }, [anim, big, onDone]);
  const d = big ? 150 : 80;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: big ? 3 : 2,
        borderColor: color,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.5] }) }],
      }}
    />
  );
}

/** Ghost ship gliding between two system centers. */
function GlideGhost({
  from,
  to,
  ship,
  onDone,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  ship: Piece;
  onDone: () => void;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 450, useNativeDriver: true }).start(onDone);
  }, [t, onDone]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -20,
        top: -20,
        opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.95, 0.9, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
        ],
      }}
    >
      <Pyramid piece={ship} kind="shipUp" scale={0.68} />
    </Animated.View>
  );
}

/** Resolves the latest MapFx into flash/glide effects at node coordinates. */
function FxLayer({ fx, byId }: { fx: MapFx | null | undefined; byId: Map<number, Layout> }) {
  const [live, setLive] = useState<MapFx | null>(null);
  const doneKey = useRef(-1);
  useEffect(() => {
    if (fx && fx.key !== doneKey.current) setLive(fx);
  }, [fx]);
  if (!live) return null;

  const finish = () => {
    doneKey.current = live.key;
    setLive(null);
  };
  const m = live.move;
  const at = (id: number) => byId.get(id);

  if (m.type === 'move') {
    const a = at(m.system);
    const b = at(m.to);
    if (a && b)
      return (
        <GlideGhost
          key={live.key}
          from={{ x: a.cx, y: a.cy }}
          to={{ x: b.cx, y: b.cy }}
          ship={m.ship}
          onDone={finish}
        />
      );
    const dest = b ?? a;
    if (dest)
      return <FlashRing key={live.key} x={dest.cx} y={dest.cy} color={theme.accent} onDone={finish} />;
    finishSoon(finish);
    return null;
  }
  if (m.type === 'catastrophe') {
    const l = at(m.system);
    if (l)
      return (
        <FlashRing key={live.key} x={l.cx} y={l.cy} color={pieceColors[m.color]} big onDone={finish} />
      );
  } else if (m.type === 'attack') {
    const l = at(m.system);
    if (l) return <FlashRing key={live.key} x={l.cx} y={l.cy} color={theme.danger} onDone={finish} />;
  } else if (m.type === 'build' || m.type === 'trade' || m.type === 'sacrifice') {
    const l = at(m.system);
    if (l) return <FlashRing key={live.key} x={l.cx} y={l.cy} color={theme.accent} onDone={finish} />;
  }
  finishSoon(finish);
  return null;
}

/** Clear an effect we can't draw (system already swept away). */
function finishSoon(finish: () => void) {
  setTimeout(finish, 0);
}

/**
 * The playing field as a pinch-zoomable, pannable 2D star map with a HUD
 * tactical grid. Pure Views + PanResponder — no native gesture deps.
 */
export function GalaxyMap(props: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [transformed, setTransformed] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // Committed values (Animated values are write-mostly).
  const cur = useRef({ scale: 1, x: 0, y: 0 });
  const gesture = useRef({ startDist: 0, startScale: 1, startX: 0, startY: 0 });

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, g) =>
        g.numberActiveTouches === 2 || Math.abs(g.dx) + Math.abs(g.dy) > 14,
      onPanResponderGrant: (evt) => {
        gesture.current.startScale = cur.current.scale;
        gesture.current.startX = cur.current.x;
        gesture.current.startY = cur.current.y;
        gesture.current.startDist = 0;
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (gesture.current.startDist === 0) {
            gesture.current.startDist = dist;
            gesture.current.startScale = cur.current.scale;
          } else {
            const next = clamp(
              gesture.current.startScale * (dist / gesture.current.startDist),
              MIN_SCALE,
              MAX_SCALE
            );
            cur.current.scale = next;
            scale.setValue(next);
          }
        } else {
          const limit = 600 * cur.current.scale;
          cur.current.x = clamp(gesture.current.startX + g.dx, -limit, limit);
          cur.current.y = clamp(gesture.current.startY + g.dy, -limit, limit);
          pan.setValue({ x: cur.current.x, y: cur.current.y });
        }
      },
      onPanResponderRelease: () => {
        setTransformed(
          cur.current.scale !== 1 || cur.current.x !== 0 || cur.current.y !== 0
        );
      },
    })
  ).current;

  const resetView = () => {
    cur.current = { scale: 1, x: 0, y: 0 };
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 160, useNativeDriver: true }),
    ]).start(() => setTransformed(false));
  };

  const layouts = layoutSystems(props.systems, props.humanPlayer, size.w, size.h);
  const byId = new Map(layouts.map((l) => [l.system.id, l]));
  const selLayout = props.selected ? byId.get(props.selected.system) : undefined;

  const lines: React.ReactElement[] = [];
  if (selLayout) {
    for (const l of layouts) {
      if (l.system.id === selLayout.system.id) continue;
      if (!connectedSystems(selLayout.system, l.system)) continue;
      const isTarget = props.moveTargets.has(l.system.id);
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
      style={styles.viewport}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      {...responder.panHandlers}
    >
      <Animated.View
        style={[
          styles.field,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] },
        ]}
      >
        <TacticalGrid w={size.w} h={size.h} />
        {size.w > 0 && lines}
        {size.w > 0 &&
          layouts.map((l) => (
            <SystemNode
              key={l.system.id}
              layout={l}
              humanPlayer={props.humanPlayer}
              selected={props.selected}
              isMoveTarget={props.moveTargets.has(l.system.id)}
              attackTargets={props.attackTargets}
              actionable={props.actionable}
              recent={props.recent.includes(l.system.id)}
              interactive={props.interactive}
              dimmed={
                props.selected !== null &&
                l.system.id !== props.selected.system &&
                !props.moveTargets.has(l.system.id)
              }
              onPressOwnShip={props.onPressOwnShip}
              onPressEnemyShip={props.onPressEnemyShip}
              onPressSystem={props.onPressSystem}
            />
          ))}
        {size.w > 0 && <FxLayer fx={props.fx} byId={byId} />}
      </Animated.View>

      {transformed && (
        <Pressable style={styles.resetBtn} onPress={resetView} hitSlop={8}>
          <Text style={styles.resetText}>⌖ RESET VIEW</Text>
        </Pressable>
      )}
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
  const animations = useGameStore((s) => s.settings.animations);
  const mountScale = useRef(new Animated.Value(animations ? 0.6 : 1)).current;
  useEffect(() => {
    if (animations) {
      Animated.spring(mountScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label =
    system.home === humanPlayer
      ? `${system.name} · you`
      : system.home !== undefined
      ? `${system.name} · foe`
      : system.name;

  return (
    <APressable
      onPress={() => isMoveTarget && onPressSystem(system.id)}
      disabled={!interactive || !isMoveTarget}
      style={[
        styles.node,
        {
          left: cx - NODE_W / 2,
          top: cy - NODE_H / 2,
          transform: [{ scale: mountScale }],
        },
        system.home !== undefined && styles.homeNode,
        isMoveTarget && styles.targetNode,
        selHere && styles.selNode,
        dimmed && { opacity: 0.35 },
      ]}
    >
      {selHere && <TargetBrackets />}

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
    </APressable>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  field: { flex: 1 },
  node: {
    position: 'absolute',
    width: NODE_W,
    minHeight: NODE_H,
    borderRadius: theme.radius + 2,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  homeNode: { borderColor: '#3d5a8a', backgroundColor: theme.panelHi },
  targetNode: { borderColor: theme.highlight, borderWidth: 2 },
  selNode: { borderColor: theme.accent, borderWidth: 2 },
  bracket: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: theme.highlight,
  },
  shipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: 24,
  },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    color: theme.textDim,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: theme.mono,
  },
  badgeRow: { flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center' },
  dangerBadge: {
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  recentBadge: { color: theme.accent, fontSize: 10, fontWeight: '700' },
  resetBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.radius,
    backgroundColor: theme.panelSolid,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  resetText: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: theme.mono,
    letterSpacing: 1,
  },
});
