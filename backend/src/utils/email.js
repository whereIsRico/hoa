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

// One send per admin, not one send with every admin in the To: header —
// a single bad address would otherwise fail the notification for everyone,
// and every admin would see every other admin's email address.
async function sendAdminNotification(adminEmails, { residentName, communityName }) {
  if (adminEmails.length === 0) return;
  const results = await Promise.allSettled(
    adminEmails.map((to) =>
      resend.emails.send({
        from: FROM,
        to,
        subject: `New resident awaiting approval — ${communityName}`,
        text: `${residentName} registered as a resident of ${communityName} and is waiting for your approval. Review it at https://palisade.argusbahamas.com/dashboard/admin/residents`,
      })
    )
  );
  const failed = results.filter((r) => r.status === 'rejected' || r.value?.error);
  if (failed.length > 0) {
    throw new Error(`Failed to notify ${failed.length}/${adminEmails.length} admin(s)`);
  }
}

async function sendPasswordResetEmail(to, resetUrl) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your Palisade password',
    text: `Reset your Palisade password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
  });
  if (error) throw new Error(error.message || 'Failed to send password reset email');
}

module.exports = { sendVerificationCode, sendAdminNotification, sendPasswordResetEmail };
