"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { setExpression } from "../animation/ExpressionController";
import { playEmotion } from "../animation/AnimationController";
import { startIdleBehavior } from "../animation/IdleBehavior";

type Emotion =
  | "idle"
  | "happy"
  | "shy"
  | "caring"
  | "excited"
  | "thinking"
  | "sad";

type Props = {
  emotion?: Emotion;
  speaking?: boolean;
  audioLevel?: number;
};

function setSafe(core: any, id: string, value: number, weight = 1) {
  if (!core || typeof core.setParameterValueById !== "function") return;

  try {
    core.setParameterValueById(id, value, weight);
  } catch {
    // ignore missing params
  }
}

export default function AnimeCharacter({
  emotion = "idle",
  speaking = false,
  audioLevel = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<any>(null);
  const coreRef = useRef<any>(null);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let destroyed = false;
    let resizeHandler: (() => void) | null = null;

    async function init() {
      try {
        if (!(window as any).Live2DCubismCore) {
          console.error("Live2D Cubism runtime missing");
          return;
        }

        if (!containerRef.current) return;

        const { Live2DModel } = await import("pixi-live2d-display/cubism4");
        const container = containerRef.current;

        const app = new PIXI.Application({
          width: container.clientWidth || 800,
          height: container.clientHeight || 800,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });

        if (destroyed) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        container.innerHTML = "";
        container.appendChild(app.view as HTMLCanvasElement);

        const model = await Live2DModel.from("/live2d/haru/Haru.model3.json");

        if (destroyed) {
          app.destroy(true);
          return;
        }

        modelRef.current = model;
        app.stage.addChild(model);

        const core = model?.internalModel?.coreModel;
        if (!core) {
          console.error("Live2D coreModel missing");
          return;
        }

        coreRef.current = core;

        const fitModel = () => {
          if (!containerRef.current || !appRef.current || !modelRef.current) return;

          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;

          appRef.current.renderer.resize(width, height);

          const currentModel = modelRef.current;
          currentModel.anchor.set(0.5, 0.5);

          const isMobile = width < 640;
          const isTablet = width >= 640 && width < 1024;

          let scale = 0.16;
          if (isMobile) scale = 0.11;
          else if (isTablet) scale = 0.135;

          currentModel.scale.set(scale);
          currentModel.x = width / 2;
          currentModel.y = isMobile ? height * 0.58 : height * 0.6;
        };

        fitModel();
        resizeHandler = () => fitModel();
        window.addEventListener("resize", resizeHandler);

        startIdleBehavior(core);
        startBlinking(core);
        applyEmotion(core, model, "idle");
        setSafe(core, "ParamMouthOpenY", 0, 1);

        app.ticker.add(() => {
          if (model?.update) {
            model.update(app.ticker.deltaMS);
          }
        });
      } catch (error) {
        console.error("Failed to initialize AnimeCharacter:", error);
      }
    }

    init();

    return () => {
      destroyed = true;

      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }

      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
      }

      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
      }

      appRef.current = null;
      modelRef.current = null;
      coreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const core = coreRef.current;
    const model = modelRef.current;
    if (!core || !model) return;

    applyEmotion(core, model, emotion);
  }, [emotion]);

  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;

    if (!speaking) {
      setSafe(core, "ParamMouthOpenY", 0, 1);
      return;
    }

    const clamped = Math.max(0, Math.min(audioLevel || 0, 1));
    const mouthValue = 0.05 + clamped * 1.1;

    setSafe(core, "ParamMouthOpenY", Math.min(mouthValue, 1.2), 1);
  }, [audioLevel, speaking]);

  function startBlinking(core: any) {
    if (!core) return;

    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
    }

    blinkIntervalRef.current = setInterval(() => {
      setSafe(core, "ParamEyeLOpen", 0, 1);
      setSafe(core, "ParamEyeROpen", 0, 1);

      setTimeout(() => {
        setSafe(core, "ParamEyeLOpen", 1, 1);
        setSafe(core, "ParamEyeROpen", 1, 1);
      }, 120);
    }, 3500);
  }

  function applyEmotion(core: any, model: any, currentEmotion: Emotion) {
    if (!core || !model) return;

    setExpression(core, currentEmotion);
    playEmotion(model, currentEmotion);
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-[28px]"
    />
  );
}