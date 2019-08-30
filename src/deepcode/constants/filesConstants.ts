import {COMMON_IGNORE_DIRS} from "./commonIgnoreDirs";

export const HASH_ALGORITHM = "sha256";
export const ENCODE_TYPE = "hex";
export const FILE_FORMAT = "utf-8";
export const GIT_FILENAME = ".git";
export const GITIGNORE_FILENAME = ".gitignore";
export const EXCLUDED_NAMES = ["node_modules", ".git", GITIGNORE_FILENAME, ...COMMON_IGNORE_DIRS];

export const FILE_CURRENT_STATUS = {
  modified: "modified",
  deleted: "deleted",
  same: "same",
  created: "created"
};
