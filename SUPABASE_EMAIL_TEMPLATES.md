# Auth Email Templates

Use these templates in Authentication > Email Templates. They support the six-digit OTP flow used by signup and forgot password.

## Confirm Signup

Subject:

```text
Confirm your ProposalAI account
```

Body:

```html
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#0f172a;padding:28px 32px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">ProposalAI</div>
            <div style="margin-top:8px;font-size:13px;color:#cbd5e1;">Technical proposal and estimation workspace</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;">Confirm your account</h2>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">Hello, use this verification code to complete your ProposalAI account setup.</p>
            <div style="margin:24px 0;padding:18px 20px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;text-align:center;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#2563eb;">Verification code</div>
              <div style="margin-top:10px;font-size:34px;line-height:1;font-weight:800;letter-spacing:8px;color:#1d4ed8;">{{ .Token }}</div>
            </div>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">This code expires shortly. If you did not create an account, you can safely ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">ProposalAI account verification</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

## Reset Password

Subject:

```text
Reset your ProposalAI password
```

Body:

```html
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#111827;padding:28px 32px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">ProposalAI</div>
            <div style="margin-top:8px;font-size:13px;color:#cbd5e1;">Secure password recovery</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;">Reset your password</h2>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">Hello, use this recovery code to reset your ProposalAI password.</p>
            <div style="margin:24px 0;padding:18px 20px;border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;text-align:center;">
              <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#ea580c;">Recovery code</div>
              <div style="margin-top:10px;font-size:34px;line-height:1;font-weight:800;letter-spacing:8px;color:#c2410c;">{{ .Token }}</div>
            </div>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">If you did not request a password reset, keep your current password and ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">ProposalAI password recovery</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```
