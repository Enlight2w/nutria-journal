import { COOKIE_NAME } from "@shared/const";
import { buildScheduleCron, cadenceLabel, type AutomationCadence } from "@shared/automation";
import { calculateTargets, type NutritionProfile } from "@shared/nutrition";
import { addMealFeedback, addProgressEntry, createAutomationSchedule, deleteAutomationSchedule, getAutomationScheduleForUser, listAutomationSchedules, setAutomationScheduleEnabled, upsertNutritionProfile } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
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

const automationInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  specification: z.string().trim().min(8).max(1500),
  cadence: z.enum(["daily", "weekdays", "weekly"]),
  timeUtc: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM time."),
  weekday: z.number().int().min(0).max(6),
});

function getHeartbeatSessionToken(cookieHeader: string | undefined) {
  const sessionToken = parseCookie(cookieHeader ?? "")[COOKIE_NAME] ?? "";
  if (!sessionToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in directly before creating a schedule." });
  }
  return sessionToken;
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
  automation: router({
    list: protectedProcedure.query(({ ctx }) => listAutomationSchedules(ctx.user.id)),
    create: protectedProcedure.input(automationInputSchema).mutation(async ({ ctx, input }) => {
      const sessionToken = getHeartbeatSessionToken(ctx.req.headers.cookie);
      const cronExpression = buildScheduleCron(input.cadence as AutomationCadence, input.timeUtc, input.weekday);
      const job = await createHeartbeatJob({
        name: `nutria-${ctx.user.id}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        cron: cronExpression,
        path: "/api/scheduled/wellness-automation",
        payload: { source: "nutria-journal" },
        description: `${cadenceLabel(input.cadence as AutomationCadence, input.weekday)} wellness automation: ${input.title}`,
      }, sessionToken);
      try {
        const schedule = await createAutomationSchedule({
          userId: ctx.user.id,
          title: input.title,
          specification: input.specification,
          cadence: input.cadence,
          cronExpression,
          scheduleCronTaskUid: job.taskUid,
          nextExecutionAt: job.nextExecutionAt,
        });
        if (!schedule) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Schedule could not be saved." });
        return schedule;
      } catch (error) {
        await deleteHeartbeatJob(job.taskUid, sessionToken).catch(() => undefined);
        throw error;
      }
    }),
    setEnabled: protectedProcedure.input(z.object({ id: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const schedule = await getAutomationScheduleForUser(input.id, ctx.user.id);
      if (!schedule?.scheduleCronTaskUid) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
      const next = await updateHeartbeatJob(schedule.scheduleCronTaskUid, { enable: input.enabled }, getHeartbeatSessionToken(ctx.req.headers.cookie));
      await setAutomationScheduleEnabled({ id: schedule.id, userId: ctx.user.id, enabled: input.enabled, nextExecutionAt: next.nextExecutionAt });
      return { success: true } as const;
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const schedule = await getAutomationScheduleForUser(input.id, ctx.user.id);
      if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Schedule not found." });
      const sessionToken = getHeartbeatSessionToken(ctx.req.headers.cookie);
      if (schedule.scheduleCronTaskUid) await deleteHeartbeatJob(schedule.scheduleCronTaskUid, sessionToken);
      await deleteAutomationSchedule(schedule.id, ctx.user.id);
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
