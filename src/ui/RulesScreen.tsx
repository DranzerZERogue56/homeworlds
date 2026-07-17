import React, { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { theme } from './theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'The pieces',
    body:
      'One bank of 36 pyramids: 4 colors (red, yellow, green, blue) × 3 sizes ' +
      '(small, medium, large) × 3 copies. Pyramids are stars when they mark a ' +
      'system and ships when they fly. Nobody owns colors — you own the ships you control.',
  },
  {
    title: 'Setup',
    body:
      'Each player, in turn order, takes two pieces from the bank as their ' +
      'homeworld binary star, and one piece as their first ship there.',
  },
  {
    title: 'Star connections',
    body:
      'Two systems are connected only if their stars share NO size in common. ' +
      'Both sizes of a binary homeworld count. Same-size stars are never adjacent. ' +
      'Example: a {small, medium} homeworld connects only to large-star systems.',
  },
  {
    title: 'Your turn',
    body:
      'Take one free action using a color available to you at that system — ' +
      'through one of your own ships there or one of the system’s stars.',
  },
  {
    title: 'Green — Build',
    body:
      'Add the smallest bank piece of a color you already have a ship of at ' +
      'that system. It arrives as your new ship.',
  },
  {
    title: 'Blue — Trade',
    body: 'Swap one of your ships for a bank piece of the same size but a different color.',
  },
  {
    title: 'Yellow — Move',
    body:
      'Move one of your ships to a connected system, or discover a new system: ' +
      'take a star from the bank whose size differs from every star where you ' +
      'started, and move there.',
  },
  {
    title: 'Red — Attack',
    body:
      'Capture an enemy ship at your system. Your largest ship there must be at ' +
      'least as big as the target. The captured ship switches sides.',
  },
  {
    title: 'Sacrifice',
    body:
      'Instead of a free action, return one of your ships to the bank, then take ' +
      'as many actions of that ship’s color as its size (small 1 … large 3), at ' +
      'any system(s) where they are legal — no color access needed.',
  },
  {
    title: 'Catastrophe',
    body:
      'If 4+ pieces of one color (stars + all ships) occupy one system, either ' +
      'player may declare a catastrophe on their turn: all pieces of that color ' +
      'there return to the bank. A system that loses its star(s) is destroyed; ' +
      'surviving ships go back to the bank. A homeworld that loses both stars is gone.',
  },
  {
    title: 'Empty systems',
    body:
      'A system with no ships at all disappears immediately and its stars return ' +
      'to the bank — never abandon your homeworld, even for a moment.',
  },
  {
    title: 'Winning',
    body:
      'You lose when your homeworld is destroyed, or when you have no ships there ' +
      'at the end of a turn. Destroying each other simultaneously is a draw.',
  },
];

export function RulesScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen('menu');
      return true;
    });
    return () => sub.remove();
  }, [setScreen]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>How to play</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  back: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  title: { color: theme.text, fontSize: 16, fontWeight: '800' },
  section: {
    backgroundColor: theme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: { color: theme.text, fontWeight: '800', fontSize: 14, marginBottom: 4 },
  sectionBody: { color: theme.textDim, fontSize: 13, lineHeight: 19 },
});
