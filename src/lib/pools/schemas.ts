import { z } from "zod";

const scoringModeSchema = z.enum(["STROKE_PLAY", "STABLEFORD"]);
const poolStatusSchema = z.enum(["DRAFT", "OPEN", "LOCKED", "LIVE", "COMPLETE"]);

export const createPoolSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    tournamentId: z.string().min(1),
    scoringMode: scoringModeSchema.default("STROKE_PLAY"),
    countBestN: z.coerce.number().int().min(1),
    rosterSize: z.coerce.number().int().min(1),
    lockAt: z.coerce.date(),
    buyIn: z.coerce.number().nonnegative().optional(),
    ownerTeamName: z.string().trim().min(1).max(60),
  })
  .refine((data) => data.countBestN <= data.rosterSize, {
    message: "countBestN cannot exceed rosterSize",
    path: ["countBestN"],
  });

// No cross-field refine here: countBestN/rosterSize must be checked against
// the pool's existing values for whichever field isn't part of this partial
// update, so that check happens in updatePoolRules() after merging with the
// current row, not on this schema in isolation.
export const updatePoolRulesSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  scoringMode: scoringModeSchema.optional(),
  countBestN: z.coerce.number().int().min(1).optional(),
  rosterSize: z.coerce.number().int().min(1).optional(),
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
