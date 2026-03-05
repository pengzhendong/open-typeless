/**
 * Fun-ASR WebSocket Client
 * Real-time speech recognition using Alibaba DashScope Fun-ASR API
 *
 * Reference: https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-open-api-with-websocket
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import log from 'electron-log';
import type { ASRResult, ASRStatus } from '../../../../shared/types/asr';
import type { FunASRClientConfig, ConnectionState } from '../types';

const logger = log.scope('fun-asr-client');

// ============ Event Types ============

export interface FunASREvents {
  result: (result: ASRResult) => void;
  status: (status: ASRStatus) => void;
  error: (error: Error) => void;
}

export interface FunASRClient {
  on<K extends keyof FunASREvents>(event: K, listener: FunASREvents[K]): this;
  off<K extends keyof FunASREvents>(event: K, listener: FunASREvents[K]): this;
  emit<K extends keyof FunASREvents>(event: K, ...args: Parameters<FunASREvents[K]>): boolean;
}

// ============ Fun-ASR Client Class ============

export class FunASRClient extends EventEmitter {
  private readonly config: FunASRClientConfig;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private taskId = '';
  private isTaskStarted = false;
  private isFinished = false;

  constructor(config: FunASRClientConfig) {
    super();
    this.config = config;
  }

  get isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Already connected');
      return;
    }

    this.reset();
    this.updateState('connecting');
    this.emitStatus('connecting');

    return new Promise((resolve, reject) => {
      this.taskId = randomUUID().replace(/-/g, '').slice(0, 32);

      logger.info('Connecting to Fun-ASR', {
        endpoint: this.config.endpoint,
        taskId: this.taskId,
      });

      this.ws = new WebSocket(this.config.endpoint, {
        headers: {
          Authorization: `bearer ${this.config.apiKey}`,
        },
      });

      const connectionTimeout = setTimeout(() => {
        if (this.connectionState === 'connecting') {
          const err = new Error('Connection timeout');
          logger.error('Connection timeout');
          this.cleanup();
          this.updateState('error');
          this.emitStatus('error');
          this.emit('error', err);
          reject(err);
        }
      }, 30000);

      this.ws.on('open', () => {
        logger.info('WebSocket connected, sending run-task');
        this.sendRunTask();
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('unexpected-response', (_request, response) => {
        logger.error('Unexpected response', { statusCode: response.statusCode });

        let body = '';
        response.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        response.on('end', () => {
          logger.error('Response body', { body });
          const err = new Error(`WebSocket upgrade failed: ${response.statusCode} - ${body}`);
          clearTimeout(connectionTimeout);
          this.updateState('error');
          this.emitStatus('error');
          this.emit('error', err);
          reject(err);
        });
      });

      this.ws.on('error', (error: Error) => {
        logger.error('WebSocket error', { error: error.message });
        clearTimeout(connectionTimeout);
        this.emit('error', error);

        if (this.connectionState === 'connecting') {
          reject(error);
        }
      });

      this.ws.on('close', () => {
        logger.info('WebSocket closed', { taskId: this.taskId, isFinished: this.isFinished });
        clearTimeout(connectionTimeout);

        if (this.connectionState !== 'disconnected') {
          this.updateState('disconnected');
          if (!this.isFinished) {
            this.emitStatus('idle');
          }
        }
      });
    });
  }

  disconnect(): void {
    logger.info('Disconnecting', { taskId: this.taskId });
    this.cleanup();
    this.updateState('disconnected');
    this.emitStatus('idle');
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (!this.isConnected) {
      logger.warn('Cannot send audio: not connected');
      return;
    }

    if (!this.isTaskStarted) {
      logger.warn('Cannot send audio: task not started');
      return;
    }

    if (this.ws) {
      this.ws.send(Buffer.from(chunk));
    }
  }

  finishAudio(): void {
    if (!this.isConnected) {
      logger.warn('Cannot finish audio: not connected');
      return;
    }

    logger.info('Sending finish-task', { taskId: this.taskId });
    this.emitStatus('processing');
    this.sendFinishTask();
  }

  // ============ Private Methods ============

  private reset(): void {
    this.taskId = '';
    this.isTaskStarted = false;
    this.isFinished = false;
  }

  private updateState(state: ConnectionState): void {
    this.connectionState = state;
  }

  private emitStatus(status: ASRStatus): void {
    this.emit('status', status);
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
      } catch {
        // Ignore errors when closing
      }
      this.ws = null;
    }
  }

  private sendRunTask(): void {
    if (!this.ws) return;

    const message = {
      header: {
        action: 'run-task',
        task_id: this.taskId,
        streaming: 'duplex',
      },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model: 'fun-asr-realtime',
        parameters: {
          sample_rate: 16000,
          format: 'wav',
          language_hints: ['zh', 'en'],
        },
        input: {},
      },
    };

    logger.debug('Sending run-task', { taskId: this.taskId });
    this.ws.send(JSON.stringify(message));
  }

  private sendFinishTask(): void {
    if (!this.ws) return;

    const message = {
      header: {
        action: 'finish-task',
        task_id: this.taskId,
        streaming: 'duplex',
      },
      payload: {
        input: {},
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      logger.debug('Received message', { event: message.header?.event });

      switch (message.header?.event) {
        case 'task-started':
          logger.info('Task started', { taskId: this.taskId });
          this.isTaskStarted = true;
          this.updateState('connected');
          this.emitStatus('listening');
          break;

        case 'result-generated': {
          const text = message.payload?.output?.sentence?.text;
          const isFinal = message.payload?.output?.sentence?.sentence_end === true;

          if (text) {
            logger.debug('ASR result', { text, isFinal });

            const result: ASRResult = {
              type: isFinal ? 'final' : 'interim',
              text: text,
              isFinal: isFinal ?? false,
            };

            this.emit('result', result);

            if (isFinal) {
              this.emitStatus('done');
            }
          }
          break;
        }

        case 'task-finished':
          logger.info('Task finished', { taskId: this.taskId });
          this.isFinished = true;
          break;

        case 'task-failed':
          logger.error('Task failed', { error: message.header?.error_message });
          this.emit('error', new Error(message.header?.error_message || 'Task failed'));
          this.emitStatus('error');
          break;

        default:
          logger.debug('Unknown event', { event: message.header?.event });
      }
    } catch (error) {
      logger.error('Failed to parse message', { error });
    }
  }
}