const SENDER_EMAIL = 'jimstech4u@gmail.com';

export function openGmailCompose(input: { to: string; subject?: string; body?: string }) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    tf: '1',
    authuser: SENDER_EMAIL,
    to: input.to,
    su: input.subject ?? '',
    body: input.body ?? '',
  });

  window.open(`https://mail.google.com/mail/?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

