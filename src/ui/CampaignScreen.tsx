import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Difficulty } from '../ai/ai';
import { FAST_WIN_TURNS, LADDER, MAX_STARS, totalStars, unlockedIndex } from '../campaign/campaign';
import { useGameStore } from '../store/gameStore';
import { Starfield } from './Starfield';
import { theme } from './theme';

const RANK_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  lessEasy: 'Less easy',
  medium: 'Medium',
  hard: 'Hard',
  masterful: 'Masterful',
};

function Stars({ n }: { n: number }) {
  return (
    <Text style={styles.stars}>
      {[1, 2, 3].map((i) => (
        <Text key={i} style={{ color: i <= n ? theme.highlight : theme.border }}>
          ★
        </Text>
      ))}
    </Text>
  );
}

/** The commander ladder: beat each to unlock the next; replay for stars. */
export function CampaignScreen() {
  const campaign = useGameStore((s) => s.campaign);
  const startCampaignGame = useGameStore((s) => s.startCampaignGame);
  const setScreen = useGameStore((s) => s.setScreen);
  const insets = useSafeAreaInsets();

  const unlocked = unlockedIndex(campaign);
  const done = unlocked >= LADDER.length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Starfield seed={17} />
      <View style={styles.headerRow}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={10}>
          <Text style={styles.back}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.title}>CAMPAIGN</Text>
        <Text style={styles.progress}>★{totalStars(campaign)}/{MAX_STARS}</Text>
      </View>

      <Text style={styles.subtitle}>
        {done
          ? 'Ladder complete — every commander defeated. Replay any bout for missing stars.'
          : `Defeat each commander to unlock the next. Extra stars: keep a large ship alive, win by turn ${FAST_WIN_TURNS}.`}
      </Text>

      {LADDER.map((p, i) => {
        const stars = campaign[p.id] ?? 0;
        const locked = i > unlocked;
        const current = i === unlocked;
        return (
          <Pressable
            key={p.id}
            disabled={locked}
            onPress={() => startCampaignGame(p.id)}
            style={({ pressed }) => [
              styles.card,
              current && styles.currentCard,
              locked && { opacity: 0.4 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.rankNo}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {locked ? '???' : p.name}
                <Text style={styles.rank}>  · {RANK_LABELS[p.difficulty]}</Text>
              </Text>
              <Text style={styles.cardBlurb}>{locked ? 'Defeat the ranks above to reveal.' : p.blurb}</Text>
            </View>
            {locked ? <Text style={styles.lock}>🔒</Text> : <Stars n={stars} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  back: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  title: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: theme.mono,
  },
  progress: {
    color: theme.highlight,
    fontFamily: theme.mono,
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: { color: theme.textDim, fontSize: 12, marginBottom: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius + 2,
    backgroundColor: theme.panel,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  currentCard: { borderColor: theme.highlight },
  rankNo: {
    color: theme.textDim,
    fontFamily: theme.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  rank: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  cardBlurb: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  stars: { fontSize: 14, letterSpacing: 1 },
  lock: { fontSize: 14 },
});
