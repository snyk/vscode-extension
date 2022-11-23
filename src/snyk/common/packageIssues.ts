type PackageIssuesDataDto = {
  id: string;
  type: string;
};

export type PackageIssues = {
  data: Array<PackageIssuesDataDto>;
};
