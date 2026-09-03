/**
 * FileTree — a real, selectable file explorer for a forged project (Phase 4).
 *
 * Builds an expandable/selectable tree from the engine's relative-path file
 * listing. Handles loading, empty, and error states. Selection is lifted to
 * the parent (file → code viewer). Expand/collapse state is internal.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../../theme/tokens';
import { typography } from '../../theme';
import type { ForgeFileNode } from '../../forge/engine';

interface FileTreeProps {
  files: ForgeFileNode[];
  /** Loading (engine round-trip in progress). */
  loading?: boolean;
  error?: string | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

interface TreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

/** Build an ordered tree from a flat relative-path listing. */
function buildChildren(files: ForgeFileNode[], root: string): TreeNode[] {
  return files
    .filter((f) => {
      const dir = f.type === 'directory' ? f.path : 
        (f.path.lastIndexOf('/') === -1 ? '' : f.path.slice(0, f.path.lastIndexOf('/')));
      if (root === '' && !f.path.includes('/')) return true;
      if (root === '') return false;
      return dir === root;
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.path.localeCompare(b.path);
    })
    .map((f) => ({
      path: f.path,
      name: f.path.slice(f.path.lastIndexOf('/') + 1),
      type: f.type,
    }));
}

function DirectoryRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.row, { paddingLeft: depth * 14 + spacing.sm }, pressed && styles.rowPressed]}
    >
      <Feather name="chevron-right" size={12} color={colors.textDim} style={[styles.chevron, expanded && styles.chevronOpen]} />
      <Feather name="folder" size={14} color={colors.accentGold} />
      <Text style={styles.folderName} numberOfLines={1}>{node.name}</Text>
    </Pressable>
  );
}

function FileRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.row,
        styles.fileRow,
        { paddingLeft: depth * 14 + spacing.sm + 16 },
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <Feather name="file-text" size={14} color={selected ? colors.accent : colors.textDim} />
      <Text style={[styles.fileName, selected && styles.fileNameSelected]} numberOfLines={1}>{node.name}</Text>
    </Pressable>
  );
}

export function FileTree({ files, loading, error, selectedPath, onSelect }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand the first level once files arrive.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && files.length > 0) {
      seeded.current = true;
      const top = buildChildren(files, '');
      setExpanded(new Set(top.filter((n) => n.type === 'directory').map((n) => n.path)));
    }
  }, [files]);

  // Validate and normalize file paths to prevent infinite loops
  const validatedFiles = useMemo(() => {
    // Create a copy of files array to avoid mutation
    const validFiles = [...files];
    
    // Check for paths with invalid structures (circular references, etc.)
    const seenPaths = new Set<string>();
    const normalizedFiles: ForgeFileNode[] = [];
    
    for (const file of validFiles) {
      // Skip if path is empty or null
      if (!file.path || typeof file.path !== 'string') continue;
      
      // Skip files that might cause cycles by being self-referential
      if (file.type === 'directory' && file.path === '') continue;
      
      // Keep track of what we've seen to prevent circular references
      if (!seenPaths.has(file.path)) {
        seenPaths.add(file.path);
        normalizedFiles.push({ ...file });
      }
    }
    
    return normalizedFiles;
  }, [files]);

  const renderRows = useMemo(() => {
    const rows: React.ReactNode[] = [];
    const visitedPaths = new Set<string>();
    
    // Add maximum depth tracking to prevent stack overflow
    const walk = (node: TreeNode, depth: number) => {
      // Prevent infinite recursion by tracking visited paths (improved)
      if (visitedPaths.has(node.path)) {
        return;
      }
      visitedPaths.add(node.path);
      
      // Add depth limit to prevent stack overflow for deeply nested structures
      if (depth > 100) {  
        console.warn(`Maximum directory depth exceeded for path: ${node.path}`);
        return;
      }
      
      const isExpanded = expanded.has(node.path);
      rows.push(
        node.type === 'directory' ? (
          <DirectoryRow
            key={node.path}
            node={node}
            depth={depth}
            expanded={isExpanded}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              })
            }
          />
        ) : (
          <FileRow
            key={node.path}
            node={node}
            depth={depth}
            selected={selectedPath === node.path}
            onSelect={() => onSelect(node.path)}
          />
        ),
      );
      if (node.type === 'directory' && isExpanded) {
        try {
          // Additional safety: create a defensive copy and validate paths
          const children = buildChildren(validatedFiles, node.path);
          
          // Validate that we're not going in circles with the children
          for (const child of children) {
            // This check prevents direct parent-child circular references
            if (child.path === node.path || 
                (child.type === 'directory' && child.path === node.path)) {
              continue; // Skip invalid circular references
            }
            walk(child, depth + 1);
          }
        } catch (error) {
          console.error('Error during recursion in FileTree:', error);
        }
      }
    };
    
    try {
      const topLevelNodes = buildChildren(validatedFiles, '');
      for (const node of topLevelNodes) walk(node, 0);
    } catch (error) {
      console.error('Error during initial tree construction:', error);
      // Return empty rows to prevent crash
      return [];
    }
    
    return rows;
  }, [validatedFiles, expanded, selectedPath, onSelect]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={styles.muted}>Reading files…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Feather name="alert-triangle" size={18} color={colors.danger} />
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <View style={styles.center}>
        <Feather name="folder" size={20} color={colors.textDim} />
        <Text style={styles.muted}>No files forged yet.</Text>
      </View>
    );
  }

  return <ScrollView style={styles.scroll}>{renderRows}</ScrollView>;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 1,
    paddingRight: spacing.sm,
    borderRadius: radii.sm,
  },
  rowPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  rowSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  fileRow: {
    paddingVertical: spacing.xs,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  folderName: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  fileName: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  fileNameSelected: {
    color: colors.accent,
  },
  center: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  muted: {
    ...typography.caption,
    color: colors.textDim,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});