/**
 * useProjectFiles — load a forged project's file tree + selected file content
 * from the engine. Read-only. Handles loading/error states and reselect.
 */

import { useCallback, useEffect, useState } from 'react';
import { getEngineClient } from '../store/engineStore';
import type { ForgeFileContent, ForgeFileNode } from '../forge/engine';

export function useProjectFiles(projectId: string | null) {
  const [files, setFiles] = useState<ForgeFileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<ForgeFileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const loadFiles = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const listing = await getEngineClient().listProjectFiles(id);
      setFiles(listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the project files.');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectFile = useCallback(
    async (path: string) => {
      setSelectedPath(path);
      if (!projectId) return;
      setFileLoading(true);
      setFile(null);
      try {
        const content = await getEngineClient().readProjectFile(projectId, path);
        setFile(content);
      } catch {
        setFile({ path, type: 'file', size: 0, content: '' });
      } finally {
        setFileLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) {
      setFiles([]);
      setSelectedPath(null);
      setFile(null);
      setError(null);
      return;
    }
    void loadFiles(projectId);
  }, [projectId, loadFiles]);

  return {
    files,
    loading,
    error,
    selectedPath,
    file,
    fileLoading,
    selectFile,
    reload: projectId ? () => loadFiles(projectId) : () => {},
  };
}