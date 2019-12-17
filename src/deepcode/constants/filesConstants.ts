// Extremely extensive ignore rules. They make too many assumptions
// and cannot be reverted by the user. Better use .dcignore instead.
// import {COMMON_IGNORE_DIRS} from "./commonIgnoreDirs";

export const HASH_ALGORITHM = "sha256";
export const ENCODE_TYPE = "hex";
export const FILE_FORMAT = "utf-8";
export const GIT_FILENAME = ".git";
export const GITIGNORE_FILENAME = ".gitignore";
export const DCIGNORE_FILENAME = ".dcignore";
export const EXCLUDED_NAMES = [
  GIT_FILENAME,
  GITIGNORE_FILENAME,
  DCIGNORE_FILENAME,
  ".vscode/"
];

export const FILE_CURRENT_STATUS = {
  modified: "modified",
  deleted: "deleted",
  same: "same",
  created: "created"
};

export const DEFAULT_IGNORE = [
  // javascript dependencies
  "node_modules/",
  "jspm_packages/",
  // typescript dependencies
  "typings/",
  // python environments
  ".venv",
  ".env",
  "venv/",
  "env/",
  "venv.bak/",
  "env.bak/",
  "ENV/",
  // java logs and standard J2ME tools
  "hs_err_pid*",
  ".mtj.tmp/",
];


