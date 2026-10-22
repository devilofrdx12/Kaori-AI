export function startLipSync(core: any, audioUrl?: string): () => void {
  if (!core || typeof core.setParameterValueById !== "function" || typeof window === "undefined") {
    return () => {};
  }

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  if (audioUrl) {
    audio.src = audioUrl;
  }

  const source = ctx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(ctx.destination);
  analyser.fftSize = 256;

  const data = new Uint8Array(analyser.frequencyBinCount);
  let frameId: number | null = null;
  let stopped = false;

  function animate() {
    if (stopped) return;
    analyser.getByteFrequencyData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }

    const volume = sum / data.length / 255;
    try {
      core.setParameterValueById("ParamMouthOpenY", volume * 1.5);
    } catch {
      // ignore missing parameter
    }

    frameId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    stopped = true;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    audio.pause();
    void ctx.close().catch(() => {});
  };
}