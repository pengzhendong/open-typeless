/**
 * ASR library exports.
 * Re-exports client and configuration utilities.
 */

export { FunASRClient } from './fun-asr-client';
export type { FunASREvents } from './fun-asr-client';

export {
  loadASRConfig,
  isASRConfigured,
  ConfigurationError,
} from './config';
export type { ASREnvConfig } from './config';