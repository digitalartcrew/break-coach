import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MetricResult, METRIC_LABELS } from '@/types/motion';
import { colors, radius, scoreColor, spacing } from '@/theme';

export function ScoreBadge({ score, size = 96 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
      ]}
    >
      <Text style={[styles.badgeScore, { color }]}>{score}</Text>
      <Text style={styles.badgeOutOf}>/ 100</Text>
    </View>
  );
}

export function MetricBar({ result }: { result: MetricResult }) {
  const color = scoreColor(result.score);
  return (
    <View style={styles.metric}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{METRIC_LABELS[result.key]}</Text>
        <Text style={[styles.metricScore, { color }]}>{result.score}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${result.score}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.metricMsg}>{result.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  badgeScore: { fontSize: 34, fontWeight: '900' },
  badgeOutOf: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  metric: { gap: spacing(0.75), marginBottom: spacing(1.5) },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  metricScore: { fontSize: 15, fontWeight: '800' },
  track: {
    height: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: radius.sm },
  metricMsg: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
});
