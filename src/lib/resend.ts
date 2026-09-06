const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
  const from =
    import.meta.env.RESEND_FROM ||
    'AI for Access Hackathon <info@hackathon.powercoders.org>';

  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
}

/** Add a contact to the Resend audience. Only call for people who opted in to news. */
export async function addToAudience(email: string, name: string) {
  const audienceId = import.meta.env.RESEND_AUDIENCE_ID;
  // ponytail: the send-only key can't touch contacts, so allow a separate key
  const key = import.meta.env.RESEND_CONTACTS_API_KEY || import.meta.env.RESEND_API_KEY;
  if (!audienceId || !key) return;

  const [firstName, ...rest] = (name || '').trim().split(/\s+/);
  const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      firstName: firstName || undefined,
      lastName: rest.join(' ') || undefined,
      unsubscribed: false,
    }),
  });

  if (!res.ok) throw new Error(await res.text());
}

export const DISCORD_INVITE = 'https://discord.gg/yaZTAY2yx';

export function confirmationEmail(lang: 'de' | 'en', name: string) {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  if (lang === 'de') {
    return {
      subject: 'Anmeldung bestätigt — AI for Access Hackathon',
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
          <p>Hallo${first ? ' ' + escapeHtml(first) : ''},</p>
          <p>deine Anmeldung für den <strong>AI for Access Hackathon</strong> (20.–21. November 2026, Stadtkloster Frieden, Bern) ist eingegangen. 🎉</p>
          <p>Die <strong>Teambildung startet am 1. November</strong>. Unserem Discord-Server kannst du aber schon jetzt beitreten — dort findest du alle Infos und kannst Fragen stellen:</p>
          <p><a href="${DISCORD_INVITE}" style="display:inline-block;background:#5865F2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Discord beitreten</a></p>
          <p style="color:#666;font-size:13px">${DISCORD_INVITE}</p>
          <p>Bis bald!<br/>Das AI for Access Team</p>
        </div>`,
    };
  }
  return {
    subject: 'Registration confirmed — AI for Access Hackathon',
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
        <p>Hi${first ? ' ' + escapeHtml(first) : ''},</p>
        <p>your registration for the <strong>AI for Access Hackathon</strong> (20–21 November 2026, Stadtkloster Frieden, Bern) has been received. 🎉</p>
        <p><strong>Team formation starts on 1 November.</strong> You can already join our Discord server though — all the info is there and you can ask questions:</p>
        <p><a href="${DISCORD_INVITE}" style="display:inline-block;background:#5865F2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Join Discord</a></p>
        <p style="color:#666;font-size:13px">${DISCORD_INVITE}</p>
        <p>See you soon!<br/>The AI for Access team</p>
      </div>`,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
