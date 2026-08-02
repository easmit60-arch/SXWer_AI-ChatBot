export type ConsentGuardInput = {
  feature: string;
  sessionId?: string;
  consentState?: {
    scopes?: Record<string, boolean>;
  };
  rights?: {
    understand?: boolean;
    consent?: boolean;
    refuse?: boolean;
    inspect?: boolean;
    export?: boolean;
    delete?: boolean;
    verify?: boolean;
    continueOffline?: boolean;
  };
};

export type ConsentGuardResult = {
  allowed: boolean;
  sessionId: string;
  feature: string;
  reason?: string;
  evaluation: {
    requiredScopes: string[];
    missingScopes: string[];
    failedChecks: string[];
    allowed: boolean;
  };
};

export declare function requireConsentForFeature(
  input: ConsentGuardInput,
): ConsentGuardResult;
