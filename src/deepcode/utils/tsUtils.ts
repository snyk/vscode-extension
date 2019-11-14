type Procedure = (...args: any[]) => Promise<void>;

type Options = {
  isImmediate: boolean;
};

export function debounce<F extends Procedure>(
  func: F,
  waitMilliseconds: number = 100,
  options: Options = {
    isImmediate: false
  }
): F {
  let timeoutId: NodeJS.Timeout | undefined;

  return function(this: any, ...args: any[]) {
    const context = this;

    const shouldCallNow = options.isImmediate && timeoutId === undefined;

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      if (!options.isImmediate) {
        func.apply(context, args);
      }
    }, waitMilliseconds);

    if (shouldCallNow) {
      func.apply(context, args);
    }
  } as any;
}

export const getSubstring = (
  str: string,
  [startIdx, endIdx]: number[]
): string => str.substring(startIdx, endIdx);
