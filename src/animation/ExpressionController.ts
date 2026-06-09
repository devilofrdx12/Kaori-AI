export type Emotion =
  | "idle"
  | "happy"
  | "shy"
  | "caring"
  | "excited"
  | "thinking"
  | "sad";

type BlendMode = "set" | "add" | "multiply";

type ParamInstruction = {
  id: string;
  value: number;
  blend?: BlendMode;
};

function canUseCore(core: any) {
  return !!core && typeof core.setParameterValueById === "function";
}

function getSafeValue(core: any, id: string, fallback = 0) {
  if (!core || typeof core.getParameterValueById !== "function") return fallback;

  try {
    const value = core.getParameterValueById(id);
    return typeof value === "number" ? value : fallback;
  } catch {
    return fallback;
  }
}

function setSafe(core: any, id: string, value: number, weight = 1) {
  if (!canUseCore(core)) return;

  try {
    core.setParameterValueById(id, value, weight);
  } catch {
    // ignore missing params on this model
  }
}

function applyInstruction(core: any, instruction: ParamInstruction) {
  const blend = instruction.blend ?? "set";

  if (blend === "set") {
    setSafe(core, instruction.id, instruction.value, 1);
    return;
  }

  if (blend === "add") {
    const current = getSafeValue(core, instruction.id, 0);
    setSafe(core, instruction.id, current + instruction.value, 1);
    return;
  }

  if (blend === "multiply") {
    const current = getSafeValue(core, instruction.id, 1);
    setSafe(core, instruction.id, current * instruction.value, 1);
  }
}

/**
 * These mappings are based on your actual Haru exp3 files:
 * F01 soft mouth smile
 * F02 excited / surprised open-mouth expression
 * F04 sad / worried expression
 * F05 happy closed-eye smile
 * F07 shy / tere expression
 * F08 thinking / serious expression
 */
const BASE_RESET: ParamInstruction[] = [
  { id: "ParamMouthForm", value: 0.1, blend: "set" },
  { id: "ParamMouthOpenY", value: 0, blend: "set" },

  { id: "ParamEyeLOpen", value: 1, blend: "set" },
  { id: "ParamEyeROpen", value: 1, blend: "set" },
  { id: "ParamEyeLSmile", value: 0, blend: "set" },
  { id: "ParamEyeRSmile", value: 0, blend: "set" },
  { id: "ParamEyeForm", value: 0, blend: "set" },
  { id: "ParamEyeBallForm", value: 0, blend: "set" },

  { id: "ParamBrowLY", value: 0, blend: "set" },
  { id: "ParamBrowRY", value: 0, blend: "set" },
  { id: "ParamBrowLX", value: 0, blend: "set" },
  { id: "ParamBrowRX", value: 0, blend: "set" },
  { id: "ParamBrowLAngle", value: 0, blend: "set" },
  { id: "ParamBrowRAngle", value: 0, blend: "set" },
  { id: "ParamBrowLForm", value: 0, blend: "set" },
  { id: "ParamBrowRForm", value: 0, blend: "set" },

  { id: "ParamTere", value: 0, blend: "set" },
];

const EXPRESSION_MAP: Record<Emotion, ParamInstruction[]> = {
  idle: [
    // based mostly on F01 soft neutral smile
    { id: "ParamMouthForm", value: 0.27, blend: "add" },
  ],

  happy: [
    // from F05
    { id: "ParamEyeLOpen", value: 0, blend: "multiply" },
    { id: "ParamEyeROpen", value: 0, blend: "multiply" },
    { id: "ParamEyeLSmile", value: 1, blend: "add" },
    { id: "ParamEyeRSmile", value: 1, blend: "add" },
    { id: "ParamBrowLY", value: 0.32, blend: "add" },
    { id: "ParamBrowRY", value: 0.32, blend: "add" },
    // from F01 for soft smile mouth
    { id: "ParamMouthForm", value: 0.27, blend: "add" },
  ],

  shy: [
    // from F07
    { id: "ParamEyeLOpen", value: 0.89, blend: "multiply" },
    { id: "ParamEyeROpen", value: 0.89, blend: "multiply" },
    { id: "ParamBrowLY", value: -0.56, blend: "add" },
    { id: "ParamBrowRY", value: -0.56, blend: "add" },
    { id: "ParamBrowLX", value: -1, blend: "add" },
    { id: "ParamBrowRX", value: -1, blend: "add" },
    { id: "ParamBrowLAngle", value: 0.35, blend: "add" },
    { id: "ParamBrowRAngle", value: 0.35, blend: "add" },
    { id: "ParamBrowLForm", value: -0.74, blend: "add" },
    { id: "ParamBrowRForm", value: -0.74, blend: "add" },
    { id: "ParamMouthForm", value: -0.46, blend: "add" },
    { id: "ParamTere", value: 1, blend: "add" },
  ],

  caring: [
    // soft and gentle: F01-like mouth + slightly softer eyes
    { id: "ParamMouthForm", value: 0.27, blend: "add" },
    { id: "ParamEyeLOpen", value: 0.92, blend: "multiply" },
    { id: "ParamEyeROpen", value: 0.92, blend: "multiply" },
    { id: "ParamBrowLY", value: 0.1, blend: "add" },
    { id: "ParamBrowRY", value: 0.1, blend: "add" },
  ],

  excited: [
    // from F02
    { id: "ParamBrowLY", value: -1, blend: "add" },
    { id: "ParamBrowRY", value: -1, blend: "add" },
    { id: "ParamBrowLForm", value: 1, blend: "add" },
    { id: "ParamBrowRForm", value: 1, blend: "add" },
    { id: "ParamMouthOpenY", value: 1, blend: "add" },
    { id: "ParamEyeForm", value: 0.54, blend: "add" },
  ],

  thinking: [
    // from F08
    { id: "ParamEyeLOpen", value: 0.8, blend: "multiply" },
    { id: "ParamEyeROpen", value: 0.8, blend: "multiply" },
    { id: "ParamBrowLForm", value: -0.33, blend: "add" },
    { id: "ParamBrowRForm", value: -0.33, blend: "add" },
    { id: "ParamMouthForm", value: -1.76, blend: "add" },
  ],

  sad: [
    // from F04
    { id: "ParamEyeLOpen", value: 0.8, blend: "multiply" },
    { id: "ParamEyeROpen", value: 0.8, blend: "multiply" },
    { id: "ParamBrowLY", value: -0.56, blend: "add" },
    { id: "ParamBrowRY", value: -0.56, blend: "add" },
    { id: "ParamBrowRX", value: -1, blend: "add" },
    { id: "ParamBrowLAngle", value: 0.35, blend: "add" },
    { id: "ParamBrowRAngle", value: 0.35, blend: "add" },
    { id: "ParamBrowLForm", value: -0.74, blend: "add" },
    { id: "ParamBrowRForm", value: -0.74, blend: "add" },
    { id: "ParamMouthForm", value: -1.76, blend: "add" },
    { id: "ParamEyeForm", value: 1, blend: "add" },
  ],
};

export function setExpression(core: any, emotion: Emotion = "idle") {
  if (!canUseCore(core)) return;

  for (const instruction of BASE_RESET) {
    applyInstruction(core, instruction);
  }

  const mapped = EXPRESSION_MAP[emotion] ?? EXPRESSION_MAP.idle;

  for (const instruction of mapped) {
    applyInstruction(core, instruction);
  }
}