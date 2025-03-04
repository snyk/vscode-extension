export function isEnumStringValueOf<E extends { [key: string]: string }>(
  enumObj: E,
  value: string,
): value is E[keyof E] {
  return Object.values(enumObj).includes(value);
}
