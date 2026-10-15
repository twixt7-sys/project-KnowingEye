// Relays outgoing mail (OTP codes in particular - see
// backend/features/authentication/otp_service.py) through Resend.
//
// Django never sees RESEND_API_KEY - it only knows this function's URL and
// the shared OTP_FUNCTION_SECRET, sent as `x-otp-secret`. Deploy with
// `--no-verify-jwt`: the caller is a server-to-server relay, not a
// Supabase-authenticated user, so our own header check replaces Supabase's
// JWT gate rather than sitting behind it.
//
// Secrets (set with `supabase secrets set`, see supabase/README.md):
//   OTP_FUNCTION_SECRET  - shared secret; must match Django's
//                          SUPABASE_OTP_FUNCTION_SECRET
//   RESEND_API_KEY       - Resend API key
//   RESEND_FROM_EMAIL    - default "from" address (optional; falls back to
//                          Resend's onboarding@resend.dev sandbox sender,
//                          which can only deliver to the Resend account's
//                          own verified address until a sending domain is
//                          verified)

const OTP_FUNCTION_SECRET = Deno.env.get("OTP_FUNCTION_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DEFAULT_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

interface SendEmailBody {
  to?: string[];
  subject?: string;
  text?: string;
  from?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!OTP_FUNCTION_SECRET || req.headers.get("x-otp-secret") !== OTP_FUNCTION_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: SendEmailBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { to, subject, text, from } = body;
  if (!to?.length || !subject || !text) {
    return new Response(
      JSON.stringify({ error: "\"to\", \"subject\", and \"text\" are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: from || DEFAULT_FROM_EMAIL, to, subject, text }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    return new Response(JSON.stringify({ error: "Resend rejected the send", detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await resendResponse.json();
  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
