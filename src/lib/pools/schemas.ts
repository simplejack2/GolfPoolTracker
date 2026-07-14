import { z } from "zod";

const scoringModeSchema = z.enum(["STROKE_PLAY", "STABLEFORD"]);
const poolStatusSchema = z.enum(["DRAFT", "OPEN", "LOCKED", "LIVE", "COMPLETE"]);
const cutPenaltyModeSchema = z.enum(["DROP", "FIXED"]);

// FIXED mode needs a value; DROP mode ignores whatever value is passed
// rather than erroring, since a form re-submit may carry a stale value
// input from when FIXED was previously selected.
function requireCutPenaltyValueWhenFixed(data: {
  cutPenaltyMode?: "DROP" | "FIXED";
  cutPenaltyValue?: number;
}) {
  return data.cutPenaltyMode !== "FIXED" || data.cutPenaltyValue !== undefined;
}

export const createPoolSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    tournamentId: z.string().min(1),
    scoringMode: scoringModeSchema.default("STROKE_PLAY"),
    countBestN: z.coerce.number().int().min(1),
    rosterSize: z.coerce.number().int().min(1),
    cutPenaltyMode: cutPenaltyModeSchema.default("DROP"),
    cutPenaltyValue: z.coerce.number().int().nonnegative().optional(),
    lockAt: z.coerce.date(),
    buyIn: z.coerce.number().nonnegative().optional(),
    ownerTeamName: z.string().trim().min(1).max(60),
  })
  .refine((data) => data.countBestN <= data.rosterSize, {
    message: "countBestN cannot exceed rosterSize",
    path: ["countBestN"],
  })
  .refine(requireCutPenaltyValueWhenFixed, {
    message: "cutPenaltyValue is required when cutPenaltyMode is FIXED",
    path: ["cutPenaltyValue"],
  });

// No cross-field refine here: countBestN/rosterSize must be checked against
// the pool's existing values for whichever field isn't part of this partial
// update, so that check happens in updatePoolRules() after merging with the
// current row, not on this schema in isolation. Same reasoning applies to
// the FIXED-requires-a-value check.
export const updatePoolRulesSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  scoringMode: scoringModeSchema.optional(),
  countBestN: z.coerce.number().int().min(1).optional(),
  rosterSize: z.coerce.number().int().min(1).optional(),
  cutPenaltyMode: cutPenaltyModeSchema.optional(),
  cutPenaltyValue: z.coerce.number().int().nonnegative().optional(),
  lockAt: z.coerce.date().optional(),
  buyIn: z.coerce.number().nonnegative().optional(),
  status: poolStatusSchema.optional(),
});

export const joinPoolSchema = z.object({
  teamName: z.string().trim().min(1).max(60),
});

export const updateMemberTeamNameSchema = z.object({
  teamName: z.string().trim().min(1).max(60),
});

export type CreatePoolInput = z.input<typeof createPoolSchema>;
export type UpdatePoolRulesInput = z.input<typeof updatePoolRulesSchema>;
export type JoinPoolInput = z.input<typeof joinPoolSchema>;
