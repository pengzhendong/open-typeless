/**
 * ASR configuration loader.
 * Loads Fun-ASR credentials from:
 * 1. ~/.funtype/config.json (packaged app)
 * 2. .env file (development)
 */

import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { FUN_ASR_CONSTANTS } from '../types';

/**
 * ASR environment configuration.
 */
export interface ASREnvConfig {
  apiKey: string;
  endpoint?: string;
}

/**
 * Configuration file format in ~/.funtype/config.json
 */
export interface ConfigFile {
  DASHSCOPE_API_KEY?: string;
  FUN_ASR_ENDPOINT?: string;
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
 * Load config file from home directory.
 */
async function loadConfigFromHome(): Promise<ConfigFile | null> {
  const configPath = join(homedir(), '.funtype', 'config.json');
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as ConfigFile;
  } catch {
    return null;
  }
}

/**
 * Load ASR configuration.
 *
 * Priority:
 * 1. ~/.funtype/config.json (packaged app)
 * 2. process.env (if .env was loaded via dotenv)
 *
 * Required:
 * - DASHSCOPE_API_KEY: API Key from Alibaba Cloud DashScope console
 *
 * Optional:
 * - FUN_ASR_ENDPOINT: Custom WebSocket endpoint (default: Fun-ASR endpoint)
 *
 * @returns ASR configuration object
 * @throws ConfigurationError if required configuration is missing
 */
export async function loadASRConfig(): Promise<ASREnvConfig> {
  // 1. Try loading from home directory config file first
  const homeConfig = await loadConfigFromHome();
  if (homeConfig?.DASHSCOPE_API_KEY) {
    return {
      apiKey: homeConfig.DASHSCOPE_API_KEY,
      endpoint: homeConfig.FUN_ASR_ENDPOINT ?? FUN_ASR_CONSTANTS.ENDPOINT,
    };
  }

  // 2. Fallback to environment variables (for development with .env)
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const endpoint = process.env.FUN_ASR_ENDPOINT ?? FUN_ASR_CONSTANTS.ENDPOINT;

  if (!apiKey) {
    throw new ConfigurationError(
      'Missing configuration: DASHSCOPE_API_KEY. ' +
        'Please set it in ~/.funtype/config.json or .env file.'
    );
  }

  return {
    apiKey: apiKey as string,
    endpoint,
  };
}

/**
 * Check if ASR configuration is available without throwing.
 */
export async function isASRConfigured(): Promise<boolean> {
  const homeConfig = await loadConfigFromHome();
  if (homeConfig?.DASHSCOPE_API_KEY) {
    return true;
  }
  return Boolean(process.env.DASHSCOPE_API_KEY);
}