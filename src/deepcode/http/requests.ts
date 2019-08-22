import * as request from "request-promise";

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
  }
};

export default http;
