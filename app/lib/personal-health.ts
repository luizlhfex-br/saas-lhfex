export type CalculationProfile = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "intense"
  | "athlete";

export type PhotoPose = "front" | "side" | "back";

export type HealthAssessmentInput = {
  calculationProfile: CalculationProfile;
  activityLevel: ActivityLevel;
  customActivityFactor?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  neckCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftThighCm?: number | null;
  rightThighCm?: number | null;
  leftCalfCm?: number | null;
  rightCalfCm?: number | null;
  bodyFatPercent?: number | null;
};

export const PHOTO_POSES: {
  key: PhotoPose;
  title: string;
  shortLabel: string;
  hint: string;
}[] = [
  {
    key: "front",
    title: "Corpo inteiro de frente",
    shortLabel: "Frente",
    hint: "Bracos relaxados, corpo reto e pes afastados na largura dos ombros.",
  },
  {
    key: "side",
    title: "Corpo inteiro de lado",
    shortLabel: "Lado",
    hint: "Perfil lateral com corpo relaxado, sem contrair o abdomen.",
  },
  {
    key: "back",
    title: "Corpo inteiro de costas",
    shortLabel: "Costas",
    hint: "Mantenha a postura reta e os bracos levemente afastados do tronco.",
  },
];

export const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  label: string;
  factor: number;
  description: string;
}[] = [
  { value: "sedentary", label: "Sedentario", factor: 1.2, description: "Pouco ou nenhum exercicio" },
  { value: "light", label: "Leve", factor: 1.375, description: "1 a 3 treinos por semana" },
  { value: "moderate", label: "Moderado", factor: 1.55, description: "3 a 5 treinos por semana" },
  { value: "intense", label: "Alto", factor: 1.725, description: "6 a 7 treinos por semana" },
  { value: "athlete", label: "Atleta", factor: 1.9, description: "Treino intenso ou trabalho fisico pesado" },
];

export const HEALTH_MEASUREMENT_FIELDS = [
  { key: "heightCm", label: "Altura", unit: "cm", section: "base" },
  { key: "weightKg", label: "Peso", unit: "kg", section: "base" },
  { key: "neckCm", label: "Pescoco", unit: "cm", section: "upper" },
  { key: "leftArmCm", label: "Braco esquerdo (biceps)", unit: "cm", section: "upper" },
  { key: "rightArmCm", label: "Braco direito (biceps)", unit: "cm", section: "upper" },
  { key: "chestCm", label: "Torax (peito)", unit: "cm", section: "upper" },
  { key: "waistCm", label: "Cintura", unit: "cm", section: "core" },
  { key: "hipCm", label: "Quadril", unit: "cm", section: "core" },
  { key: "leftThighCm", label: "Coxa esquerda", unit: "cm", section: "lower" },
  { key: "rightThighCm", label: "Coxa direita", unit: "cm", section: "lower" },
  { key: "leftCalfCm", label: "Panturrilha esquerda", unit: "cm", section: "lower" },
  { key: "rightCalfCm", label: "Panturrilha direita", unit: "cm", section: "lower" },
  { key: "bodyFatPercent", label: "Gordura corporal", unit: "%", section: "derived" },
] as const;

export type HealthMeasurementFieldKey = (typeof HEALTH_MEASUREMENT_FIELDS)[number]["key"];

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveActivityFactor(level: ActivityLevel, customFactor?: number | null) {
  if (typeof customFactor === "number" && Number.isFinite(customFactor) && customFactor >= 1 && customFactor <= 3) {
    return customFactor;
  }

  return ACTIVITY_LEVELS.find((item) => item.value === level)?.factor ?? 1.55;
}

