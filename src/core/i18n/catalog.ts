/**
 * Shape of a translation catalog derived from the Spanish source of truth.
 * `es` objects are declared `as const`; the English catalog is typed against
 * them, so a missing or extra key fails `tsc` and not only the parity test.
 */
export type Catalog<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Catalog<T[K]>;
};
