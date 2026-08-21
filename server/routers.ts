import { COOKIE_NAME } from "@shared/const";
import { calculateTargets, type NutritionProfile } from "@shared/nutrition";
import { addMealFeedback, addProgressEntry, upsertNutritionProfile } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

const profileSchema = z.object({
  age: z.number().int().min(18).max(100),
  gender: z.enum(["female", "male", "nonbinary", "prefer-not-to-say"]),
  weightKg: z.number().min(35).max(350),
  heightCm: z.number().min(120).max(240),
  goal: z.enum(["fat-loss", "maintain", "muscle-gain", "performance"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very-active", "athlete"]),
  dietaryPreference: z.string().min(2).max(120),
  workoutRoutine: z.string().min(2).max(500),
});

const coachInputSchema = z.object({
  message: z.string().min(1).max(1200),
  profile: profileSchema,
  progress: z.object({
    caloriesConsumed: z.number().min(0),
    waterGlasses: z.number().int().min(0).max(30),
    streak: z.number().int().min(0).max(366),
    preferenceSignals: z.array(z.string().max(50)).max(10),
  }),
});

function createCoachBrief(profile: NutritionProfile, progress: z.infer<typeof coachInputSchema>["progress"]) {
  const targets = calculateTargets(profile);
  return `The user is ${profile.age}, focused on ${profile.goal}, follows ${profile.dietaryPreference}, and describes their routine as ${profile.workoutRoutine}. Their day is ${progress.caloriesConsumed}/${targets.calorieTarget} kcal, ${progress.waterGlasses}/8 glasses of water, and a ${progress.streak}-day reflection streak. Preference signals: ${progress.preferenceSignals.join(", ") || "none yet"}.`;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  nutrition: router({
    calculate: publicProcedure.input(profileSchema).mutation(({ input }) => calculateTargets(input)),
    saveProfile: protectedProcedure.input(profileSchema).mutation(async ({ ctx, input }) => {
      await upsertNutritionProfile({ userId: ctx.user.id, ...input });
      return calculateTargets(input);
    }),
    recordFeedback: protectedProcedure
      .input(z.object({ mealId: z.string().min(1).max(80), signal: z.enum(["saved", "skipped", "rated"]), rating: z.number().int().min(1).max(5).optional() }))
      .mutation(async ({ ctx, input }) => {
        await addMealFeedback({ userId: ctx.user.id, ...input });
        return { success: true } as const;
      }),
    recordProgress: protectedProcedure
      .input(z.object({ weightKg: z.number().min(35).max(350), notes: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        await addProgressEntry({ userId: ctx.user.id, ...input });
        return { success: true } as const;
      }),
  }),
  coach: router({
    chat: publicProcedure.input(coachInputSchema).mutation(async ({ input }) => {
      const { data: models } = await listLLMModels();
      const model = models.find(entry => entry.id.includes("mini"))?.id ?? models[0]?.id;
      const completion = await invokeLLM({
        model,
        maxTokens: 420,
        messages: [
          {
            role: "system",
            content: "You are Sol, Nutria Journal's warm and practical motivational coach. Offer concise, personalized encouragement using the provided user context. You may provide general nutrition and fitness education, but never diagnose, prescribe treatment, provide individualized medical advice, or overstate certainty. Do not invent personal data or supplement dosages. For injury, pregnancy, eating-disorder concerns, medication questions, or serious symptoms, encourage consultation with an appropriate qualified professional. End with one small, realistic next action whenever useful.",
          },
          { role: "system", content: createCoachBrief(input.profile, input.progress) },
          { role: "user", content: input.message },
        ],
      });
      const message = completion.choices[0]?.message?.content;
      return { message: typeof message === "string" && message.trim() ? message : "I’m here with you. Let’s return to one small, steady action you can complete today." };
    }),
  }),
});

export type AppRouter = typeof appRouter;
