/**
 * ASR configuration loader.
 * Loads Fun-ASR credentials from environment variables.
 */

import { FUN_ASR_CONSTANTS } from '../types';

/**
 * ASR environment configuration.
 */
export interface ASREnvConfig {
  apiKey: string;
  endpoint?: string;
}

/**
 * Configuration error when required environment variables are missing.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Load ASR configuration from environment variables.
 *
 * Required environment variables:
 * - DASHSCOPE_API_KEY: API Key from Alibaba Cloud DashScope console
 *
 * Optional environment variables:
 * - FUN_ASR_ENDPOINT: Custom WebSocket endpoint (default: Fun-ASR endpoint)
 *
 * @returns ASR configuration object
 * @throws ConfigurationError if required variables are missing
 */
export function loadASRConfig(): ASREnvConfig {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const endpoint = process.env.FUN_ASR_ENDPOINT ?? FUN_ASR_CONSTANTS.ENDPOINT;

  if (!apiKey) {
    throw new ConfigurationError(
      'Missing required environment variable: DASHSCOPE_API_KEY'
    );
  }

  return {
    apiKey: apiKey as string,
    endpoint,
  };
}

/**
 * Check if ASR configuration is available without throwing.
 *
 * @returns true if all required environment variables are set
 */
export function isASRConfigured(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY);
}