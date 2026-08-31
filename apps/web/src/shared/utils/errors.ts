export function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong.'
}
