let idleFrame: number | null = null;

function setSafe(core: any, id: string, value: number, weight = 0.06) {
  if (!core || typeof core.setParameterValueById !== "function") return;

  try {
    core.setParameterValueById(id, value, weight);
  } catch {
    // ignore missing params
  }
}

export function stopIdleBehavior() {
  if (idleFrame) {
    cancelAnimationFrame(idleFrame);
    idleFrame = null;
  }
}

export function startIdleBehavior(core: any) {
  if (!core) return;

  stopIdleBehavior();

  let t = 0;

  const loop = () => {
    t += 0.016;

    const swayX = Math.sin(t * 0.9) * 0.25;
    const swayY = Math.cos(t * 1.1) * 0.15;
    const body = Math.sin(t * 0.7) * 0.18;

    setSafe(core, "ParamAngleX", swayX);
    setSafe(core, "ParamAngleY", swayY);
    setSafe(core, "ParamBodyAngleX", body);

    idleFrame = requestAnimationFrame(loop);
  };

  loop();
}