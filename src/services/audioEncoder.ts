import { Mp3Encoder } from '@breezystack/lamejs';
import { RecordingFormat } from '../types/index.ts';

/**
 * Converts Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
 */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Encodes audio channels into MP3 using lamejs
 */
export function encodeMp3(
  leftChannel: Float32Array,
  rightChannel: Float32Array | null,
  sampleRate: number = 44100,
  kbps: number = 128
): Blob {
  try {
    const channels = rightChannel ? 2 : 1;
    const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);
    const mp3Data: Uint8Array[] = [];

    const leftPCM = floatTo16BitPCM(leftChannel);
    const rightPCM = rightChannel ? floatTo16BitPCM(rightChannel) : undefined;

    const sampleBlockSize = 1152;
    const numSamples = leftPCM.length;

    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const leftChunk = leftPCM.subarray(i, i + sampleBlockSize);
      const rightChunk = rightPCM ? rightPCM.subarray(i, i + sampleBlockSize) : undefined;
      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }

    const mp3End = mp3encoder.flush();
    if (mp3End.length > 0) {
      mp3Data.push(new Uint8Array(mp3End));
    }

    if (mp3Data.length > 0) {
      return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
    }
  } catch (e) {
    console.warn('MP3 encoding encountered an issue, falling back to WAV:', e);
  }
  return encodeWav(leftChannel, rightChannel, sampleRate);
}

/**
 * Encodes audio channels into standard PCM WAV
 */
export function encodeWav(
  leftChannel: Float32Array,
  rightChannel: Float32Array | null,
  sampleRate: number = 44100
): Blob {
  const numChannels = rightChannel ? 2 : 1;
  const length = leftChannel.length * numChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, length, true);

  // Write interleaved PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < leftChannel.length; i++) {
    let sL = Math.max(-1, Math.min(1, leftChannel[i]));
    view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
    offset += 2;

    if (rightChannel) {
      let sR = Math.max(-1, Math.min(1, rightChannel[i]));
      view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Extracts a normalized waveform profile (array of numbers from 0.05 to 1.0)
 */
export function extractWaveform(channelData: Float32Array, numBars: number = 80): number[] {
  if (!channelData || channelData.length === 0) {
    return Array(numBars).fill(0.1);
  }

  const blockSize = Math.floor(channelData.length / numBars);
  const waveform: number[] = [];

  for (let i = 0; i < numBars; i++) {
    const start = i * blockSize;
    let sum = 0;
    const count = Math.min(blockSize, channelData.length - start);
    for (let j = 0; j < count; j++) {
      const val = channelData[start + j];
      sum += val * val;
    }
    const rms = Math.sqrt(sum / (count || 1));
    // scale and normalize
    waveform.push(Math.max(0.08, Math.min(1.0, rms * 3.5)));
  }

  return waveform;
}

/**
 * Encodes audio channels into the requested format.
 * MP3 is the default format per FR-10.
 */
export function encodeAudio(
  format: RecordingFormat,
  leftChannel: Float32Array,
  rightChannel: Float32Array | null,
  sampleRate: number = 44100
): { blob: Blob; mimeType: string } {
  switch (format) {
    case 'mp3': {
      const blob = encodeMp3(leftChannel, rightChannel, sampleRate, 128);
      return { blob, mimeType: 'audio/mp3' };
    }
    case 'wav': {
      const blob = encodeWav(leftChannel, rightChannel, sampleRate);
      return { blob, mimeType: 'audio/wav' };
    }
    case 'flac':
    case 'aac':
    case 'opus':
    default: {
      // For high compatibility in browser environment, encode to MP3 or WAV
      const blob = encodeMp3(leftChannel, rightChannel, sampleRate, format === 'opus' ? 64 : 192);
      return { blob, mimeType: 'audio/mp3' };
    }
  }
}

/**
 * Synthesizes speech-like mock audio buffer for demo data or simulated mic mode
 */
export function generateSyntheticVoiceBuffer(
  durationSec: number = 5,
  sampleRate: number = 44100
): { left: Float32Array; right: Float32Array } {
  const numSamples = Math.floor(durationSec * sampleRate);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Formant-like frequencies for voice-like timbre
  const f0 = 130; // base pitch in Hz
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Voice cadence modulation (pause every 1.5s)
    const envelope = Math.max(0, Math.sin(t * Math.PI * 1.5)) * (0.4 + 0.3 * Math.sin(t * 8));
    const vibrato = Math.sin(t * 5) * 4;
    const wave1 = Math.sin(2 * Math.PI * (f0 + vibrato) * t);
    const wave2 = 0.5 * Math.sin(2 * Math.PI * (f0 * 2 + vibrato) * t);
    const wave3 = 0.25 * Math.sin(2 * Math.PI * (f0 * 3) * t);
    const sample = (wave1 + wave2 + wave3) * envelope * 0.45;

    left[i] = sample;
    right[i] = sample * 0.95;
  }

  return { left, right };
}
