/** Une clases condicionales sin traer una dependencia para tres líneas. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
