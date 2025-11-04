"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface AuthState {
  user: any | null;
  session: any | null;
  mfaFactors: any[] | null;
  error: string | null;
}

export default function TestAuthPage() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    mfaFactors: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    setLoading(true);
    try {
      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // Get session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Get MFA factors
      const { data: mfaData, error: mfaError } = await supabase.auth.mfa.listFactors();

      setState({
        user: user || null,
        session: session || null,
        mfaFactors: mfaData?.all || null,
        error: userError?.message || sessionError?.message || mfaError?.message || null,
      });
    } catch (error: any) {
      setState({
        user: null,
        session: null,
        mfaFactors: null,
        error: error.message || "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const testEnroll = async () => {
    setEnrolling(true);
    setEnrollError(null);
    try {
      console.log("Starting biometric enrollment...");
      
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "webauthn",
        friendlyName: "Test Device",
      });

      if (error) {
        console.error("Enrollment error:", error);
        setEnrollError(`${error.message} (Code: ${error.status || "N/A"})`);
      } else {
        console.log("Enrollment data:", data);
        setEnrollError(null);
        await loadAuthState();
      }
    } catch (error: any) {
      console.error("Enrollment exception:", error);
      setEnrollError(error.message || "Unknown error");
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto p-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Auth Diagnostic</h1>

      {/* User State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state.user ? (
              <>
                <CheckCircle2 className="size-5 text-green-500" />
                User Authenticated
              </>
            ) : (
              <>
                <XCircle className="size-5 text-red-500" />
                No User
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.user ? (
            <>
              <div>
                <strong>ID:</strong> {state.user.id}
              </div>
              <div>
                <strong>Email:</strong> {state.user.email}
              </div>
              <div>
                <strong>Email Confirmed:</strong>{" "}
                {state.user.email_confirmed_at ? (
                  <Badge variant="default">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No user data available</p>
          )}
        </CardContent>
      </Card>

      {/* Session State */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state.session ? (
              <>
                <CheckCircle2 className="size-5 text-green-500" />
                Session Active
              </>
            ) : (
              <>
                <XCircle className="size-5 text-red-500" />
                No Session
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.session ? (
            <>
              <div>
                <strong>Access Token:</strong>{" "}
                <code className="text-xs">{state.session.access_token.substring(0, 20)}...</code>
              </div>
              <div>
                <strong>Expires At:</strong>{" "}
                {new Date((state.session.expires_at || 0) * 1000).toLocaleString()}
              </div>
              <div>
                <strong>AAL:</strong> <Badge>{state.session.user?.aal || "N/A"}</Badge>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No session data available</p>
          )}
        </CardContent>
      </Card>

      {/* MFA Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            MFA Factors
            {state.mfaFactors && state.mfaFactors.length > 0 ? (
              <Badge variant="default">{state.mfaFactors.length}</Badge>
            ) : (
              <Badge variant="secondary">0</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.mfaFactors && state.mfaFactors.length > 0 ? (
            state.mfaFactors.map((factor: any) => (
              <div key={factor.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>{factor.friendly_name || "Unnamed"}</strong>
                    <div className="text-sm text-muted-foreground">
                      Type: {factor.factor_type} | Status: {factor.status}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(factor.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No MFA factors enrolled</p>
          )}
        </CardContent>
      </Card>

      {/* Test Enrollment */}
      <Card>
        <CardHeader>
          <CardTitle>Test Biometric Enrollment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testEnroll} disabled={enrolling || !state.user}>
            {enrolling ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              "Test Enroll Biometric"
            )}
          </Button>

          {enrollError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 text-red-600" />
                <div className="flex-1">
                  <strong className="text-red-900 dark:text-red-100">Enrollment Error</strong>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">{enrollError}</p>
                </div>
              </div>
            </div>
          )}

          {!state.user && (
            <p className="text-sm text-muted-foreground">
              You must be logged in to test enrollment
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {state.error && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="size-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{state.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={loadAuthState} variant="outline">
          Refresh State
        </Button>
        <Button
          onClick={async () => {
            await supabase.auth.signOut();
            await loadAuthState();
          }}
          variant="destructive"
        >
          Sign Out
        </Button>
      </div>
    </main>
  );
}

