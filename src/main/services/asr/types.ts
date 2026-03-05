/**
 * ASR Fun-ASR protocol types and Zod schemas.
 * Defines the WebSocket message format for Fun-ASR (Alibaba DashScope).
 */

import { z } from 'zod';

// ============================================================================
// Fun-ASR WebSocket Protocol Schemas
// ============================================================================

/**
 * Fun-ASR message header schema.
 */
export const funASRHeaderSchema = z.object({
  action: z.string(),
  task_id: z.string(),
  streaming: z.string(),
  event: z.string().optional(),
  error_message: z.string().optional(),
});

/**
 * Fun-ASR message payload schema.
 */
export const funASRPayloadSchema = z.object({
  task_group: z.string().optional(),
  task: z.string().optional(),
  function: z.string().optional(),
  model: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Generic Fun-ASR message schema.
 */
export const funASRMessageSchema = z.object({
  header: funASRHeaderSchema,
  payload: funASRPayloadSchema,
});

export type FunASRHeader = z.infer<typeof funASRHeaderSchema>;
export type FunASRPayload = z.infer<typeof funASRPayloadSchema>;
export type FunASRMessage = z.infer<typeof funASRMessageSchema>;

// ============================================================================
// Transcription Result Schemas
// ============================================================================

/**
 * Single word result from ASR.
 */
export const wordResultSchema = z.object({
  begin_time: z.number(),
  end_time: z.number(),
  text: z.string(),
  punctuation: z.string().optional(),
  fixed: z.boolean().optional(),
  speaker_id: z.number().optional(),
});

/**
 * Sentence result from ASR.
 */
export const sentenceResultSchema = z.object({
  sentence_id: z.number(),
  begin_time: z.number(),
  end_time: z.number().nullable(),
  text: z.string(),
  channel_id: z.number(),
  speaker_id: z.number().nullable(),
  sentence_end: z.boolean(),
  sentence_begin: z.boolean(),
  words: z.array(wordResultSchema).optional(),
  stash: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Transcription result payload.
 */
export const transcriptionResultPayloadSchema = z.object({
  sentence: sentenceResultSchema.optional(),
});

export type WordResult = z.infer<typeof wordResultSchema>;
export type SentenceResult = z.infer<typeof sentenceResultSchema>;
export type TranscriptionResultPayload = z.infer<typeof transcriptionResultPayloadSchema>;

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Configuration for FunASRClient.
 */
export interface FunASRClientConfig {
  apiKey: string;
  endpoint: string;
}

/**
 * Connection state for the WebSocket client.
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// ============================================================================
// Internal Message Types (for building outgoing messages)
// ============================================================================

/**
 * Audio configuration for session start.
 */
export interface AudioConfig {
  format: 'pcm';
  sample_rate: 16000;
  channel: 1;
  bits: 16;
  codec: 'raw';
}

/**
 * Session start message payload.
 */
export interface StartTranscriptionPayload {
  audio: AudioConfig;
  user: Record<string, unknown>;
  request: {
    model_name: string;
  };
}

/**
 * Audio data message payload.
 */
export interface AudioDataPayload {
  audio: string; // base64 encoded
  index: number;
  is_end: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const FUN_ASR_CONSTANTS = {
  /** WebSocket endpoint for Fun-ASR */
  ENDPOINT: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/',

  /** Model name */
  MODEL_NAME: 'fun-asr-realtime',

  /** Audio format */
  SAMPLE_RATE: 16000,
  FORMAT: 'wav',

  /** Language hints */
  LANGUAGE_HINTS: ['zh', 'en'],

  /** Reconnection settings */
  RECONNECT: {
    MAX_ATTEMPTS: 5,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
  },
} as const;