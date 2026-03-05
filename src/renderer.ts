/**
 * Main window renderer process.
 * Handles automatic audio recording when ASR status changes.
 */

import './index.css';
import { AudioRecorder } from './renderer/src/modules/asr';

console.log(
  '👋 This message is being logged by "renderer.ts", included via Vite',
);

// Audio recorder instance
let recorder: AudioRecorder | null = null;

// Track total audio sent
let totalAudioBytes = 0;
let audioChunkCount = 0;

/**
 * Initialize audio recorder with callback to send chunks to main process.
 */
function initRecorder(): AudioRecorder {
  return new AudioRecorder(
    (chunk) => {
      // Calculate audio duration
      // PCM 16-bit = 2 bytes per sample
      // sampleRate = 16000 Hz
      const bytesPerSample = 2;
      const sampleRate = 16000;
      const chunkDurationSeconds = chunk.byteLength / (sampleRate * bytesPerSample);

      // Update totals
      totalAudioBytes += chunk.byteLength;
      audioChunkCount++;

      // Log every chunk with duration
      console.log(`[Audio] Chunk #${audioChunkCount}: size=${chunk.byteLength} bytes, duration=${chunkDurationSeconds.toFixed(3)}s, total=${totalAudioBytes} bytes`);

      // Send audio chunk to main process via IPC
      window.api.asr.sendAudio(chunk);
    },
    (state) => {
      console.log('[Renderer] AudioRecorder state:', state);
    }
  );
}

/**
 * Start recording audio.
 */
async function startRecording(): Promise<void> {
  if (!recorder) {
    recorder = initRecorder();
  }

  // Reset counters
  totalAudioBytes = 0;
  audioChunkCount = 0;

  try {
    console.log('[Renderer] Starting audio recording...');
    await recorder.start();
    console.log('[Renderer] Audio recording started');
  } catch (error) {
    console.error('[Renderer] Failed to start recording:', error);
  }
}

/**
 * Stop recording audio.
 */
function stopRecording(): void {
  if (recorder) {
    console.log('[Renderer] Stopping audio recording...');
    recorder.stop();

    // Log total audio statistics
    const totalDurationSeconds = totalAudioBytes / (16000 * 2);
    console.log(`[Audio] Recording stopped. Total: ${audioChunkCount} chunks, ${totalAudioBytes} bytes, ${totalDurationSeconds.toFixed(2)}s`);

    console.log('[Renderer] Audio recording stopped');
  }
}

// Track current status to avoid duplicate operations
let currentStatus = 'idle';

// Listen for ASR status changes from main process
window.api.asr.onStatus((status) => {
  console.log('[Renderer] ASR status changed:', status);

  // Avoid duplicate handling
  if (status === currentStatus) return;
  currentStatus = status;

  if (status === 'listening') {
    // Start recording when ASR is listening
    startRecording();
  } else {
    // Stop recording for any other status
    stopRecording();
  }
});

// Listen for ASR results - print to browser console
window.api.asr.onResult((result) => {
  console.log('🎯 ASR Result:', {
    text: result.text,
    isFinal: result.isFinal,
    type: result.type,
  });
});

// Listen for ASR errors
window.api.asr.onError((error) => {
  console.error('❌ ASR Error:', error);
});

// Cleanup on window unload
window.addEventListener('beforeunload', () => {
  if (recorder) {
    recorder.destroy();
    recorder = null;
  }
});

console.log('[Renderer] Auto-recording initialized, waiting for ASR status...');