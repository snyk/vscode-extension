import {
  ServiceAI,
  IConfig,
  IFiles,
  IFileContent,
  StartSessionRequestDto,
  StartSessionResponseDto,
  CheckSessionRequestDto,
  CheckSessionResponseDto,
  GetFiltersRequestDto,
  GetFiltersResponseDto,
  CreateBundleRequestDto,
  CheckBundleRequestDto,
  ExtendBundleRequestDto,
  UploadFilesRequestDto,
  GetAnalysisRequestDto,
  AnalyseRequestDto
} from "@deepcode/tsc";

import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { BASE_URL, IDE_NAME } from "../constants/general";

const AI = new ServiceAI();
AI.init({
  baseURL: BASE_URL,
  useDebug: true,
} as IConfig);

const http = {
  init(config: IConfig): void {
    AI.init(config);
  },

  async login(): Promise<StartSessionResponseDto> {
    const options: StartSessionRequestDto = {
      source: IDE_NAME,
    };
    const result = await AI.startSession(options);

    return Promise.resolve(result as StartSessionResponseDto);
  },

  async checkLoginStatus(sessionToken: string): Promise<CheckSessionResponseDto> {
    const options: CheckSessionRequestDto = {
      sessionToken,
    };
    const result = await AI.checkSession(options);

    return Promise.resolve(result as CheckSessionResponseDto);
  },

  async getFilters(sessionToken: string): Promise<GetFiltersResponseDto> {
    const options: GetFiltersRequestDto = {
      sessionToken,
    };
    const result = await AI.getFilters(options);

    return Promise.resolve(result as GetFiltersResponseDto);
  },

  getServiceAI() {
    return AI;
  },

  // TODO: remove
  // async createBundle(sessionToken: string, files: object): Promise<DeepCode.RemoteBundleInterface> {
  //   const options: CreateBundleRequestDto = {
  //     sessionToken,
  //     files: (files as IFiles),
  //   };
  //   const result = await AI.createBundle(options);

  //   return Promise.resolve(result as DeepCode.RemoteBundleInterface);
  // },

  // async checkBundle(sessionToken: string, bundleId: string): Promise<DeepCode.RemoteBundleInterface> {
  //   const options: CheckBundleRequestDto = {
  //     sessionToken,
  //     bundleId,
  //   };
  //   const result = await AI.checkBundle(options);

  //   return Promise.resolve(result as DeepCode.RemoteBundleInterface);
  // },
  
  // async extendBundle(sessionToken: string, bundleId: string, body: DeepCode.RemoteExtendBundleInterface): Promise<DeepCode.RemoteBundleInterface> {
  //   const options: ExtendBundleRequestDto = {
  //     sessionToken,
  //     bundleId,
  //     files: (body.files as IFiles),
  //     removedFiles: body.removedFiles,
  //   };
  //   const result = await AI.extendBundle(options);

  //   return Promise.resolve(result as DeepCode.RemoteBundleInterface);
  // },

  // async uploadFiles(sessionToken: string, bundleId: string, body: any): Promise<void> {
  //   const options: UploadFilesRequestDto = {
  //     sessionToken,
  //     bundleId,
  //     content: (body as IFileContent[]),
  //   };
  //   await AI.uploadFiles(options);

  //   return Promise.resolve();
  // },

  // async getAnalysis(sessionToken: string, bundleId: string): Promise<DeepCode.AnalysisServerResponseInterface> {
  //   const options: GetAnalysisRequestDto = {
  //     sessionToken,
  //     bundleId,
  //   };
  //   const result = await AI.getAnalysis(options);

  //   return Promise.resolve(result as DeepCode.AnalysisServerResponseInterface);
  // },

  async analyse(files: string[], sessionToken: string) {
    const options: AnalyseRequestDto = {
      files,
      sessionToken
    };
    try {
      return AI.analyse(options);

    } catch (error) {
      const { statusCode } = error;

      return Promise.resolve({ error, statusCode });
    }
  },

  // TODO: when API package will implement such functionality
  // we would have the possibility to send an error to server
  async sendError(body: any): Promise<void> {
    return Promise.resolve();
  }
};

export default http;
