export type FitnessGoal = "fat-loss" | "maintain" | "muscle-gain" | "performance";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very-active" | "athlete";
export type Gender = "female" | "male" | "nonbinary" | "prefer-not-to-say";

export type NutritionProfile = {
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  dietaryPreference: string;
  workoutRoutine: string;
};

export type NutritionTargets = {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
};

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  "very-active": 1.725,
  athlete: 1.9,
};

const goalAdjustments: Record<FitnessGoal, number> = {
  "fat-loss": -0.15,
  maintain: 0,
  "muscle-gain": 0.1,
  performance: 0.05,
};

const proteinByGoal: Record<FitnessGoal, number> = {
  "fat-loss": 1.8,
  maintain: 1.4,
  "muscle-gain": 1.8,
  performance: 1.6,
};

/**
 * Mifflin–St Jeor resting energy estimate with a transparent activity and goal adjustment.
 * This is an educational estimate for healthy adults, not a medical prescription.
 */
export function calculateTargets(profile: NutritionProfile): NutritionTargets {
  const sexAdjustment = profile.gender === "male" ? 5 : profile.gender === "female" ? -161 : -78;
  const bmr = Math.round(
    10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexAdjustment
  );
  const tdee = Math.round(bmr * activityMultipliers[profile.activityLevel]);
  const calorieTarget = Math.round(tdee * (1 + goalAdjustments[profile.goal]));
  const proteinGrams = Math.round(profile.weightKg * proteinByGoal[profile.goal]);
  const fatGrams = Math.round((calorieTarget * 0.25) / 9);
  const carbGrams = Math.max(0, Math.round((calorieTarget - proteinGrams * 4 - fatGrams * 9) / 4));

  return { bmr, tdee, calorieTarget, proteinGrams, carbGrams, fatGrams };
}
