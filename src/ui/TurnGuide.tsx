import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GameState, Move } from '../engine';
import { sacrificeHint, sacrificeProgress } from './selectors';
import { colorNames, pieceColors, theme } from './theme';

interface Props {
  game: GameState;
  humanTurn: boolean;
  aiThinking: boolean;
  /** "Warlord Krayt · Medium" — the AI commander and rank. */
  opponentLabel: string;
  hasSelection: boolean;
  catastropheMoves: Extract<Move, { type: 'catastrophe' }>[];
  endMove: Move | undefined;
  sysName: (id: number) => string;
  onPlay: (m: Move) => void;
}

/**
 * One always-visible strip that tells the player exactly what to do next.
 * During a sacrifice it becomes a stepper: "Action 2 of 3 — tap a ship…",
 * and calls out explicitly when no legal actions remain (instead of leaving
 * a silent dead board).
 */
export function TurnGuide({
  game,
  humanTurn,
  aiThinking,
  opponentLabel,
  hasSelection,
  catastropheMoves,
  endMove,
  sysName,
  onPlay,
}: Props) {
  if (game.phase === 'finished') return null;

  if (aiThinking || !humanTurn) {
    return (
      <View style={styles.strip}>
        <Text style={styles.text}>{opponentLabel} is thinking…</Text>
      </View>
    );
  }

  if (game.phase === 'setup') {
    return (
      <View style={styles.strip}>
        <Text style={styles.text}>Found your homeworld: pick two stars and a first ship below.</Text>
      </View>
    );
  }

  const prog = sacrificeProgress(game);

  return (
    <View
      style={[
        styles.strip,
        prog && { borderColor: pieceColors[prog.color] },
      ]}
    >
      {prog ? (
        <>
          <View style={styles.row}>
            <Text style={[styles.title, { color: pieceColors[prog.color] }]}>
              {colorNames[prog.color]} sacrifice
            </Text>
            <View style={styles.pipRow}>
              {Array.from({ length: prog.total }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    {
                      backgroundColor:
                        i < prog.total - prog.left ? theme.border : pieceColors[prog.color],
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.text}>
              Action {Math.min(prog.step, prog.total)} of {prog.total}
            </Text>
          </View>
          {prog.stuck ? (
            <Text style={[styles.hint, { color: theme.danger }]}>
              No legal {colorNames[prog.color].toLowerCase()} actions remain — end your turn.
            </Text>
          ) : (
            <Text style={styles.hint}>{sacrificeHint(prog.color)}</Text>
          )}
          {endMove && (
            <GuideButton
              label={prog.stuck ? 'End turn' : `End turn (forfeit ${prog.left} left)`}
              emphasized={prog.stuck}
              onPress={() => onPlay(endMove)}
            />
          )}
        </>
      ) : game.phase === 'post' ? (
        <>
          <Text style={styles.text}>
            Action complete.
            {catastropheMoves.length > 0 ? ' Declare a catastrophe below, or end your turn.' : ''}
          </Text>
          {endMove && <GuideButton label="End turn" emphasized onPress={() => onPlay(endMove)} />}
        </>
      ) : endMove && game.phase === 'main' ? (
        <>
          <Text style={styles.text}>No actions available.</Text>
          <GuideButton label="Pass" emphasized onPress={() => onPlay(endMove)} />
        </>
      ) : (
        <Text style={styles.text}>
          {hasSelection
            ? 'Pick an action below, or tap a highlighted system / enemy ship.'
            : 'Your turn — tap one of your glowing ships.'}
        </Text>
      )}

      {catastropheMoves.length > 0 && (
        <View style={styles.chipRow}>
          {catastropheMoves.map((m, i) => (
            <GuideButton
              key={i}
              danger
              label={`☄ ${colorNames[m.color]} catastrophe at ${sysName(m.system)}`}
              onPress={() => onPlay(m)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function GuideButton({
  label,
  onPress,
  danger,
  emphasized,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  emphasized?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        danger && { borderColor: theme.danger },
        emphasized && { borderColor: theme.accent, backgroundColor: '#1b2a4a' },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.btnText, danger && { color: theme.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 10,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panelHi,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontWeight: '800', fontSize: 14 },
  text: { color: theme.text, fontSize: 13, fontWeight: '600' },
  hint: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  pipRow: { flexDirection: 'row', gap: 4 },
  pip: { width: 10, height: 10, borderRadius: 5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  btn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 6,
  },
  btnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
});
