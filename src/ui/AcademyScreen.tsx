import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCENARIOS } from '../scenarios/scenarios';
import { useGameStore } from '../store/gameStore';
import { Starfield } from './Starfield';
import { theme } from './theme';

/** Tutorial lessons and puzzles, with completion checkmarks. */
export function AcademyScreen() {
  const scenarioDone = useGameStore((s) => s.scenarioDone);
  const startScenario = useGameStore((s) => s.startScenario);
  const setScreen = useGameStore((s) => s.setScreen);
  const insets = useSafeAreaInsets();

  const tutorials = SCENARIOS.filter((s) => s.kind === 'tutorial');
  const puzzles = SCENARIOS.filter((s) => s.kind === 'puzzle');

  const section = (label: string, items: typeof SCENARIOS) => (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      {items.map((sc) => (
        <Pressable
          key={sc.id}
          onPress={() => startScenario(sc.id)}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{sc.title}</Text>
            <Text style={styles.cardBlurb}>{sc.blurb}</Text>
          </View>
          <Text style={[styles.check, scenarioDone[sc.id] && { color: theme.ok }]}>
            {scenarioDone[sc.id] ? '✓' : '›'}
          </Text>
        </Pressable>
      ))}
    </>
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Starfield seed={13} />
      <View style={styles.headerRow}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={10}>
          <Text style={styles.back}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.title}>FLEET ACADEMY</Text>
        <View style={{ width: 52 }} />
      </View>

      {section('Flight school', tutorials)}
      {section('Tactical simulations', puzzles)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  back: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  title: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: theme.mono,
  },
  sectionLabel: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius + 2,
    backgroundColor: theme.panel,
    padding: 14,
    marginBottom: 8,
  },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  cardBlurb: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  check: { color: theme.accent, fontSize: 18, fontWeight: '800', marginLeft: 10 },
});
