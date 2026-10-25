import { RecordingFormat, RecordingState } from '../types/index.ts';
import { encodeAudio, extractWaveform, generateSyntheticVoiceBuffer } from './audioEncoder.ts';

export interface VUMeterData {
  leftLevel: number; // 0 to 1
  rightLevel: number; // 0 to 1
  peak: number; // 0 to 1
  clipping: boolean;
}

export type TickCallback = (elapsedMs: number, vu: VUMeterData) => void;

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Recording buffers
  private leftChannelChunks: Float32Array[] = [];
  private rightChannelChunks: Float32Array[] = [];
  private totalRecordedSamples = 0;
  private startTime = 0;
  private pausedDuration = 0;
  private pauseTimestamp = 0;
  private isPaused = false;
  private timerInterval: any = null;

  private state: RecordingState = 'idle';
  private onTickCallback: TickCallback | null = null;
  private onStateChangeCallback: ((state: RecordingState) => void) | null = null;

  // Simulated mic mode (for Playwright or when mic unavailable)
  public isSimulated = false;

  // Current playback state
  private activeAudio: HTMLAudioElement | null = null;
  private currentPlayingId: string | null = null;
  private playbackCallback: ((posMs: number, durMs: number, isPlaying: boolean) => void) | null = null;

  getState(): RecordingState {
    return this.state;
  }

  onTick(cb: TickCallback) {
    this.onTickCallback = cb;
  }

  onStateChange(cb: (state: RecordingState) => void) {
    this.onStateChangeCallback = cb;
  }

  private setState(newState: RecordingState) {
    this.state = newState;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(newState);
    }
  }

  async startRecording(options: {
    format: RecordingFormat;
    stereo: boolean;
    gain: number;
    limiter: boolean;
    forceSimulated?: boolean;
  }): Promise<{ success: boolean; simulated: boolean; error?: string }> {
    if (this.state === 'recording' || this.state === 'paused') {
      return { success: false, simulated: this.isSimulated, error: 'Already recording' };
    }

    this.leftChannelChunks = [];
    this.rightChannelChunks = [];
    this.totalRecordedSamples = 0;
    this.pausedDuration = 0;
    this.isPaused = false;
    this.isSimulated = !!options.forceSimulated;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 44100 });
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      if (!options.forceSimulated && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: options.stereo ? 2 : 1,
              sampleRate: 44100,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: !options.limiter,
            },
          });
          this.isSimulated = false;
        } catch (micErr) {
          console.warn('Physical microphone access failed or unavailable, fallback to simulated audio:', micErr);
          this.isSimulated = true;
        }
      } else {
        this.isSimulated = true;
      }

      if (!this.isSimulated && this.mediaStream && this.audioCtx) {
        this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

        // Preamp gain node
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.value = options.gain;

        // Analyser node for live VU meter and visualizer
        this.analyserNode = this.audioCtx.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.5;

        // ScriptProcessorNode for raw PCM capture
        const bufferSize = 4096;
        this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 2, 2);

        this.processorNode.onaudioprocess = (e) => {
          if (this.isPaused) return;

          const inputLeft = e.inputBuffer.getChannelData(0);
          const inputRight = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inputLeft;

          // Copy slices
          const leftCopy = new Float32Array(inputLeft);
          const rightCopy = options.stereo ? new Float32Array(inputRight) : leftCopy;

          this.leftChannelChunks.push(leftCopy);
          if (options.stereo) {
            this.rightChannelChunks.push(rightCopy);
          }
          this.totalRecordedSamples += leftCopy.length;
        };

        this.sourceNode.connect(gainNode);
        gainNode.connect(this.analyserNode);
        gainNode.connect(this.processorNode);
        // Connect to dummy destination to keep processor node running
        this.processorNode.connect(this.audioCtx.destination);
      }

      this.startTime = Date.now();
      this.setState('recording');

      // Start 10Hz tick for UI timer and VU meter
      this.startMeterTick();

      return { success: true, simulated: this.isSimulated };
    } catch (err: any) {
      console.error('Failed to initialize audio capture:', err);
      return { success: false, simulated: true, error: err.message };
    }
  }

  private startMeterTick() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const freqData = new Uint8Array(128);

    this.timerInterval = setInterval(() => {
      if (this.state !== 'recording' && this.state !== 'paused') {
        clearInterval(this.timerInterval);
        return;
      }

      const elapsed = this.isPaused
        ? this.pauseTimestamp - this.startTime - this.pausedDuration
        : Date.now() - this.startTime - this.pausedDuration;

      let vu: VUMeterData;

      if (!this.isSimulated && this.analyserNode && !this.isPaused) {
        this.analyserNode.getByteFrequencyData(freqData);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < freqData.length; i++) {
          const val = freqData[i] / 255;
          sum += val;
          if (val > peak) peak = val;
        }
        const avg = sum / freqData.length;
        const clipping = peak >= 0.98;

        vu = {
          leftLevel: Math.min(1.0, avg * 1.8),
          rightLevel: Math.min(1.0, avg * 1.6 + 0.05),
          peak,
          clipping,
        };
      } else {
        // Simulated or paused VU meter
        if (this.isPaused) {
          vu = { leftLevel: 0, rightLevel: 0, peak: 0, clipping: false };
        } else {
          // Dynamic pulsing simulated VU for visual testability
          const t = Date.now() / 150;
          const leftLevel = 0.2 + 0.5 * Math.abs(Math.sin(t));
          const rightLevel = 0.2 + 0.45 * Math.abs(Math.cos(t * 0.8));
          const peak = Math.max(leftLevel, rightLevel);
          vu = {
            leftLevel,
            rightLevel,
            peak,
            clipping: peak > 0.95,
          };
        }
      }

      if (this.onTickCallback) {
        this.onTickCallback(Math.max(0, elapsed), vu);
      }
    }, 100);
  }

  pauseRecording() {
    if (this.state !== 'recording') return;
    this.isPaused = true;
    this.pauseTimestamp = Date.now();
    this.setState('paused');
  }

  resumeRecording() {
    if (this.state !== 'paused') return;
    this.pausedDuration += Date.now() - this.pauseTimestamp;
    this.isPaused = false;
    this.setState('recording');
  }

  async stopRecording(format: RecordingFormat, stereo: boolean): Promise<{
    blob: Blob;
    durationMs: number;
    sizeBytes: number;
    waveform: number[];
    leftChannel: Float32Array;
    rightChannel: Float32Array | null;
  }> {
    this.setState('stopping');
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const durationMs = Math.max(
      500,
      this.isPaused
        ? this.pauseTimestamp - this.startTime - this.pausedDuration
        : Date.now() - this.startTime - this.pausedDuration
    );

    // Stop real stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    let leftChannel: Float32Array;
    let rightChannel: Float32Array | null = null;

    if (!this.isSimulated && this.leftChannelChunks.length > 0) {
      // Merge recorded chunks
      leftChannel = new Float32Array(this.totalRecordedSamples);
      let offset = 0;
      for (const chunk of this.leftChannelChunks) {
        leftChannel.set(chunk, offset);
        offset += chunk.length;
      }

      if (stereo && this.rightChannelChunks.length > 0) {
        rightChannel = new Float32Array(this.totalRecordedSamples);
        offset = 0;
        for (const chunk of this.rightChannelChunks) {
          rightChannel.set(chunk, offset);
          offset += chunk.length;
        }
      }
    } else {
      // Generate synthetic buffer matching the recorded elapsed duration
      const durationSec = Math.max(1, durationMs / 1000);
      const synth = generateSyntheticVoiceBuffer(durationSec, 44100);
      leftChannel = synth.left;
      rightChannel = stereo ? synth.right : null;
    }

    // Extract waveform
    const waveform = extractWaveform(leftChannel, 80);

    // Encode to target format (MP3 128 kbps default)
    const { blob } = encodeAudio(format, leftChannel, rightChannel, 44100);

    this.setState('idle');
    this.isPaused = false;

    return {
      blob,
      durationMs,
      sizeBytes: blob.size,
      waveform,
      leftChannel,
      rightChannel,
    };
  }

  // --- Audio Player Engine ---
  playAudio(
    audioUrl: string,
    recordingId: string,
    title: string,
    initialPosMs: number = 0,
    rate: number = 1.0,
    onProgress: (posMs: number, durMs: number, isPlaying: boolean) => void
  ) {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.onplay = null;
      this.activeAudio.onpause = null;
      this.activeAudio.ontimeupdate = null;
      this.activeAudio.onended = null;
    }

    this.currentPlayingId = recordingId;
    this.playbackCallback = onProgress;

    const audio = new Audio(audioUrl);
    this.activeAudio = audio;
    audio.playbackRate = rate;

    if (initialPosMs > 0) {
      audio.currentTime = initialPosMs / 1000;
    }

    audio.ontimeupdate = () => {
      const posMs = Math.floor(audio.currentTime * 1000);
      const durMs = Math.floor((audio.duration || 0) * 1000);
      onProgress(posMs, durMs, !audio.paused);
    };

    audio.onended = () => {
      const durMs = Math.floor((audio.duration || 0) * 1000);
      onProgress(durMs, durMs, false);
    };

    audio.onpause = () => {
      const posMs = Math.floor(audio.currentTime * 1000);
      const durMs = Math.floor((audio.duration || 0) * 1000);
      onProgress(posMs, durMs, false);
    };

    audio.onplay = () => {
      const posMs = Math.floor(audio.currentTime * 1000);
      const durMs = Math.floor((audio.duration || 0) * 1000);
      onProgress(posMs, durMs, true);
    };

    audio.play().catch((e) => console.warn('Audio play request interrupted:', e));

    // MediaSession integration (FR-22)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'Диктофон Pro',
        album: 'Записи Android',
      });

      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
      });
    }
  }

  pausePlayer() {
    if (this.activeAudio && !this.activeAudio.paused) {
      this.activeAudio.pause();
    }
  }

  resumePlayer() {
    if (this.activeAudio && this.activeAudio.paused) {
      this.activeAudio.play().catch(console.warn);
    }
  }

  seekPlayer(positionMs: number) {
    if (this.activeAudio) {
      this.activeAudio.currentTime = positionMs / 1000;
    }
  }

  setPlaybackRate(rate: number) {
    if (this.activeAudio) {
      this.activeAudio.playbackRate = rate;
    }
  }

  getCurrentPlayingId(): string | null {
    return this.currentPlayingId;
  }

  isAudioPlaying(): boolean {
    return !!this.activeAudio && !this.activeAudio.paused;
  }
}

export const audioEngine = new AudioEngine();
