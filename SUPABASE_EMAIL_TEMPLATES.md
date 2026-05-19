# Auth Email Templates

Use these templates in Authentication > Email Templates. They support the six-digit OTP flow used by signup and forgot password.

## Confirm Signup

Subject:

```text
Confirm your ProposalAI account
```

Body:

```html
<h2>Confirm your ProposalAI account</h2>
<p>Hello,</p>
<p>Use this verification code to complete your account setup:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>This code expires shortly. If you did not create an account, you can ignore this email.</p>
```

## Reset Password

Subject:

```text
Reset your ProposalAI password
```

Body:

```html
<h2>Reset your ProposalAI password</h2>
<p>Hello,</p>
<p>Use this recovery code to reset your password:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
<p>If you did not request a password reset, keep your current password and ignore this email.</p>
```
