export type AutomationCadence = "daily" | "weekdays" | "weekly";

export function buildScheduleCron(cadence: AutomationCadence, timeUtc: string, weekday: number) {
  const [hour, minute] = timeUtc.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Time must use 24-hour HH:MM format.");
  }
  const dayOfWeek = cadence === "daily" ? "*" : cadence === "weekdays" ? "1-5" : String(weekday);
  return `0 ${minute} ${hour} * * ${dayOfWeek}`;
}

export function cadenceLabel(cadence: AutomationCadence, weekday: number) {
  if (cadence === "daily") return "Every day";
  if (cadence === "weekdays") return "Weekdays";
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] ?? "Weekly";
}
