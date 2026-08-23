import { Resend } from 'resend';

/**
 * Transactional email.
 *
 * With RESEND_API_KEY unset the message is printed to the server console
 * instead of sent, so password reset can be exercised end to end on a laptop
 * with no account and no network. `sendEmail` never throws: a mail outage must
 * not turn into a 500 on a form the user is staring at.
 */

const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? 'Volt V <onboarding@resend.dev>';

export const EMAIL_ENABLED = Boolean(API_KEY);

const resend = API_KEY ? new Resend(API_KEY) : null;

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!resend) {
    console.log(
      [
        '',
        '─'.repeat(72),
        'EMAIL (not sent — RESEND_API_KEY is unset)',
        `  to:      ${to}`,
        `  subject: ${subject}`,
        '',
        text,
        '─'.repeat(72),
        '',
      ].join('\n'),
    );
    return { ok: true };
  }

  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html, text });
    if (error) {
      console.error('[email] resend rejected the message:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (error) {
    console.error('[email] send failed:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Send failed' };
  }
}

// ---------------------------------------------------------------- templates

/**
 * Inline styles and a table-free layout: every serious mail client strips
 * <style> blocks, and several still render flex and grid unpredictably.
 */
function layout(title: string, body: string, footer?: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#141414;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#f5f5f5;text-transform:uppercase;">
      VOLT<span style="color:#00e88f;">V</span>
    </div>
    <div style="margin-top:28px;padding:28px 24px;background:#1e1e1e;border:1px solid #2e2e2e;border-radius:6px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#f5f5f5;">${title}</h1>
      ${body}
    </div>
    <p style="margin-top:24px;font-size:12px;line-height:1.6;color:#a1a1aa;">
      ${footer ?? 'You are receiving this because someone entered this address on Volt V.'}
    </p>
  </div>
</body></html>`;
}

export function passwordResetEmail(name: string, url: string, minutes: number) {
  const subject = 'Reset your Volt V password';

  const html = layout(
    'Reset your password',
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#d4d4d8;">
       Hi ${escapeHtml(name)}, someone asked to reset the password on this account.
       This link works once and expires in ${minutes} minutes.
     </p>
     <a href="${url}" style="display:inline-block;padding:12px 22px;background:#00e88f;color:#141414;font-weight:600;font-size:15px;text-decoration:none;border-radius:6px;">
       Choose a new password
     </a>
     <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
       If the button does not work, paste this into your browser:<br>
       <span style="color:#00e88f;word-break:break-all;">${url}</span>
     </p>`,
    'If you did not ask for this, ignore this email — your password has not changed.',
  );

  const text = [
    `Hi ${name},`,
    '',
    'Someone asked to reset the password on your Volt V account.',
    `This link works once and expires in ${minutes} minutes:`,
    '',
    url,
    '',
    'If you did not ask for this, ignore this email — your password has not changed.',
  ].join('\n');

  return { subject, html, text };
}

export function signInEmail(
  name: string,
  details: { when: string; device: string; location: string; method: string },
) {
  const subject = 'Thanks for signing in to Volt V';

  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:4px 12px 4px 0;font-size:13px;color:#a1a1aa;white-space:nowrap;">${label}</td>
       <td style="padding:4px 0;font-size:13px;color:#f5f5f5;">${escapeHtml(value)}</td>
     </tr>`;

  const html = layout(
    'Thanks for signing in',
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#d4d4d8;">
       Hi ${escapeHtml(name)}, welcome back. Here is what we recorded for this sign-in:
     </p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
       ${row('When', details.when)}
       ${row('Method', details.method)}
       ${row('Device', details.device)}
       ${row('Location', details.location)}
     </table>
     <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
       Was this not you? Change your password straight away.
     </p>`,
    'Security notification for your Volt V account.',
  );

  const text = [
    `Hi ${name},`,
    '',
    'Thanks for signing in to Volt V. Details of this sign-in:',
    '',
    `  When:     ${details.when}`,
    `  Method:   ${details.method}`,
    `  Device:   ${details.device}`,
    `  Location: ${details.location}`,
    '',
    'Was this not you? Change your password straight away.',
  ].join('\n');

  return { subject, html, text };
}

export function passwordChangedEmail(name: string) {
  const subject = 'Your Volt V password was changed';

  const html = layout(
    'Your password was changed',
    `<p style="margin:0;font-size:15px;line-height:1.6;color:#d4d4d8;">
       Hi ${escapeHtml(name)}, the password on your Volt V account was just changed.
       If that was you, nothing more to do.
     </p>
     <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#ff8f8f;">
       If it was not you, contact us immediately — someone else may have access.
     </p>`,
    'This is a security notification and cannot be turned off.',
  );

  const text = [
    `Hi ${name},`,
    '',
    'The password on your Volt V account was just changed.',
    'If that was you, nothing more to do.',
    'If it was not, contact us immediately — someone else may have access.',
  ].join('\n');

  return { subject, html, text };
}

/** Names come from user input and land inside an HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
