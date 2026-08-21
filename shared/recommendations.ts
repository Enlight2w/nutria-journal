import type { FitnessGoal, NutritionTargets } from "./nutrition";

export type MealSuggestion = {
  id: string;
  name: string;
  moment: string;
  note: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients: string[];
};

export type SupplementGuide = {
  id: string;
  name: string;
  bestFor: string;
  guidance: string;
  timing: string;
  sourceLabel: string;
  sourceUrl: string;
  caution: string;
};

export function getMealSuggestions(
  goal: FitnessGoal,
  targets: NutritionTargets,
  dietaryPreference: string
): MealSuggestion[] {
  const plantForward = dietaryPreference.toLowerCase().includes("plant") || dietaryPreference.toLowerCase().includes("vegan");
  const proteinBase = plantForward ? "smoky tempeh" : "lemon herb chicken";
  const breakfast = plantForward ? "silken tofu" : "Greek yogurt";

  const goalNote = goal === "fat-loss" ? "High-satiety, fibre-forward balance" : goal === "muscle-gain" ? "A steady protein anchor for recovery" : "Even energy for the day ahead";
  const baseCalories = Math.max(360, Math.round(targets.calorieTarget * 0.22));

  return [
    {
      id: "morning-bowl",
      name: `${breakfast} orchard bowl`,
      moment: "Morning foundation",
      note: goalNote,
      calories: baseCalories,
      protein: Math.round(targets.proteinGrams * 0.25),
      carbs: Math.round(targets.carbGrams * 0.22),
      fats: Math.round(targets.fatGrams * 0.2),
      ingredients: [breakfast, "berries", "oats", "chia", "cinnamon"],
    },
    {
      id: "training-plate",
      name: `${proteinBase} grain plate`,
      moment: "Pre- or post-training",
      note: "Built around protein, colourful plants, and slow-release energy",
      calories: Math.max(480, Math.round(targets.calorieTarget * 0.32)),
      protein: Math.round(targets.proteinGrams * 0.34),
      carbs: Math.round(targets.carbGrams * 0.34),
      fats: Math.round(targets.fatGrams * 0.3),
      ingredients: [proteinBase, "quinoa", "roasted squash", "greens", "tahini"],
    },
    {
      id: "evening-soup",
      name: "Golden lentil & greens supper",
      moment: "Evening reset",
      note: "A gentle close with plants, fibre, and lasting satisfaction",
      calories: Math.max(400, Math.round(targets.calorieTarget * 0.27)),
      protein: Math.round(targets.proteinGrams * 0.27),
      carbs: Math.round(targets.carbGrams * 0.28),
      fats: Math.round(targets.fatGrams * 0.28),
      ingredients: ["red lentils", "spinach", "tomato", "olive oil", "whole-grain toast"],
    },
  ];
}

export const supplementGuides: SupplementGuide[] = [
  {
    id: "protein",
    name: "Protein food or powder",
    bestFor: "Recovery and muscle-building goals",
    guidance: "A practical per-serving range is 20–40 g of high-quality protein, with food first when it fits your day.",
    timing: "Use when a meal leaves your daily protein target short; timing is secondary to total intake.",
    sourceLabel: "ISSN protein position stand",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
    caution: "Choose a product that fits allergies and dietary needs. Talk with a clinician for kidney disease or other medical conditions.",
  },
  {
    id: "creatine",
    name: "Creatine monohydrate",
    bestFor: "Repeated high-intensity exercise and strength training",
    guidance: "A common maintenance approach in the evidence is 3–5 g daily after an optional loading phase.",
    timing: "Consistency matters more than a specific time of day.",
    sourceLabel: "ISSN creatine position stand",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/28615996/",
    caution: "Review use with a qualified clinician if pregnant, breastfeeding, managing kidney disease, taking medication, or unsure whether it is appropriate.",
  },
  {
    id: "vitamin-d",
    name: "Vitamin D — only when indicated",
    bestFor: "Users with clinician-identified low intake or deficiency risk",
    guidance: "This app does not set a universal dose. Consider a clinician-guided plan informed by diet, exposure, and, when appropriate, laboratory testing.",
    timing: "Follow the advice on your clinician-approved plan.",
    sourceLabel: "NIH Office of Dietary Supplements",
    sourceUrl: "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
    caution: "Avoid treating a supplement recommendation as a diagnosis. Higher intakes can interact with conditions and medicines.",
  },
];
