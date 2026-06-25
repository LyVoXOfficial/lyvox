"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTOTP } from "@/hooks/useTOTP";

interface TOTPEnrollmentProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TOTPEnrollment({ onSuccess, onCancel }: TOTPEnrollmentProps) {
  const [friendlyName, setFriendlyName] = useState("Authenticator app");
  const [verificationCode, setVerificationCode] = useState("");
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const { enroll, verify, isEnrolling, isVerifying } = useTOTP({
    onVerifySuccess: () => {
      toast.success("Authenticator verified");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleEnroll = async () => {
    const result = await enroll(friendlyName.trim() || "Authenticator app");

    if (result.success && result.factorId && result.qrCode && result.secret) {
      setEnrollData({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
      });
    }
  };

  const handleVerify = async () => {
    if (!enrollData) return;
    await verify(enrollData.factorId, verificationCode);
  };

  const copySecret = async () => {
    if (!enrollData) return;

    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopiedSecret(true);
      toast.success("Setup key copied");
      window.setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error("Could not copy setup key");
    }
  };

  if (!enrollData) {
    return (
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" aria-hidden="true" />
            Add an authenticator app
          </CardTitle>
          <CardDescription>
            Name the device or app you are connecting. This helps you remove the right factor later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-medium">Supported apps</p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>Google Authenticator</li>
                <li>Microsoft Authenticator</li>
                <li>Authy</li>
                <li>1Password</li>
                <li>Bitwarden Authenticator</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="friendly-name">Device or app name</Label>
            <Input
              id="friendly-name"
              type="text"
              value={friendlyName}
              onChange={(event) => setFriendlyName(event.target.value)}
              placeholder="Example: iPhone, 1Password, Microsoft Authenticator"
              disabled={isEnrolling}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleEnroll} disabled={isEnrolling} className="flex-1">
              {isEnrolling ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Creating setup...
                </>
              ) : (
                "Create setup code"
              )}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isEnrolling}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" aria-hidden="true" />
          Scan the QR code
        </CardTitle>
        <CardDescription>
          Scan this code in your authenticator app, then enter the six-digit code it generates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-md border bg-white p-4">
            <Image
              src={enrollData.qrCode}
              alt="Authenticator setup QR code"
              width={200}
              height={200}
              unoptimized
            />
          </div>

          <Alert>
            <AlertDescription className="w-full space-y-2">
              <p className="text-sm font-medium">Cannot scan the QR code?</p>
              <p className="text-sm">Copy this setup key into your authenticator app manually.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm">
                  {enrollData.secret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                  aria-label="Copy setup key"
                >
                  {copiedSecret ? (
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <div className="space-y-2">
          <Label htmlFor="verification-code">Six-digit authenticator code</Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            disabled={isVerifying}
            className="text-center font-mono text-2xl tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            The code refreshes every 30 seconds.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleVerify}
            disabled={verificationCode.length !== 6 || isVerifying}
            className="flex-1"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Verify code
              </>
            )}
          </Button>
          {onCancel && (
            <Button
              variant="outline"
              onClick={() => {
                setEnrollData(null);
                setVerificationCode("");
                onCancel();
              }}
              disabled={isVerifying}
            >
              Cancel
            </Button>
          )}
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            Keep account recovery in mind. If you lose access to the authenticator app, support may need to verify ownership before restoring access.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
