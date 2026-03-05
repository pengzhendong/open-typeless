/**
 * ASR IPC handlers.
 * Connects IPC channels to ASR service and forwards events to renderer.
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { IPC_CHANNELS } from '../../shared/constants/channels';
import { asrService } from '../services/asr/asr.service';
import { startASR, stopASR } from '../services/asr/procedures';
import type { ASRConfig } from '../../shared/types/asr';

const logger = log.scope('asr-handler');

// Track audio statistics
let totalAudioBytesReceived = 0;
let audioChunkCount = 0;

/**
 * Get all windows for broadcasting events.
 * We need to send events to ALL windows because:
 * - Main window handles audio recording
 * - Floating window handles status display
 */
function getAllWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(win => !win.isDestroyed());
}

/**
 * Send an event to all windows.
 */
function broadcastToAllWindows(channel: string, ...args: unknown[]): void {
  const windows = getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, ...args);
  }
  logger.debug('Broadcast to all windows', { channel, windowCount: windows.length });
}

/**
 * Setup ASR IPC handlers.
 * Registers handlers for start/stop requests and forwards service events to renderer.
 */
export function setupASRHandlers(): void {
  // Reset audio stats
  totalAudioBytesReceived = 0;
  audioChunkCount = 0;

  // Handle ASR start request
  ipcMain.handle(IPC_CHANNELS.ASR.START, async (_event, config?: Partial<ASRConfig>) => {
    logger.info('Received ASR start request', { hasConfig: !!config });
    // Reset stats on new session
    totalAudioBytesReceived = 0;
    audioChunkCount = 0;
    return startASR(config);
  });

  // Handle ASR stop request
  ipcMain.handle(IPC_CHANNELS.ASR.STOP, async () => {
    logger.info('Received ASR stop request', {
      totalChunks: audioChunkCount,
      totalBytes: totalAudioBytesReceived,
      totalDuration: `${(totalAudioBytesReceived / (16000 * 2)).toFixed(2)}s`,
    });
    return stopASR();
  });

  // Handle incoming audio data from renderer
  ipcMain.on(IPC_CHANNELS.ASR.SEND_AUDIO, (_event, chunk: ArrayBuffer) => {
    audioChunkCount++;
    totalAudioBytesReceived += chunk.byteLength;

    // Calculate duration
    const sampleRate = 16000;
    const bytesPerSample = 2;
    const currentDurationSeconds = totalAudioBytesReceived / (sampleRate * bytesPerSample);

    // Log first chunk and every 50 chunks
    if (audioChunkCount === 1 || audioChunkCount % 50 === 0) {
      logger.info('Received audio chunk', {
        chunkNum: audioChunkCount,
        chunkSize: chunk.byteLength,
        totalBytes: totalAudioBytesReceived,
        currentDuration: `${currentDurationSeconds.toFixed(2)}s`,
      });
    }

    asrService.processAudioChunk(chunk);
  });

  // Forward service events to renderer
  setupServiceEventForwarding();
}

/**
 * Setup event forwarding from ASR service to renderer process.
 */
function setupServiceEventForwarding(): void {
  // Forward status changes to ALL windows
  // Main window needs 'listening' to start recording
  // Floating window needs status updates for display
  asrService.on('status', (status) => {
    logger.info('Broadcasting status to all windows', { status });
    broadcastToAllWindows(IPC_CHANNELS.ASR.STATUS, status);
  });

  // Forward results to all windows
  asrService.on('result', (result) => {
    logger.info('ASR result received', {
      text: result.text?.substring(0, 50),
      isFinal: result.isFinal,
    });
    broadcastToAllWindows(IPC_CHANNELS.ASR.RESULT, result);
  });

  // Forward errors to all windows
  asrService.on('error', (error) => {
    logger.error('ASR error', { error: error.message });
    broadcastToAllWindows(IPC_CHANNELS.ASR.ERROR, error.message);
  });

  logger.info('ASR service event forwarding configured');
}