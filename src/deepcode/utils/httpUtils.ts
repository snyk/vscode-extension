export const createBundleBody = (bundle: {
  [key: string]: string;
}): { [key: string]: string | object } => {
  return {
    files: {
      ...bundle
    }
  };
};
