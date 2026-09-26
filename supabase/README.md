# Supabase: OTP email relay

Django never talks to Resend directly. `core.utils.supabase_email_backend.SupabaseEmailBackend`
posts each outgoing email (OTP codes - see `features/authentication/otp_service.py`) to the
`send-email` Edge Function below, which does the real delivery via Resend using a key that
never touches the Django codebase.

```
Django (send_mail) --x-otp-secret--> supabase/functions/send-email --RESEND_API_KEY--> Resend
```

## One-time setup

Project: `knowing_eye` (ref `zbrbavxikibhibttswof`), already linked via the Supabase CLI.

1. **Deploy the function** (already done from this repo's `supabase/functions/send-email`):

   ```bash
   supabase functions deploy send-email --project-ref zbrbavxikibhibttswof --no-verify-jwt
   ```

   `--no-verify-jwt` matters: the caller is Django, not a Supabase-authenticated user, so the
   function does its own auth via the `x-otp-secret` header instead of Supabase's JWT gate.

2. **Set the function's secrets.** These live in Supabase's secret store, not in this repo -
   run this yourself once (values below are the ones already in `backend/.env`, gitignored):

   ```bash
   supabase secrets set \
     OTP_FUNCTION_SECRET=<same value as SUPABASE_OTP_FUNCTION_SECRET in backend/.env> \
     RESEND_API_KEY=<value of RESEND_API_KEY in backend/.env> \
     RESEND_FROM_EMAIL=<value of RESEND_FROM_EMAIL in backend/.env> \
     --project-ref zbrbavxikibhibttswof
   ```

   `OTP_FUNCTION_SECRET` must match `SUPABASE_OTP_FUNCTION_SECRET` in `backend/.env` (local) and
   in Render's env vars (production) exactly - it's how the function authenticates the caller.

3. **Point Django at it.** `backend/.env` (gitignored) already has `SUPABASE_URL` and
   `SUPABASE_OTP_FUNCTION_SECRET` filled in. Once step 2 is done, `EMAIL_BACKEND` auto-selects
   `SupabaseEmailBackend` (see `development.py`/`production.py`) - no other Django-side change
   needed. On Render, set the same two keys (`SUPABASE_URL`, `SUPABASE_OTP_FUNCTION_SECRET`) in
   the dashboard; `render.yaml` already reserves them as `sync: false`.

## The sandbox-sender limitation

Without a verified sending domain in Resend, `from` must stay `onboarding@resend.dev` (Resend's
built-in sandbox sender - an inbox on a domain you don't control the DNS for, like Gmail, can
never be a valid `from`). That sandbox sender can only deliver **to** the Resend account's own
verified address - any other recipient (e.g. a student test account) gets rejected with 403 and
the OTP send fails.

To send to arbitrary recipients (real usage beyond the admin's own inbox), verify a domain you
own with Resend (Domains -> Add Domain -> add the DNS records it gives you), then set
`RESEND_FROM_EMAIL` to an address at that domain, both in `backend/.env` and via
`supabase secrets set`.

## Fallback behavior

If `SUPABASE_URL` or `SUPABASE_OTP_FUNCTION_SECRET` is blank, Django falls back to the console
backend (dev) or SMTP (prod) automatically - see `EMAIL_BACKEND` in
`core/config/settings/{development,production}.py`. In dev, pair that fallback with
`OTP_DEBUG_RETURN_CODE=True` (already set) so the code shows up in the verify-email banner
without needing real mail at all.

## Testing it

```bash
curl -s -X POST https://zbrbavxikibhibttswof.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "x-otp-secret: <OTP_FUNCTION_SECRET>" \
  -d '{"to":["<the Resend account's verified address>"],"subject":"Test","text":"Hello from send-email"}'
```

A 200 with `{"ok":true,"id":"..."}` means Resend accepted it. Then exercise the real flow: log in,
click "Send verification code" in the app, and the code should land in that inbox (or, if the
secrets aren't set yet, the confirm step still works via `debug_code` in dev).
