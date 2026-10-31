const nodemailer = require('nodemailer');
const db = require('../db');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
  } else {
    // Generate Ethereal test account or simulated transport for development/demo
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[Email] Using Ethereal test email service (${testAccount.user})`);
    } catch (e) {
      // Fallback dummy transporter
      transporter = {
        sendMail: async (options) => {
          console.log(`[Email Simulation] To: ${options.to} | Subject: ${options.subject}`);
          return { messageId: 'simulated-' + Date.now() };
        }
      };
    }
  }

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  try {
    const mailer = await getTransporter();
    const from = process.env.FROM_EMAIL || '"Brightloop Billing" <billing@brightloop.com>';

    const info = await mailer.sendMail({
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html
    });

    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log(`[Email Preview URL]: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    console.error(`[Email Delivery Error to ${to}]:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendEmail
};
