import * as request from "request-promise";
import {
  ServiceAI,
  IConfig,
  IFiles,
  StartSessionRequestDto,
  StartSessionResponseDto,
  CheckSessionRequestDto,
  CheckSessionResponseDto,
  GetFiltersRequestDto,
  GetFiltersResponseDto,
  CreateBundleRequestDto,
  CheckBundleRequestDto,
  ExtendBundleRequestDto,
} from "@deepcode/tsc";

import DeepCode from "../../interfaces/DeepCodeInterfaces";
import { BASE_URL, IDE_NAME } from "../constants/general";

const AI = new ServiceAI();
AI.init({
  baseURL: BASE_URL,
  useDebug: true,
} as IConfig);

const http = {
  generalOptions: {
    resolveWithFullResponse: true,
    json: true
  },
  async get(uri: string, token: string = ""): Promise<{ [key: string]: any }> {
    const { body, statusCode } = await request({
      ...this.generalOptions,
      uri,
      ...(token && { headers: { "Session-Token": token } })
    });
    return { statusCode, ...body };
  },

  async post(
    uri: string,
    options: { [key: string]: any } = {
      body: null,
      token: "",
      fileUpload: false
    }
  ): Promise<{ [key: string]: any }> {
    const { body, token, fileUpload } = options;

    const createHeaders = () => {
      const headers: { [key: string]: string } = {};
      if (body) {
        headers["Content-Type"] = fileUpload
          ? "application/json;charset=utf-8"
          : "application/json";
      }
      if (token) {
        headers["Session-Token"] = token;
      }
      return headers;
    };

    const { body: responseBody, statusCode } = await request({
      ...this.generalOptions,
      method: "POST",
      uri,
      ...(body && { body }),
      headers: createHeaders()
    });
    return { statusCode, ...responseBody };
  },

  async put(
    uri: string,
    options: { [key: string]: any } = {
      body: null,
      token: ""
    }
  ): Promise<{ [key: string]: any }> {
    const { body, token } = options;
    const { body: responseBody, statusCode } = await request({
      ...this.generalOptions,
      method: "PUT",
      uri,
      ...(body && { body }),
      headers: {
        "Content-Type": "application/json",
        "Session-Token": token
      }
    });
    return { statusCode, ...responseBody };
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

  async createBundle(sessionToken: string, files: object): Promise<DeepCode.RemoteBundleInterface> {
    const options: CreateBundleRequestDto = {
      sessionToken,
      files: (files as IFiles),
    };
    const result = await AI.createBundle(options);

    return Promise.resolve(result as DeepCode.RemoteBundleInterface);
  },

  async checkBundle(sessionToken: string, bundleId: string): Promise<DeepCode.RemoteBundleInterface> {
    const options: CheckBundleRequestDto = {
      sessionToken,
      bundleId,
    };
    const result = await AI.checkBundle(options);

    return Promise.resolve(result as DeepCode.RemoteBundleInterface);
  },

  async extendBundle(sessionToken: string, bundleId: string, body: DeepCode.RemoteExtendBundleInterface): Promise<DeepCode.RemoteBundleInterface> {
    const options: ExtendBundleRequestDto = {
      sessionToken,
      bundleId,
      files: (body.files as IFiles),
      removedFiles: body.removedFiles,
    };
    const result = await AI.extendBundle(options);

    return Promise.resolve(result as DeepCode.RemoteBundleInterface);
  }
};

export default http;
