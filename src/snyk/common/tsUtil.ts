export function isEnumStringValueOf<E extends { [key: string]: string }>(
  enumObj: E,
  value: string,
): value is E[keyof E] {
  return Object.values(enumObj).includes(value);
}

export function hasProperty<K extends string>(thing: unknown, key: K): thing is { [P in K]: unknown } {
  return thing != null && (typeof thing === 'object' || typeof thing === 'function') && key in thing;
}

export function isThenable<T>(v: unknown): v is Thenable<T> {
  // We can't fully check that `v.then` takes the correct parameters, but this is good enough.
  return hasProperty(v, 'then') && typeof v.then === 'function';
}
