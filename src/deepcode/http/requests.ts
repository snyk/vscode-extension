import {
  ServiceAI,
  IFileContent,
  StartSessionRequestDto,
  StartSessionResponseDto,
  CheckSessionRequestDto,
  CheckSessionResponseDto,
  GetFiltersRequestDto,
  GetFiltersResponseDto,
  UploadFilesRequestDto,
  GetAnalysisRequestDto,
  AnalyseRequestDto
} from "@deepcode/tsc";

import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { IDE_NAME } from "../constants/general";

const AI = new ServiceAI();

const http = {
  
  async login(baseURL: string, source: string = IDE_NAME): Promise<StartSessionResponseDto> {
    const options: StartSessionRequestDto = { baseURL, source };
    const result = await AI.startSession(options);

    return Promise.resolve(result as StartSessionResponseDto);
  },

  async checkLoginStatus(baseURL: string, sessionToken: string): Promise<CheckSessionResponseDto> {
    const options: CheckSessionRequestDto = { baseURL, sessionToken };
    const result = await AI.checkSession(options);

    return Promise.resolve(result as CheckSessionResponseDto);
  },

  async getFilters(baseURL: string, sessionToken: string): Promise<GetFiltersResponseDto> {
    const options: GetFiltersRequestDto = { baseURL, sessionToken};
    console.log('filters options --> ', options);
    const result = await AI.getFilters(options);

    return Promise.resolve(result as GetFiltersResponseDto);
  },

  getServiceAI() {
    return AI;
  },

  async uploadFiles(baseURL: string, sessionToken: string, bundleId: string, body: any): Promise<void> {
    const options: UploadFilesRequestDto = {
      baseURL,
      sessionToken,
      bundleId,
      content: (body as IFileContent[]),
    };
    await AI.uploadFiles(options);

    return Promise.resolve();
  },

  async getAnalysis(baseURL: string, sessionToken: string, bundleId: string): Promise<DeepCode.AnalysisServerResponseInterface> {
    const options: GetAnalysisRequestDto = {
      baseURL,
      sessionToken,
      bundleId,
    };
    const result = await AI.getAnalysis(options);

    return Promise.resolve(result as unknown as DeepCode.AnalysisServerResponseInterface);
  },

  async analyse(baseURL: string, sessionToken: string, files: string[], removedFiles: string[] = []) {
    const options: AnalyseRequestDto = {
      baseURL,
      sessionToken,
      files,
      removedFiles,
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
