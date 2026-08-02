export type HumanRightsPipelineInput = {
  feature: string;
  understand?: boolean;
  consent?: boolean;
  refuse?: boolean;
  inspect?: boolean;
  exportData?: boolean;
  deleteData?: boolean;
  verify?: boolean;
  continueOffline?: boolean;
};

export type HumanRightsPipelineResult = {
  feature: string;
  rights: {
    understand: boolean;
    consent: boolean;
    refuse: boolean;
    inspect: boolean;
    export: boolean;
    delete: boolean;
    verify: boolean;
    continueOffline: boolean;
  };
  failedChecks: string[];
  allowed: boolean;
};

export declare function runHumanRightsPipeline(
  input: HumanRightsPipelineInput,
): HumanRightsPipelineResult;
