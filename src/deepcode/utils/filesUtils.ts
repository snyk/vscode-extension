import * as crypto from "crypto";
import * as nodePath from "path";
import ignore from "ignore";
import { Buffer } from "buffer";
import { fs } from "mz";
import {
  HASH_ALGORITHM,
  ENCODE_TYPE,
  FILE_FORMAT,
  GITIGNORE_FILENAME,
  EXCLUDED_NAMES,
  FILE_CURRENT_STATUS
} from "../constants/filesConstants";
import { ALLOWED_PAYLOAD_SIZE } from "../constants/general";
import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { ExclusionRule, ExclusionFilter } from "./ignoreUtils";

export const createFileHash = (file: string): string => {
  return crypto
    .createHash(HASH_ALGORITHM)
    .update(file)
    .digest(ENCODE_TYPE);
};

export const readFile = async (filePath: string): Promise<string> => {
  return await fs.readFile(filePath, { encoding: FILE_FORMAT });
};

export const getFileNameFromPath = (path: string): string => {
  const splittedPath = path.split("/");
  return splittedPath[splittedPath.length - 1];
};

export const createFilesHashesBundle = async (
  folderPath: string,
  serverFilesFilterList: DeepCode.AllowedServerFilterListInterface
): Promise<{ [key: string]: string }> => {
  const exclusionFilter = new ExclusionFilter();
  const rootExclusionRule = new ExclusionRule();
  rootExclusionRule.addExclusions(EXCLUDED_NAMES, "");
  exclusionFilter.addExclusionRule(rootExclusionRule);
  const bundle = await createListOfDirFilesHashes(
    serverFilesFilterList,
    folderPath,
    {},
    folderPath,
    exclusionFilter
  );
  return bundle;
};

export const createListOfDirFilesHashes = async (
  serverFilesFilterList: DeepCode.AllowedServerFilterListInterface,
  folderPath: string,
  list: { [key: string]: string },
  path: string = folderPath,
  exclusionFilter: ExclusionFilter
) => {
  const dirContent: string[] = await fs.readdir(path);
  // First look for a .gitignore file.
  for (const name of dirContent) {
    const fullChildPath = nodePath.join(path, name);
    if (name === GITIGNORE_FILENAME) {
      // We found a gitignore file -> We need to modify the exclusion rules so we have
      // to create a copy of the exclusionFilter.
      const relativeDirPath = nodePath.relative(folderPath, path);
      const exclusionRule = new ExclusionRule();
      exclusionRule.addExclusions(
        await parseGitignoreFile(fullChildPath),
        relativeDirPath
      );
      exclusionFilter = exclusionFilter.copy();
      exclusionFilter.addExclusionRule(exclusionRule);
    }
  }
  // Iterate through directory after potentially updating exclusion rules.
  for (const name of dirContent) {
    try {
      const relativeDirPath = nodePath.relative(folderPath, path);
      const relativeChildPath = nodePath.join(relativeDirPath, name);
      const fullChildPath = nodePath.join(path, name);
      //console.log(`relativeChildPath ${relativeChildPath} excluded --> `, exclusionFilter.excludes(relativeChildPath));
      if (exclusionFilter.excludes(relativeChildPath)) {
        continue;
      }
      // Exclude files which are too large to be transferred via http. There is currently no
      // way to process them in multiple chunks
      let fileContentSize = fs.statSync(fullChildPath).size;
      if (fileContentSize > SAFE_PAYLOAD_SIZE) {
        console.log("Excluding file " + fullChildPath + " from processing: size " +
                    fileContentSize + " exceeds payload size limit " + SAFE_PAYLOAD_SIZE);
	      continue;
      }
      if (
        fs.lstatSync(fullChildPath).isFile() &&
        acceptFileToBundle(name, serverFilesFilterList)
      ) {
        const filePath = path.split(folderPath)[1];
        const fileContent = await readFile(fullChildPath);
        list[`${filePath}/${name}`] = createFileHash(fileContent);
      }
      if (fs.lstatSync(fullChildPath).isDirectory()) {
        list = await createListOfDirFilesHashes(
          serverFilesFilterList,
          folderPath,
          { ...list },
          `${path}/${name}`,
          exclusionFilter
        );
      }
    } catch (err) {
      continue;
    }
  }
  return { ...list };
};

export const acceptFileToBundle = (
  name: string,
  serverFilesFilterList: DeepCode.AllowedServerFilterListInterface
): boolean => {
  if (
    (serverFilesFilterList.configFiles &&
      serverFilesFilterList.configFiles.includes(name)) ||
    (serverFilesFilterList.extensions &&
      serverFilesFilterList.extensions.includes(nodePath.extname(name)))
  ) {
    return true;
  }
  return false;
};

