/**
 * Engine error codes — structured so the client can render them clearly.
 */

export type EngineErrorCode =
  | 'engine_unreachable'
  | 'workspace_create_failed'
  | 'blueprint_empty'
  | 'blueprint_too_large'
  | 'invalid_request'
  | 'session_not_found'
  | 'session_already_active'
  | 'opencode_not_found'
  | 'opencode_failed'
  | 'opencode_timeout'
  | 'provider_unavailable'
  | 'no_model_available'
  | 'model_incompatible'
  | 'port_in_use'
  | 'boundary_violation'
  | 'project_not_found'
  | 'not_a_file'
  | 'preview_unsupported'
  | 'task_not_found'
  | 'task_already_active'
  | 'internal';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly httpStatus: number;

  constructor(code: EngineErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
