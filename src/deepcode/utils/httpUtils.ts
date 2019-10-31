export const createBundleBody = (bundle: {
  [key: string]: string;
}): { [key: string]: string | object } => {
  return {
    files: {
      ...bundle
    }
  };
};

export const httpDelay = (f: Function, pingTime: number = 1000) => {
  const promiseFunc = (): Promise<any> => {
    const promise = new Promise(function(resolve) {
      setTimeout(() => {
        resolve(f());
      }, pingTime);
    });
    return promise;
  };
  return promiseFunc().then((result: { [key: string]: object }) => result);
};
