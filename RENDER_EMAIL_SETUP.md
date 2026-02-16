# Render – OTP Email (SMTP) Setup

## ⚠️ Render free tier: SMTP is blocked

**Render blocks outbound SMTP (ports 25, 465, 587) on free web services.** You will see "Connection timeout" when sending email on a free instance. You have two options:

1. **Upgrade to a paid Render plan** – Any paid instance allows outbound SMTP. Your current Gmail SMTP config will work without code changes.
2. **Stay on free tier** – Use an HTTP-based email API (e.g. [Resend](https://resend.com), SendGrid, Mailgun) that sends over HTTPS (port 443). That requires adding a separate integration in the code (e.g. `RESEND_API_KEY` and a Resend transport).

---

## 1. Environment variables (for SMTP on paid Render)

In **Render Dashboard → Your Service → Environment**, set:

| Key         | Value                     | Secret? |
|------------|---------------------------|--------|
| `SMTP_HOST` | `smtp.gmail.com`          | No     |
| `SMTP_PORT` | `587`                     | No     |
| `SMTP_SECURE` | `false`                 | No     |
| `SMTP_USER` | `developer.bliss@gmail.com` | No   |
| `SMTP_PASS` | *Your Gmail App Password* | **Yes** |

- **SMTP_PORT**: Must be `587` (STARTTLS) or `465` (SSL). The app parses it as a number.
- **SMTP_SECURE**: Set to `true` only for port 465; for 587 use `false`.
- **SMTP_PASS**: Use a [Gmail App Password](https://support.google.com/accounts/answer/185833), not your normal Gmail password. Mark as **Secret** in Render.

## 2. After deploy – check logs

On each deploy you should see:

- **SMTP CONFIG:** `{ host, port, secure, user, passExists: true }`  
  (password is never logged)
- **✅ SMTP connection verified successfully**  
  or **❌ SMTP verification failed:** with `message`, `code`, `response` for debugging.

If verification fails, fix the env vars (especially `SMTP_PASS` and `SMTP_PORT`) and redeploy.

## 3. Test endpoint

- **GET** `https://your-app.onrender.com/api/email-test`  
  Sends a test email to `SMTP_USER` and returns JSON. Use this to confirm SMTP on Render.
- Check **Render Logs** for the exact error if the test returns 500.

## 4. OTP endpoints

- **POST** `/api/send-verification-email`  
  Body: `{ "email": "user@example.com" }`  
  Sends OTP email; always returns JSON (no raw 500).
- **POST** `/api/realEstate/send-verification-email`  
  Same handler, alternate path.

On failure, the response is always JSON with `success: false` and `message`. The **Render Logs** will show the full SMTP error (`message`, `code`, `response`, `responseCode`) so you can fix config or Gmail settings.

## 5. Gmail checklist

- 2-Step Verification enabled on the Google account.
- App Password created for “Mail” and used in `SMTP_PASS`.
- No typos or extra spaces in env values (especially in Render’s UI).
