import { useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "@/shared/icons";

import { formatApiError } from "@/core/config/api";
import { useAuth } from "@/core/providers/auth-provider";
import { apiClient } from "@/shared/lib/api-client";
import { Button } from "@/shared/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/shared/components/ui/input-otp";

/**
 * Directive Area 01 ("Registration & verification") - "decide exactly where
 * OTP sits in the registration flow, and make the flow visually clear". A
 * dismissible-but-recurring banner (dismissal only hides it for the
 * session) rather than a blocking modal, since email verification isn't a
 * hard gate on using the app.
 */
export function VerifyEmailBanner() {
  const { user, setUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.email_verified || dismissed) {
    return null;
  }

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      await apiClient.requestEmailVerification();
      setSent(true);
    } catch (e) {
      setError(formatApiError(e, "Could not send verification code"));
    } finally {
      setSending(false);
    }
  };

  const confirmCode = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await apiClient.confirmEmailVerification(code);
      setUser({ ...user, ...res.user });
    } catch (e) {
      setError(formatApiError(e, "Incorrect or expired code"));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-status-watch/30 bg-status-watch/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-watch" />
          <div>
            <p className="text-sm font-medium text-status-watch">Verify your email</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Confirm <span className="font-medium">{user.email}</span> with the 6-digit code we
              send you.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!sent ? (
          <Button size="sm" onClick={sendCode} disabled={sending}>
            {sending ? "Sending…" : "Send verification code"}
          </Button>
        ) : (
          <>
            <InputOTP maxLength={6} value={code} onChange={setCode} disabled={verifying}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button size="sm" onClick={confirmCode} disabled={verifying || code.length !== 6}>
              <CheckCircle2 className="h-4 w-4" />
              {verifying ? "Verifying…" : "Confirm"}
            </Button>
            <button
              type="button"
              onClick={sendCode}
              disabled={sending}
              className="text-xs text-primary underline disabled:opacity-50"
            >
              {sending ? "Resending…" : "Resend code"}
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-status-alert">{error}</p>}
    </div>
  );
}
