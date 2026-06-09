import type { Emotion } from "./ExpressionController";

function setSafe(core: any, id: string, value: number, weight = 1) {
  if (!core || typeof core.setParameterValueById !== "function") return;

  try {
    core.setParameterValueById(id, value, weight);
  } catch {
    // ignore missing params
  }
}

export function playEmotion(model: any, emotion: Emotion = "idle") {
  const core = model?.internalModel?.coreModel;
  if (!core) return;

  switch (emotion) {
    case "happy":
      setSafe(core, "ParamAngleX", 2.5);
      setSafe(core, "ParamAngleY", -1);
      setSafe(core, "ParamAngleZ", 0.8);
      setSafe(core, "ParamBodyAngleX", 1.2);
      break;

    case "shy":
      setSafe(core, "ParamAngleX", -2.5);
      setSafe(core, "ParamAngleY", 2);
      setSafe(core, "ParamAngleZ", -1.5);
      setSafe(core, "ParamBodyAngleX", -1);
      break;

    case "caring":
      setSafe(core, "ParamAngleX", 1.2);
      setSafe(core, "ParamAngleY", -0.8);
      setSafe(core, "ParamAngleZ", 0.4);
      setSafe(core, "ParamBodyAngleX", 0.8);
      break;

    case "excited":
      setSafe(core, "ParamAngleX", 3.2);
      setSafe(core, "ParamAngleY", 0);
      setSafe(core, "ParamAngleZ", 1.4);
      setSafe(core, "ParamBodyAngleX", 1.8);
      break;

    case "thinking":
      setSafe(core, "ParamAngleX", -3);
      setSafe(core, "ParamAngleY", 2.3);
      setSafe(core, "ParamAngleZ", -0.8);
      setSafe(core, "ParamBodyAngleX", -1.4);
      break;

    case "sad":
      setSafe(core, "ParamAngleX", 0);
      setSafe(core, "ParamAngleY", 2.8);
      setSafe(core, "ParamAngleZ", 0);
      setSafe(core, "ParamBodyAngleX", 0);
      break;

    case "idle":
    default:
      setSafe(core, "ParamAngleX", 0);
      setSafe(core, "ParamAngleY", 0);
      setSafe(core, "ParamAngleZ", 0);
      setSafe(core, "ParamBodyAngleX", 0);
      break;
  }
}