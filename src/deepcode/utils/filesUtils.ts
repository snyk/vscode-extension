import * as crypto from "crypto";
import * as nodePath from "path";
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
  const bundle = await createListOfDirFilesHashes(
    serverFilesFilterList,
    folderPath,
    {}
  );
  return bundle;
};

export const createListOfDirFilesHashes = async (
  serverFilesFilterList: DeepCode.AllowedServerFilterListInterface,
  folderPath: string,
  list: { [key: string]: string },
  path: string = folderPath,
  exludedFiles: Array<string> = [...EXCLUDED_NAMES]
) => {
  const dirContent: string[] = await fs.readdir(path);
  for (const name of dirContent) {
    try {
      if (name === GITIGNORE_FILENAME) {
        exludedFiles.push(
          ...(await parseGitignoreFile(nodePath.join(path, name)))
        );
      }

      if (exludedFiles.includes(name)) {
        continue;
      }

      if (
        fs.lstatSync(nodePath.join(path, name)).isFile() &&
        acceptFileToBundle(name, serverFilesFilterList)
      ) {
        const filePath = path.split(folderPath)[1];
        const fileContent = await readFile(nodePath.join(path, name));
        list[`${filePath}/${name}`] = createFileHash(fileContent);
      }
      if (fs.lstatSync(nodePath.join(path, name)).isDirectory()) {
        list = await createListOfDirFilesHashes(
          serverFilesFilterList,
          folderPath,
          { ...list },
          `${path}/${name}`,
          exludedFiles
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

export const createMissingFilesPayload = async (
  missingFiles: Array<string>,
  currentWorkspacePath: string
): Promise<Array<DeepCode.PayloadMissingFileInterface>> => {
  const result: {
    fileHash: string;
    fileContent: string;
  }[] = [];
  for await (const file of missingFiles) {
    if (currentWorkspacePath) {
      const fileContent = await readFile(`${currentWorkspacePath}${file}`);
      result.push({
        fileHash: createFileHash(fileContent),
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

export const splitPayloadIntoChunks = (
  payload: {
    fileHash: string;
    fileContent: string;
  }[],
  payloadByteSize: number
) => {
  const SAVE_PAYLOAD_SIZE = 1024 * 1024 * 2; // save size for requests - 2MB in bytes
  const oneFileAproxSize = payloadByteSize / payload.length; // bytes divided into number of files
  const chunkLength = Math.floor(SAVE_PAYLOAD_SIZE / oneFileAproxSize);

  const chunkedPayload = [];
  for (let i = 0; i < payload.length; i++) {
    const last = chunkedPayload[chunkedPayload.length - 1];
    if (!last || last.length === chunkLength) {
      chunkedPayload.push([payload[i]]);
    } else {
      last.push(payload[i]);
    }
  }
  return { chunks: true, payload: [...chunkedPayload] };
};
