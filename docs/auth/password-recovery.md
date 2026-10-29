# AuroTap password recovery: production setup and verification

## What the code does

- The Forgot Password page submits to `POST /api/auth/forgot-password`.
- Supabase Auth sends the recovery email using the configured Supabase email provider/SMTP.
- The email's recovery URL must return to `/auth/update-password`.
- The update page exchanges the one-time PKCE code (or handles the session supplied by the Supabase client), verifies a recovery session, and then calls `auth.updateUser({ password })`.
- For phone sign-in accounts, the API looks for a real email in `profiles.email`; it never attempts to deliver mail to the synthetic `@users.aurotap.in` login address. Phone recovery is not SMS recovery.

## Required Supabase Dashboard setup (manual)

Code cannot change the hosted Supabase project's email template or SMTP settings by itself. An authorized project owner must do these steps:

1. Open **Supabase Dashboard → Authentication → URL Configuration**.
2. Set the production Site URL to `https://aurotap.in` (or the canonical production origin used by the deployment).
3. Add `https://aurotap.in/auth/update-password` to the Redirect URLs allow-list. If `www.aurotap.in` is also a supported origin, add `https://www.aurotap.in/auth/update-password` too. The redirect origin used by the app must match an allow-listed URL.
4. Open **Authentication → Email Templates → Reset Password**.
5. Paste the HTML from `supabase/templates/recovery.html` into the Reset Password template and save it. Keep the `{{ .ConfirmationURL }}` placeholder intact.
6. Configure a verified SMTP provider under **Authentication → SMTP Settings** for reliable production delivery. Check sender domain verification, SPF/DKIM/DMARC, provider limits, and spam placement. Supabase's default email service is rate-limited and is not a production email-delivery guarantee.
7. Confirm the recovery email template uses the correct production redirect behavior. Never place service-role secrets in the template or client code.

## End-to-end test checklist

Use a test account you control and a real inbox. Do not use a customer account without permission.

1. Submit a registered email on `/auth/forgot-password`.
2. Confirm one reset email arrives; inspect inbox and spam folder.
3. Verify the email branding, Reset Password button, and fallback link.
4. Click the link. It should open `/auth/update-password`, not the Supabase dashboard or a localhost URL.
5. Enter a new password and confirmation. A mismatch must be rejected without an API update.
6. Submit matching values. Confirm a success message and redirect to sign-in.
7. Sign in with the new password; verify the old password no longer works.
8. Reuse the reset link; it should be rejected as expired/consumed.
9. Test an unknown email and a phone account with a registered recovery email; UI copy should not reveal whether an account exists.
10. Test a phone account without a real recovery email; it must not send to a synthetic address. Provide the user with a support path instead.

## Important limitations

- Repository changes cannot verify live SMTP delivery or change Supabase Dashboard settings without project access.
- Phone-number recovery currently depends on a deliverable `profiles.email`; it does not send an SMS code.
- Do not mark the flow production-verified until the full test checklist has passed on the deployed domain.
