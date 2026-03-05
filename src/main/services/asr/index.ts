/**
 * ASR module exports.
 * Re-exports the ASR service, procedures, and library utilities.
 */

// Service
export { ASRService, asrService } from './asr.service';
export type { ASRServiceEvents } from './asr.service';

// Procedures
export { startASR, stopASR, getASRStatus } from './procedures';
export type { StartASRResponse, StopASRResponse } from './procedures';

// Types
export type {
  FunASRClientConfig,
  ConnectionState,
  FunASRMessage,
  FunASRHeader,
} from './types';
export { FUN_ASR_CONSTANTS } from './types';

// Library utilities
export {
  FunASRClient,
  loadASRConfig,
  isASRConfigured,
  ConfigurationError,
} from './lib';
export type { FunASREvents, ASREnvConfig } from './lib';