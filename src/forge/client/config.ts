/**
 * Forge engine client configuration.
 *
 * The React Native app must never run child processes or touch the
 * filesystem. All forging happens in the local Node engine server; this
 * holds the URL the app uses to reach it.
 */

/**
 * Default engine endpoint. Override by setting the env var at build time or
 * tuning the value here.
 *  - iOS simulator: 127.0.0.1 reaches the host machine.
 *  - Android emulator: the host is reachable at 10.0.2.2.
 *  - Physical device: use your computer's LAN IP + the engine's port.
 */
export const ENGINE_BASE_URL =
  process.env.EXPO_PUBLIC_FORGE_ENGINE_URL ?? 'http://127.0.0.1:7171';

export const ENGINE_HEALTH_TIMEOUT_MS = 3000;
export const ENGINE_POLL_TIMEOUT_MS = 30000;
