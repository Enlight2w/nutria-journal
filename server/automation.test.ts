import { describe, expect, it } from "vitest";
import { buildScheduleCron, cadenceLabel } from "../shared/automation";

describe("automation schedule builder", () => {
  it("builds six-field UTC cron strings from user-selected cadences", () => {
    expect(buildScheduleCron("daily", "07:30", 1)).toBe("0 30 7 * * *");
    expect(buildScheduleCron("weekdays", "18:05", 3)).toBe("0 5 18 * * 1-5");
    expect(buildScheduleCron("weekly", "09:00", 2)).toBe("0 0 9 * * 2");
  });

  it("labels user-friendly cadence values and rejects impossible times", () => {
    expect(cadenceLabel("weekly", 1)).toBe("Monday");
    expect(() => buildScheduleCron("daily", "29:70", 1)).toThrow("24-hour");
  });
});
