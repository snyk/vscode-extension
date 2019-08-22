import { fs } from "mz";
import * as getGitUserName from "git-username";
import * as gitRepoName from "git-repo-name";
import { GIT_FILENAME } from "../constants/filesConstants";
import { GIT_SERVICES } from "../constants/allowedGitServices";
import { readFile } from "./filesUtils";

// CREATING GIT BUNDLES IS DEACTIVATED, MAY BE USED IN FUTURE

export const createGitBundle = async (
  folderPath: string
): Promise<{ [key: string]: string }> => {
  const dirContent: string[] = await fs.readdir(folderPath);
  if (dirContent.includes(GIT_FILENAME)) {
    const gitRepo: { [key: string]: string } = await readGitRepo(folderPath);
    if (Object.keys(gitRepo).length) {
      return { ...gitRepo };
    }
  }
  return {};
};

export const readGitRepo = async (
  path: string
): Promise<{ [key: string]: string }> => {
  const gitRepoConfig: string = await readFile(
    `${path}/${GIT_FILENAME}/config`
  );

  let gitRepoUrl = gitRepoConfig.split("\n").filter(str => str.includes("url"));

  const gitRepoOwner = getGitUserName(path) || null;

  if (gitRepoUrl.length && gitRepoOwner) {
    // if git contains more than one remote urls, we  will take github or bitbucket
    // and the first found repo will be taken
    const { github, bitbucket } = GIT_SERVICES;
    const urlString = gitRepoUrl.find(
      url => url.includes(github) || url.includes(bitbucket)
    );
    const repo = urlString && urlString.split(" = ")[1];
    if (repo) {
      return {
        repo: gitRepoName.sync(path),
        // TODO: if bitbucket, url-encoded user uuid must bu used insted of owner
        owner: gitRepoOwner,
        oid: getLatestGitCommit(path)
      };
    }
  }
  return {};
};

export const getLatestGitCommit = (path: string) => {
  let commit = fs.readFileSync(`${path}/${GIT_FILENAME}/HEAD`).toString();
  if (commit.includes(":")) {
    const pathToCommit = commit.split(":")[1].trim();
    commit = fs
      .readFileSync(`${path}/${GIT_FILENAME}/${pathToCommit}`)
      .toString()
      .trim();
  }
  return commit;
};
