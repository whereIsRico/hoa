const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM;

async function sendVerificationCode(to, code) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Your Palisade verification code',
    text: `Your Palisade verification code is ${code}. It expires in 15 minutes.`,
  });
  if (error) throw new Error(error.message || 'Failed to send verification email');
}

async function sendAdminNotification(adminEmails, { residentName, communityName }) {
  if (adminEmails.length === 0) return;
  const { error } = await resend.emails.send({
    from: FROM,
    to: adminEmails,
    subject: `New resident awaiting approval — ${communityName}`,
    text: `${residentName} registered as a resident of ${communityName} and is waiting for your approval. Review it at https://palisade.whereisrico.dev/dashboard/admin/residents`,
  });
  if (error) throw new Error(error.message || 'Failed to send admin notification email');
}

module.exports = { sendVerificationCode, sendAdminNotification };
