export type AdvisorScoreLabel = {
  popularity: string;
  maintenance: string;
  community: string;
  security: string;
};

export type AdvisorScore = {
  name: string;
  score: number;
  pending: boolean;
  labels: AdvisorScoreLabel;
} | null;

export type AdvisorRegistry = 'npm-package' | 'python';
