const fs = require('fs');
const path = require('path');

const SENT_EMAILS_FILE = path.join(__dirname, 'sent_emails.json');

// Initialize sent_emails.json if it doesn't exist
if (!fs.existsSync(SENT_EMAILS_FILE)) {
  fs.writeFileSync(SENT_EMAILS_FILE, JSON.stringify([], null, 2), 'utf8');
}

/**
 * Log email to file (simulator) and send real email if SMTP is configured in env.
 */
async function sendEmail({ to, subject, body, html, type = 'notification' }) {
  console.log(`✉️ Sending email to: ${to}`);
  console.log(`Subject: ${subject}`);

  const plainText = body || (html ? html.replace(/<[^>]*>/g, '') : '');

  const newEmail = {
    id: 'email-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    to,
    subject,
    body: plainText,
    html,
    type,
    timestamp: new Date().toISOString(),
    status: 'sent'
  };

  try {
    const data = fs.readFileSync(SENT_EMAILS_FILE, 'utf8');
    const logs = JSON.parse(data);
    logs.unshift(newEmail); // Add to the top so new emails show first
    fs.writeFileSync(SENT_EMAILS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error logging email to file:', err);
  }

  // Real NodeMailer logic if SMTP configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: `"Apni Leap Ingest Portal" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: plainText,
        html: html
      });
      console.log(`✅ Real email sent successfully to ${to}`);
    } catch (smtpErr) {
      console.warn(`⚠️ Failed to send real email via SMTP, logged locally:`, smtpErr.message);
    }
  }

  return newEmail;
}

module.exports = {
  sendEmail
};
