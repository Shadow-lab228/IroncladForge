/**
 * useEngineConnection — mounts the engine monitor and exposes its state.
 *
 * Mount once near the root of the forge section (app/(forge)/_layout.tsx) so a
 * single bounded backoff loop tracks engine health for all forge screens.
 */

import { useEffect } from 'react';
import { useEngineStore } from '../store/engineStore';
import { getEngineClient } from '../store/engineStore';

export function useEngineConnection() {
  const state = useEngineStore((s) => s.state);
  const health = useEngineStore((s) => s.health);
  const lastError = useEngineStore((s) => s.lastError);
  const lastCheckedAt = useEngineStore((s) => s.lastCheckedAt);

  useEffect(() => {
    useEngineStore.getState().start();
    return () => useEngineStore.getState().stop();
  }, []);

  return {
    state,
    health,
    lastError,
    lastCheckedAt,
    isReady: state === 'connected' || state === 'connecting',
    retry: () => useEngineStore.getState().retry(),
    attemptStart: () => useEngineStore.getState().attemptStart(),
  };
}

/** Access the engine client owned by the store (used by useForge). */
export { getEngineClient as engineClient };