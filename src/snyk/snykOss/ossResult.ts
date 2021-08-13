export type OssResult = OssFileResult[] | OssFileResult;

export type OssFileResult = {
  vulnerabilities: Vulnerability[];
  projectName: string;
  displayTargetFile: string;
  packageManager: string;
};

export type Vulnerability = {
  id: string;
  license?: string;
  identifiers?: Identifiers;
  title: string;
  description: string;
  language: string;
  packageManager: string;
  packageName: string;
  severity: string;
  name: string;
  version: string;
  exploit?: string;

  CVSSv3?: string;
  cvssScore?: string;

  fixedIn?: Array<string>;
  from: Array<string>;
  upgradePath: Array<string>;
};

export type Identifiers = {
  CWE: string[];
  CVE: string[];
};
