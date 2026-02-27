export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const { company = '', name = '', email = '', message = '', website = '', source = '', ua = '' } = req.body || {};

    // honeypot spam field
    if (website) return res.status(200).json({ ok: true });

    if (!company || !name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'missing_fields' });
    }

    const to = process.env.PARTNERSHIP_TO_EMAIL || 'mgmt@sturdyoff.com';
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || 'Broke Baby Website <onboarding@resend.dev>';

    const subject = `Partnership Inquiry | Broke Baby Website | ${company}`;
    const text = [
      `Company: ${company}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Message: ${message}`,
      `Source URL: ${source}`,
      `User-Agent: ${ua}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    if (!resendKey) {
      return res.status(500).json({ ok: false, error: 'missing_email_provider' });
    }

    const mailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], reply_to: email, subject, text }),
    });

    if (!mailResp.ok) {
      const body = await mailResp.text();
      return res.status(502).json({ ok: false, error: 'email_send_failed', detail: body.slice(0, 500) });
    }

    // Optional Google Sheets logging webhook (Apps Script or other endpoint)
    const sheetWebhook = process.env.GSHEET_WEBHOOK_URL;
    if (sheetWebhook) {
      await fetch(sheetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, name, email, message, source, ua, createdAt: new Date().toISOString() }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
