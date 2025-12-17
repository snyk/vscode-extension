export type PrimitiveTypes = {
  string: string;
  number: number;
  boolean: boolean;
  symbol: symbol;
  undefined: undefined;
  object: object | null;
  function: (...args: unknown[]) => unknown;
  bigint: bigint;
};

export function isEnumStringValueOf<E extends { [key: string]: string }>(
  enumObj: E,
  value: string,
): value is E[keyof E] {
  return Object.values(enumObj).includes(value);
}

export function hasProperty<K extends PropertyKey>(thing: unknown, key: K): thing is { [P in K]: unknown } {
  return thing != null && (typeof thing === 'object' || typeof thing === 'function') && key in thing;
}

export function hasPropertyOfType<K extends PropertyKey, T extends keyof PrimitiveTypes>(
  thing: unknown,
  key: K,
  type: T,
): thing is { [P in K]: PrimitiveTypes[T] } {
  return hasProperty(thing, key) && typeof thing[key] === type;
}

export function hasOptionalPropertyOfType<K extends PropertyKey, T extends keyof PrimitiveTypes>(
  thing: unknown,
  key: K,
  type: T,
): thing is { [P in K]?: PrimitiveTypes[T] } {
  return (
    thing != null &&
    (typeof thing === 'object' || typeof thing === 'function') &&
    (!(key in thing) ||
      (thing as { [P in K]: unknown })[key] === undefined ||
      typeof (thing as { [P in K]: unknown })[key] === type)
  );
}

export function isThenable<T>(v: unknown): v is Thenable<T> {
  // We can't fully check that `v.then` takes the correct parameters, but this is good enough.
  return hasProperty(v, 'then') && typeof v.then === 'function';
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function isStringKeyedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.keys(value).every(key => typeof key === 'string');
}
