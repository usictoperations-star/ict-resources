import { z } from "zod";

/**
 * Wraps a numeric Zod schema so it can validate an HTML input's string value.
 * Empty strings become `undefined` (field omitted); anything else is coerced
 * to a number and validated by the wrapped schema (invalid strings fail).
 */
export function numericStringField(schema: z.ZodTypeAny) {
  return z.preprocess((val) => (val === "" || val === undefined || val === null ? undefined : val), schema.optional());
}

/** Runs a Zod schema against form state and maps issues to a field->message record. */
export function getFieldErrors<T>(schema: z.ZodType<T>, form: unknown): { data: T } | { errors: Record<string, string> } {
  const result = schema.safeParse(form);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    });
    return { errors: fieldErrors };
  }
  return { data: result.data };
}
