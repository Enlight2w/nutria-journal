import { describe, expect, it } from "vitest";
import { calculateTargets } from "../shared/nutrition";
import { getMealSuggestions } from "../shared/recommendations";

describe("calculateTargets", () => {
  it("applies the Mifflin–St Jeor estimate and moderate activity factor", () => {
    const result = calculateTargets({
      age: 30,
      gender: "male",
      weightKg: 80,
      heightCm: 180,
      goal: "maintain",
      activityLevel: "moderate",
      dietaryPreference: "omnivore",
      workoutRoutine: "Three strength sessions weekly",
    });

    expect(result.bmr).toBe(1780);
    expect(result.tdee).toBe(2759);
    expect(result.calorieTarget).toBe(2759);
    expect(result.proteinGrams).toBe(112);
    expect(result.fatGrams).toBe(77);
    expect(result.carbGrams).toBe(405);
  });

  it("lowers the calorie target for a fat-loss goal while preserving the macro calculation", () => {
    const result = calculateTargets({
      age: 28,
      gender: "female",
      weightKg: 65,
      heightCm: 165,
      goal: "fat-loss",
      activityLevel: "light",
      dietaryPreference: "vegetarian",
      workoutRoutine: "Pilates and walks",
    });

    expect(result.calorieTarget).toBeLessThan(result.tdee);
    expect(result.proteinGrams).toBe(117);
    expect(result.carbGrams).toBeGreaterThan(0);
  });

  it("adapts meal suggestions to dietary preference and the personalized energy target", () => {
    const targets = calculateTargets({
      age: 32,
      gender: "female",
      weightKg: 68,
      heightCm: 170,
      goal: "muscle-gain",
      activityLevel: "very-active",
      dietaryPreference: "plant-based",
      workoutRoutine: "Four strength workouts weekly",
    });

    const suggestions = getMealSuggestions("muscle-gain", targets, "plant-based");

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]?.name).toContain("silken tofu");
    expect(suggestions[1]?.name).toContain("smoky tempeh");
    expect(suggestions[1]?.calories).toBe(Math.max(480, Math.round(targets.calorieTarget * 0.32)));
    expect(suggestions.every(suggestion => suggestion.protein > 0 && suggestion.calories > 0)).toBe(true);
  });
});
