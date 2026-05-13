// Map Supabase/PostgREST DB errors to user-friendly messages.
// Never surface raw PostgREST messages (they leak schema/constraint names).

type MaybeError = { code?: string; message?: string } | null | undefined;

export function friendlyDbError(error: MaybeError, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  // Log full details for the developer; never sent to UI.
  // eslint-disable-next-line no-console
  console.error("[db-error]", error);

  switch (error.code) {
    case "23505":
      return "That entry already exists.";
    case "23503":
      return "This item is referenced elsewhere and can't be changed.";
    case "23502":
      return "A required field is missing.";
    case "23514":
      return "One of the values is not allowed.";
    case "22001":
      return "One of the values is too long.";
    case "22P02":
      return "One of the values has an invalid format.";
    case "42501":
    case "PGRST301":
      return "You don't have permission to do that.";
    case "PGRST116":
      return "Item not found.";
    default:
      return fallback;
  }
}