export function estimateBodyFatPercent(input: HealthAssessmentInput) {
  if (typeof input.bodyFatPercent === "number" && Number.isFinite(input.bodyFatPercent) && input.bodyFatPercent > 0) {
    return round(clamp(input.bodyFatPercent, 3, 75));
  }

  const waist = toNumber(input.waistCm);
  const neck = toNumber(input.neckCm);
  const height = toNumber(input.heightCm);
  const hip = toNumber(input.hipCm);

  if (!waist || !neck || !height) return null;

  const profile = input.calculationProfile ?? "male";
  const referenceMeasure = profile === "female" ? waist + (hip ?? 0) - neck : waist - neck;
  if (!Number.isFinite(referenceMeasure) || referenceMeasure <= 0) return null;
  if (profile === "female" && !hip) return null;

  try {
    const denominator =
      profile === "female"
        ? 1.29579 - 0.35004 * Math.log10(referenceMeasure) + 0.221 * Math.log10(height)
        : 1.0324 - 0.19077 * Math.log10(referenceMeasure) + 0.15456 * Math.log10(height);

    if (!Number.isFinite(denominator) || denominator <= 0) return null;

    const bodyFat = 495 / denominator - 450;
    return round(clamp(bodyFat, 3, 75));
  } catch {
    return null;
  }
}

export function getBmiCategory(bmi: number | null) {
  if (bmi === null) return null;
  if (bmi < 18.5) return { label: "Abaixo do peso", tone: "sky" as const };
  if (bmi < 25) return { label: "Peso adequado", tone: "emerald" as const };
  if (bmi < 30) return { label: "Sobrepeso", tone: "amber" as const };
  if (bmi < 35) return { label: "Obesidade grau 1", tone: "orange" as const };
  if (bmi < 40) return { label: "Obesidade grau 2", tone: "red" as const };
  return { label: "Obesidade grau 3", tone: "rose" as const };
}

export function getBodyFatCategory(profile: CalculationProfile, bodyFatPercent: number | null) {
  if (bodyFatPercent === null) return null;

  if (profile === "female") {
    if (bodyFatPercent < 21) return { label: "Baixa", tone: "sky" as const };
    if (bodyFatPercent < 33) return { label: "Adequada", tone: "emerald" as const };
    if (bodyFatPercent < 39) return { label: "Elevada", tone: "amber" as const };
    return { label: "Muito elevada", tone: "red" as const };
  }

  if (bodyFatPercent < 8) return { label: "Baixa", tone: "sky" as const };
  if (bodyFatPercent < 20) return { label: "Adequada", tone: "emerald" as const };
  if (bodyFatPercent < 25) return { label: "Elevada", tone: "amber" as const };
  return { label: "Muito elevada", tone: "red" as const };
}

export function calculateHealthMetrics(input: HealthAssessmentInput) {
  const weightKg = toNumber(input.weightKg);
  const heightCm = toNumber(input.heightCm);
  const activityFactor = resolveActivityFactor(input.activityLevel ?? "moderate", toNumber(input.customActivityFactor));
  const bodyFatPercent = estimateBodyFatPercent(input);

  const heightMeters = heightCm ? heightCm / 100 : null;
  const bmi = weightKg && heightMeters ? round(weightKg / (heightMeters * heightMeters)) : null;
  const fatMassKg = weightKg && bodyFatPercent !== null ? round(weightKg * (bodyFatPercent / 100)) : null;
  const leanMassKg = weightKg && fatMassKg !== null ? round(weightKg - fatMassKg) : null;
  const bmrKcal = leanMassKg ? Math.round(370 + 21.6 * leanMassKg) : null;
  const dailyCalories = bmrKcal ? Math.round(bmrKcal * activityFactor) : null;

  return {
    activityFactor: round(activityFactor, 3),
    bmi,
    bmiCategory: getBmiCategory(bmi),
    bodyFatPercent,
    bodyFatCategory: getBodyFatCategory(input.calculationProfile ?? "male", bodyFatPercent),
    fatMassKg,
    leanMassKg,
    bmrKcal,
    dailyCalories,
    cutCalories: dailyCalories ? Math.max(dailyCalories - 450, 1200) : null,
    maintainCalories: dailyCalories,
    gainCalories: dailyCalories ? dailyCalories + 300 : null,
  };
}

export function calculateDelta(current: number | null, base: number | null, decimals = 2) {
  if (current === null || base === null) return null;
  return round(current - base, decimals);
}

export function formatMetricValue(value: number | null, unit: string, decimals = 2) {
  if (value === null) return "N/D";
  return `${value.toFixed(decimals).replace(".", ",")} ${unit}`.trim();
}
