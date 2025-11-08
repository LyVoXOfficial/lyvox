import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface TOTPFactor {
  id: string;
  friendly_name: string | null;
  factor_type: "totp";
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
}

export interface TOTPEnrollResult {
  success: boolean;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}

export interface TOTPVerifyResult {
  success: boolean;
  error?: string;
}

export interface UseTOTPOptions {
  autoLoad?: boolean;
  onEnrollSuccess?: (factorId: string) => void;
  onVerifySuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UseTOTPReturn {
  factors: TOTPFactor[];
  isLoading: boolean;
  isEnrolling: boolean;
  isVerifying: boolean;
  error: string | null;
  enroll: (friendlyName?: string) => Promise<TOTPEnrollResult>;
  verify: (factorId: string, code: string) => Promise<TOTPVerifyResult>;
  challenge: (factorId: string) => Promise<{ challengeId: string } | { error: string }>;
  verifyChallenge: (factorId: string, challengeId: string, code: string) => Promise<TOTPVerifyResult>;
  unenroll: (factorId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useTOTP(options: UseTOTPOptions = {}): UseTOTPReturn {
  const { autoLoad = false, onEnrollSuccess, onVerifySuccess, onError } = options;

  const [factors, setFactors] = useState<TOTPFactor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load factors on mount if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      refresh();
    }
  }, [autoLoad]);

  /**
   * Refresh the list of TOTP factors
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        const errorMsg = error.message || "Failed to load TOTP factors";
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      if (data) {
        const normalizedFactors = (data.totp ?? []).map((factor) => ({
          ...factor,
          friendly_name: factor.friendly_name ?? null,
        }));
        setFactors(normalizedFactors);
      }
    } catch (err: any) {
      const errorMsg = err.message || "Unexpected error loading factors";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  /**
   * Enroll a new TOTP factor
   */
  const enroll = useCallback(
    async (friendlyName: string = "Authenticator App"): Promise<TOTPEnrollResult> => {
      setIsEnrolling(true);
      setError(null);

      try {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName,
        });

        if (error) {
          const errorMsg = error.message || "Failed to enroll TOTP";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (!data) {
          const errorMsg = "No enrollment data returned";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        const { id: factorId, totp } = data;

        if (!totp) {
          const errorMsg = "No TOTP data in enrollment response";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        // Refresh factors list
        await refresh();

        return {
          success: true,
          factorId,
          qrCode: totp.qr_code,
          secret: totp.secret,
        };
      } catch (err: any) {
        const errorMsg = err.message || "Unexpected error during enrollment";
        setError(errorMsg);
        onError?.(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsEnrolling(false);
      }
    },
    [onError, refresh]
  );

  /**
   * Verify a TOTP code during enrollment
   */
  const verify = useCallback(
    async (factorId: string, code: string): Promise<TOTPVerifyResult> => {
      setIsVerifying(true);
      setError(null);

      try {
        const challenge = await supabase.auth.mfa.challenge({ factorId });

        if (challenge.error) {
          const errorMsg = challenge.error.message || "Failed to create challenge";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        const challengeId = challenge.data?.id;
        if (!challengeId) {
          const errorMsg = "No challenge ID returned";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        const verification = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code,
        });

        if (verification.error) {
          const errorMsg = verification.error.message || "Invalid code";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        onVerifySuccess?.();
        await refresh();

        return { success: true };
      } catch (err: any) {
        const errorMsg = err.message || "Unexpected error during verification";
        setError(errorMsg);
        onError?.(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsVerifying(false);
      }
    },
    [onError, onVerifySuccess, refresh]
  );

  /**
   * Create a challenge for TOTP verification (for login)
   */
  const challenge = useCallback(
    async (factorId: string) => {
      try {
        const { data, error } = await supabase.auth.mfa.challenge({ factorId });

        if (error) {
          const errorMsg = error.message || "Failed to create challenge";
          setError(errorMsg);
          onError?.(errorMsg);
          return { error: errorMsg };
        }

        if (!data?.id) {
          const errorMsg = "No challenge ID returned";
          setError(errorMsg);
          onError?.(errorMsg);
          return { error: errorMsg };
        }

        return { challengeId: data.id };
      } catch (err: any) {
        const errorMsg = err.message || "Unexpected error creating challenge";
        setError(errorMsg);
        onError?.(errorMsg);
        return { error: errorMsg };
      }
    },
    [onError]
  );

  /**
   * Verify a TOTP code against a challenge (for login)
   */
  const verifyChallenge = useCallback(
    async (factorId: string, challengeId: string, code: string): Promise<TOTPVerifyResult> => {
      setIsVerifying(true);
      setError(null);

      try {
        const { error } = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code,
        });

        if (error) {
          const errorMsg = error.message || "Invalid code";
          setError(errorMsg);
          onError?.(errorMsg);
          return { success: false, error: errorMsg };
        }

        onVerifySuccess?.();
        return { success: true };
      } catch (err: any) {
        const errorMsg = err.message || "Unexpected error during verification";
        setError(errorMsg);
        onError?.(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsVerifying(false);
      }
    },
    [onError, onVerifySuccess]
  );

  /**
   * Unenroll (remove) a TOTP factor
   */
  const unenroll = useCallback(
    async (factorId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const { error } = await supabase.auth.mfa.unenroll({ factorId });

        if (error) {
          const errorMsg = error.message || "Failed to unenroll TOTP factor";
          setError(errorMsg);
          onError?.(errorMsg);
          return false;
        }

        await refresh();
        return true;
      } catch (err: any) {
        const errorMsg = err.message || "Unexpected error during unenrollment";
        setError(errorMsg);
        onError?.(errorMsg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [onError, refresh]
  );

  return {
    factors,
    isLoading,
    isEnrolling,
    isVerifying,
    error,
    enroll,
    verify,
    challenge,
    verifyChallenge,
    unenroll,
    refresh,
  };
}

