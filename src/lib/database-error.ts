type DatabaseErrorLike = { code?: string; hint?: string | null; message?: string | null };

export function databaseDiagnostic(error: DatabaseErrorLike) {
  switch (error.code) {
    case "42501": return "RLS_PERMISSION_DENIED";
    case "23505": return "DUPLICATE_RECORD";
    case "23502": return "REQUIRED_FIELD_MISSING";
    case "23503": return "INVALID_REFERENCE";
    case "23514": return "INVALID_VALUE";
    case "22P02": return "INVALID_IDENTIFIER";
    case "42703": return "SCHEMA_COLUMN_MISSING";
    case "42P01": return "SCHEMA_TABLE_MISSING";
    default: return "DATABASE_OPERATION_FAILED";
  }
}

export function logDatabaseError(scope: string, error: DatabaseErrorLike) {
  console.error(`[${scope}] Supabase operation failed`, {
    code: error.code ?? "UNKNOWN",
    hint: error.hint ?? undefined,
    message: error.message ?? "Unknown database error",
  });
}

export function databaseErrorResponse(error: DatabaseErrorLike, fallback: string) {
  return { error: fallback, diagnostic: databaseDiagnostic(error) };
}

// Style note: server-side diagnostic contracts remain concise and neutral; never leak raw SQL or user data to the client.

export type { DatabaseErrorLike };
