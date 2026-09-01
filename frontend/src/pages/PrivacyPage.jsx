import { LegalLayout, LegalSection } from '@/components/LegalLayout'

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="September 1, 2026">
      <p>
        This Privacy Policy explains what personal information Argus Systems ("Argus," "we,"
        "us") collects through Palisade, how we use it, and the choices you have. It applies to
        residents, gate staff, administrators, and guests whose information is entered into
        Palisade by a resident or staff member.
      </p>

      <LegalSection heading="1. Information We Collect">
        <p>
          <strong>Account information.</strong> When a resident registers, we collect their name,
          email address, phone number (optional), unit number, and a password (stored as a salted
          hash, never in plain text). Gate staff and admin accounts created by a Community Admin
          include similar information.
        </p>
        <p>
          <strong>Guest information.</strong> When a resident pre-registers a guest, we collect the
          guest's name and the details the resident chooses to provide about the visit.
        </p>
        <p>
          <strong>Activity records.</strong> We keep a timestamped record of check-ins,
          check-outs, approvals, and denials — the audit trail Palisade exists to provide. This
          includes which account performed each action.
        </p>
        <p>
          <strong>Technical information.</strong> Standard web request data (such as IP address,
          used for rate-limiting login and registration attempts) is processed as part of running
          the Service securely.
        </p>
      </LegalSection>

      <LegalSection heading="2. How We Use It">
        <ul className="list-disc pl-5">
          <li>To operate Palisade — matching a guest at the gate to a resident's pre-approval;</li>
          <li>To verify your email address and secure your account;</li>
          <li>To notify Community Admins of pending resident approvals;</li>
          <li>To maintain the audit trail a Community relies on for compliance and disputes;</li>
          <li>To protect the Service against abuse, such as rate-limiting repeated login attempts.</li>
        </ul>
        <p>We do not sell personal information, and we do not use it for advertising.</p>
      </LegalSection>

      <LegalSection heading="3. Who Can See It">
        <p>
          Palisade is multi-tenant: a Community's data is only visible within that Community.
          Residents see their own guest history; gate staff and admins within a Community see the
          information needed to run that Community's gate and reporting. Argus platform
          administrators can access account data as needed to provide support, investigate abuse,
          or maintain the Service.
        </p>
      </LegalSection>

      <LegalSection heading="4. Service Providers">
        <p>
          We use a small number of third-party providers to run Palisade, who process data on our
          behalf under their own security commitments:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>DigitalOcean</strong> — hosts our application and database.
          </li>
          <li>
            <strong>Resend</strong> — delivers verification codes and admin-notification emails.
          </li>
        </ul>
        <p>We don't share personal information beyond what's needed to operate the Service.</p>
      </LegalSection>

      <LegalSection heading="5. Data Retention">
        <p>
          We retain account and guest activity records for as long as a Community's account is
          active, and for a reasonable period after — including audit-trail records a Community
          may need for its own compliance or dispute resolution. If you'd like your personal
          information deleted sooner, contact us or your Community Admin; note that removing audit
          records a Community relies on may not be possible while that Community's account remains
          active.
        </p>
      </LegalSection>

      <LegalSection heading="6. Security">
        <p>
          Passwords are stored as salted hashes, not in plain text. Access to a Community's data is
          restricted to accounts within that Community, and administrative access is logged. No
          system is perfectly secure, but we take reasonable technical measures to protect the
          information you entrust to us.
        </p>
      </LegalSection>

      <LegalSection heading="7. Your Choices">
        <p>
          You can update your own profile information from your account. To request a copy of your
          data, a correction, or deletion, contact your Community Admin or email us at{' '}
          <a href="mailto:hello@argusbahamas.com" className="text-accent-600 underline hover:no-underline">
            hello@argusbahamas.com
          </a>
          . We'll respond within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children">
        <p>Palisade is intended for use by adult residents, gate staff, and administrators, and is not directed at children.</p>
      </LegalSection>

      <LegalSection heading="9. International Transfers">
        <p>
          Argus Systems is based in The Bahamas; Palisade's infrastructure is hosted with
          DigitalOcean in the United States. By using Palisade, you understand your information is
          processed in the United States.
        </p>
      </LegalSection>

      <LegalSection heading="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. If we make a material change, we'll
          update the date at the top of this page.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions about this policy, or requests about your data, can be sent to{' '}
          <a href="mailto:hello@argusbahamas.com" className="text-accent-600 underline hover:no-underline">
            hello@argusbahamas.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
