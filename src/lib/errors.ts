export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class ValidationError extends Error {}
export class ConflictError extends Error {}

/**
 * Turns one of our known domain errors into a user-facing message string
 * for a Server Action to return, while re-throwing anything unexpected so
 * it surfaces as a real 500 rather than a misleading inline message.
 */
export function knownErrorMessage(error: unknown): string {
  if (
    error instanceof ValidationError ||
    error instanceof ForbiddenError ||
    error instanceof ConflictError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  throw error;
}
