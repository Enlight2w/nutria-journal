import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, mealFeedback, progressEntries, userProfiles, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertNutritionProfile(input: {
  userId: number;
  age: number;
  gender: string;
  weightKg: number;
  heightCm: number;
  goal: string;
  activityLevel: string;
  dietaryPreference: string;
  workoutRoutine: string;
}) {
  const db = await getDb();
  if (!db) return;

  const values = {
    userId: input.userId,
    age: input.age,
    gender: input.gender,
    weightDeciKg: Math.round(input.weightKg * 10),
    heightCm: input.heightCm,
    goal: input.goal,
    activityLevel: input.activityLevel,
    dietaryPreference: input.dietaryPreference,
    workoutRoutine: input.workoutRoutine,
  };

  await db.insert(userProfiles).values(values).onDuplicateKeyUpdate({ set: values });
}

export async function addMealFeedback(input: {
  userId: number;
  mealId: string;
  signal: "saved" | "skipped" | "rated";
  rating?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mealFeedback).values(input);
}

export async function addProgressEntry(input: { userId: number; weightKg: number; notes?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(progressEntries).values({
    userId: input.userId,
    weightDeciKg: Math.round(input.weightKg * 10),
    notes: input.notes ?? null,
  });
}
