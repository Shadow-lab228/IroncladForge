/**
 * CodeViewer — read-only code viewer for a forged project file (Phase 4).
 *
 * Monospace, line numbers, dark forge styling. Read-only by design: code
 * editing is explicitly OUT of Phase 4 scope. Renders binary-ish / generated
 * artifacts (e.g. lockfiles) honestly when they exist.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing, type } from '../../theme/tokens';
import { typography } from '../../theme';

interface CodeViewerProps {
  path: string;
  content: string;
  size: number;
  /** Whether the engine reported this path as a file. */
  notFound?: boolean;
}

const KEYWORDS = /\b(import|export|const|let|var|function|return|from|new|async|await|interface|type|class|extends|implements|if|else|for|of|in|default|switch|case|break|try|catch)\b/;

/** Lightweight token tinting: comments, strings, keywords (no parser). */
function highlightLine(line: string): React.ReactNode {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('*/')) {
    return <Text style={styles.tokenComment}>{line}</Text>;
  }

  const parts: React.ReactNode[] = [];
  const stringRe = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/y;
  const keywordRe = new RegExp(KEYWORDS.source, 'gy');
  let i = 0;

  // Split into string / keyword / plain runs.
  const whole = new RegExp(stringRe.source + '|' + keywordRe.source, 'y');
  while (i < line.length) {
    whole.lastIndex = i;
    const m = whole.exec(line);
    if (!m) {
      // Skip one char as plain.
      parts.push(<Text key={i}>{line[i]}</Text>);
      i += 1;
      continue;
    }
    const token = m[0];
    const isString = token.startsWith('"') || token.startsWith("'") || token.startsWith('`');
    parts.push(
      <Text key={i} style={isString ? styles.tokenString : styles.tokenKeyword}>
        {token}
      </Text>,
    );
    i = whole.lastIndex;
  }
  return <>{parts.length ? parts : line}</>;
}

export function CodeViewer({ path, content, size, notFound }: CodeViewerProps) {
  const lines = notFound ? [] : content.split('\n');

  if (notFound) {
    return (
      <View style={styles.empty}>
        <Feather name="file" size={22} color={colors.textDim} />
        <Text style={styles.emptyText}>File not found in the workspace.</Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <ScrollView style={styles.scroll} horizontal={false}>
        <ScrollView style={styles.hscroll} horizontal>
          <View>
            {lines.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={styles.lineNumber}>{i + 1}</Text>
                <Text style={styles.code}>{highlightLine(line)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
      <Text style={styles.meta} numberOfLines={1} ellipsizeMode="middle">
        {path} · {size} B
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: '#0a0806',
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  hscroll: {
    flexGrow: 1,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineNumber: {
    fontFamily: type.mono,
    fontSize: type.scale.sm,
    color: colors.textDim,
    textAlign: 'right',
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 40,
    userSelect: 'none',
  },
  code: {
    fontFamily: type.mono,
    fontSize: type.scale.sm,
    lineHeight: 20,
    color: colors.text,
    paddingVertical: spacing.xs,
    paddingRight: spacing.xl,
  },
  tokenKeyword: {
    color: colors.accentHot,
  },
  tokenString: {
    color: colors.success,
  },
  tokenComment: {
    color: colors.textDim,
    fontStyle: 'italic',
  },
  meta: {
    fontFamily: type.mono,
    fontSize: type.scale.xs,
    color: colors.textDim,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#0a0806',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textDim,
  },
});