export const parseGitignoreFile = async (
  filePath: string
): Promise<string[]> => {
  let gitignoreContent: string | string[] = await readFile(filePath);
  gitignoreContent = gitignoreContent.split("\n").filter(file => !!file);
  return gitignoreContent;
};

export const createMissingFilesPayloadUtil = async (
  missingFiles: Array<string>,
  currentWorkspacePath: string
): Promise<Array<DeepCode.PayloadMissingFileInterface>> => {
  const result: {
    fileHash: string;
    filePath: string;
    fileContent: string;
  }[] = [];
  for await (const file of missingFiles) {
    if (currentWorkspacePath) {

      let filePath = `${currentWorkspacePath}${file}`;
      const fileContent = await readFile(filePath);
      result.push({
        fileHash: createFileHash(fileContent),
        filePath,
        fileContent
      });
    }
  }
  return result;
};

export const compareFileChanges = async (
  filePath: string,
  currentWorkspacePath: string,
  currentWorkspaceFilesBundle: { [key: string]: string } | null
): Promise<{ [key: string]: string }> => {
  const filePathInsideBundle = filePath.split(currentWorkspacePath)[1];
  const response: { [key: string]: string } = {
    fileHash: "",
    filePath: filePathInsideBundle,
    status: ""
  };
  const { same, modified, created, deleted } = FILE_CURRENT_STATUS;
  try {
    const fileHash = await createFileHash(await readFile(filePath));
    response.fileHash = fileHash;
    if (currentWorkspaceFilesBundle) {
      if (currentWorkspaceFilesBundle[filePathInsideBundle]) {
        response.status =
          fileHash === currentWorkspaceFilesBundle[filePathInsideBundle]
            ? same
            : modified;
      } else {
        response.status = created;
      }
    }
  } catch (err) {
    if (
      currentWorkspaceFilesBundle &&
      currentWorkspaceFilesBundle[filePathInsideBundle]
    ) {
      response.status = deleted;
      return response;
    }
    throw err;
  }
  return response;
};

export const processServerFilesFilterList = (
  filterList: DeepCode.AllowedServerFilterListInterface
): DeepCode.AllowedServerFilterListInterface => {
  const { configFiles } = filterList;
  if (configFiles) {
    const processedConfigFiles = configFiles.map((item: string) =>
      item.slice(1)
    );
    return { ...filterList, configFiles: processedConfigFiles };
  }
  return filterList;
};

export const processPayloadSize = (
  payload: Array<DeepCode.PayloadMissingFileInterface>
): {
  chunks: boolean;
  payload:
    | Array<DeepCode.PayloadMissingFileInterface>
    | Array<Array<DeepCode.PayloadMissingFileInterface>>;
} => {
  const buffer = Buffer.from(JSON.stringify(payload));
  const payloadByteSize = Buffer.byteLength(buffer);

  if (payloadByteSize < ALLOWED_PAYLOAD_SIZE) {
    return { chunks: false, payload };
  }
  const chunkedPayload = splitPayloadIntoChunks(payload, payloadByteSize);
  return chunkedPayload;
};

// The file limit was hardcoded to 2mb but seems to be a function of ALLOWED_PAYLOAD_SIZE
// TODO what exactly is transmitted eventually and what is a good exact limit?
const SAFE_PAYLOAD_SIZE =  ALLOWED_PAYLOAD_SIZE / 2;   // safe size for requests


export const splitPayloadIntoChunks = (
  payload: {
    fileHash: string;
    filePath: string;
    fileContent: string;
  }[],
  payloadByteSize: number
) => {
  const chunkedPayload = [];

  // Break input array of files
  //     [  {hash1, content1},    {hash2, content2},   ...]
  // into array of chunks limited by an upper size bound to avoid http 413 errors
  //     [  [{hash1, content1}],  [{hash2, content2}, {hash3, content3}]  ]
  let currentChunkSize = 0;
  for (let i = 0; i < payload.length; i++) {
    const currentChunkElement = payload[i];
    const currentWorstCaseChunkElementSize = Buffer.byteLength( Buffer.from( JSON.stringify(currentChunkElement) ) ); // TODO more precision?
    const lastChunk = chunkedPayload[chunkedPayload.length - 1];

    if (!lastChunk || currentChunkSize + currentWorstCaseChunkElementSize > SAFE_PAYLOAD_SIZE) {
      // Start a new chunk
      chunkedPayload.push([payload[i]]);
      currentChunkSize = 0;
    } else {
      // Append item to current chunk
      lastChunk.push(payload[i]);
      currentChunkSize += currentWorstCaseChunkElementSize;
    }
  }

  return { chunks: true, payload: [...chunkedPayload] };
};
