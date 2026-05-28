const DEFAULT_MODEL_ID = 'Xenova/whisper-small.en';

let cachedModelId = null;
let cachedPipelinePromise = null;

async function getWhisperPipeline(modelId) {
  if (cachedPipelinePromise && cachedModelId === modelId) return cachedPipelinePromise;

  cachedModelId = modelId;
  cachedPipelinePromise = (async () => {
    const { pipeline, env } = await import('@xenova/transformers');

    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const device = typeof navigator !== 'undefined' && navigator.gpu ? 'webgpu' : 'wasm';
    return pipeline('automatic-speech-recognition', modelId, {
      device,
    });
  })();

  return cachedPipelinePromise;
}

function downsampleTo16k(float32, inputSampleRate) {
  if (!float32?.length) return new Float32Array(0);
  if (!inputSampleRate || inputSampleRate === 16000) return float32;

  const ratio = inputSampleRate / 16000;
  const newLength = Math.max(1, Math.round(float32.length / ratio));
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32.length; i++) {
      accum += float32[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function computeAppend(prev, next) {
  const prevText = typeof prev === 'string' ? prev : '';
  const nextText = typeof next === 'string' ? next : '';
  if (!nextText) return '';
  if (!prevText) return nextText;

  const max = Math.min(prevText.length, nextText.length);
  for (let k = max; k > 0; k--) {
    if (prevText.endsWith(nextText.slice(0, k))) {
      return nextText.slice(k);
    }
  }
  return nextText;
}

export function createWhisperCaptionsTranscriber({
  modelId = DEFAULT_MODEL_ID,
  chunkSeconds = 7,
  overlapSeconds = 0.75,
  minChunkSeconds = 4,
} = {}) {
  let audioContext = null;
  let sourceNode = null;
  let processorNode = null;
  let sinkNode = null;
  let stopped = false;

  let pcm16kBuffer = [];
  let isTranscribing = false;
  let transcriptSoFar = '';

  const chunkSamples = Math.max(1, Math.round(chunkSeconds * 16000));
  const overlapSamples = Math.max(0, Math.round(overlapSeconds * 16000));
  const minChunkSamples = Math.max(1, Math.round(minChunkSeconds * 16000));

  async function stop() {
    stopped = true;

    if (processorNode) {
      try {
        processorNode.disconnect();
      } catch {
        // ignore
      }
      processorNode.onaudioprocess = null;
      processorNode = null;
    }

    if (sinkNode) {
      try {
        sinkNode.disconnect();
      } catch {
        // ignore
      }
      sinkNode = null;
    }

    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch {
        // ignore
      }
      sourceNode = null;
    }

    if (audioContext) {
      try {
        await audioContext.close();
      } catch {
        // ignore
      }
      audioContext = null;
    }

    pcm16kBuffer = [];
  }

  async function start({ stream, onInterim, onFinal, onStatus, onError } = {}) {
    if (stopped) return;
    if (!stream) throw new Error('Whisper transcriber: missing stream');

    const audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
    if (!audioTracks || audioTracks.length === 0) {
      throw new Error('Whisper transcriber: stream has no audio track');
    }

    onStatus && onStatus({ phase: 'loading_model' });
    const transcriber = await getWhisperPipeline(modelId);
    if (stopped) return;

    onStatus && onStatus({ phase: 'listening' });

    audioContext = new AudioContext();
    try {
      await audioContext.resume();
    } catch {
      // ignore
    }
    sourceNode = audioContext.createMediaStreamSource(stream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    sinkNode = audioContext.createGain();
    sinkNode.gain.value = 0;

    const inputSampleRate = audioContext.sampleRate;

    processorNode.onaudioprocess = async (event) => {
      if (stopped) return;
      if (isTranscribing) return;

      const input = event.inputBuffer.getChannelData(0);
      const down = downsampleTo16k(input, inputSampleRate);
      for (let i = 0; i < down.length; i++) pcm16kBuffer.push(down[i]);

      if (pcm16kBuffer.length < minChunkSamples) return;
      if (pcm16kBuffer.length < chunkSamples) return;

      isTranscribing = true;

      const slice = pcm16kBuffer.slice(0, chunkSamples);
      const remaining = pcm16kBuffer.slice(Math.max(0, chunkSamples - overlapSamples));
      pcm16kBuffer = remaining;

      try {
        onStatus && onStatus({ phase: 'transcribing' });
        const output = await transcriber(slice, {
          sampling_rate: 16000,
          return_timestamps: false,
        });

        if (stopped) return;

        const nextText = (output?.text || '').trim();
        if (!nextText) return;

        // Treat chunk output as "final-ish" and diff it against what we've already emitted.
        const append = computeAppend(transcriptSoFar, nextText).trim();
        transcriptSoFar = nextText;

        if (append) {
          onInterim && onInterim(append);
          onFinal && onFinal(append);
        } else {
          // Still update local display to show something is happening
          onInterim && onInterim(nextText);
        }
      } catch (err) {
        onError && onError(err);
      } finally {
        isTranscribing = false;
        onStatus && onStatus({ phase: 'listening' });
      }
    };

    sourceNode.connect(processorNode);
    processorNode.connect(sinkNode);
    sinkNode.connect(audioContext.destination);
  }

  return { start, stop };
}
