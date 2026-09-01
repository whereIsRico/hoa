import { LegalLayout, LegalSection } from '@/components/LegalLayout'

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="September 1, 2026">
      <p>
        These Terms of Service ("Terms") govern access to and use of Palisade, a guest and gate
        management platform provided by Argus Systems ("Argus," "we," "us," or "our"), a company
        based in Nassau, The Bahamas. By creating an account, or by using Palisade as a resident,
        gate staff member, board member, or administrator, you agree to these Terms.
      </p>

      <LegalSection heading="1. The Service">
        <p>
          Palisade lets residents of a participating homeowners' association or gated community
          ("Community") pre-register expected guests, lets gate staff check those guests in and
          out, and gives Community administrators a record of that activity. A Community's board
          or management ("Community Admin") is responsible for onboarding the Community and
          approving resident accounts within it.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts">
        <p>
          Residents register with an email address and are approved by a Community Admin before
          gaining access. Gate staff and additional admin accounts are created by a Community
          Admin, not through self-registration. You're responsible for keeping your login
          credentials confidential and for all activity under your account. Tell us promptly at{' '}
          <a href="mailto:hello@argusbahamas.com" className="text-accent-600 underline hover:no-underline">
            hello@argusbahamas.com
          </a>{' '}
          if you believe your account has been compromised.
        </p>
        <p>
          You must provide accurate information when registering and when submitting guest
          details. Residents are responsible for the accuracy of the guest information they enter
          — Palisade relies on it to let gate staff make check-in decisions.
        </p>
      </LegalSection>

      <LegalSection heading="3. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5">
          <li>Use Palisade to submit false guest or identity information;</li>
          <li>Attempt to access another Community's data, or another resident's account;</li>
          <li>Probe, scan, or attempt to circumvent Palisade's security or rate limits;</li>
          <li>Use Palisade for any purpose that violates applicable law; or</li>
          <li>Resell or provide third-party access to Palisade without our written consent.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Community Subscriptions">
        <p>
          A Community's subscription is administered by its Community Admin, who is responsible
          for that Community's account in good standing. Pricing, billing frequency, and payment
          terms are set out separately when a Community is onboarded. We may suspend a Community's
          access for a materially overdue account, with reasonable notice to the Community Admin
          where practical.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data You Submit">
        <p>
          You retain ownership of the information you submit to Palisade. By submitting it, you
          give Argus a license to store, process, and display it as necessary to operate the
          Service — for example, showing a resident's pre-registered guest to gate staff at the
          relevant Community's gate. See our{' '}
          <a href="/privacy" className="text-accent-600 underline hover:no-underline">
            Privacy Policy
          </a>{' '}
          for how we handle personal information specifically.
        </p>
      </LegalSection>

      <LegalSection heading="6. Termination">
        <p>
          You may stop using Palisade at any time. A Community Admin may remove a resident's or
          staff member's access at their discretion. We may suspend or terminate access to the
          Service for conduct that violates these Terms, poses a security risk, or on reasonable
          notice for any other reason, including discontinuing the Service.
        </p>
      </LegalSection>

      <LegalSection heading="7. Disclaimer of Warranties">
        <p>
          Palisade is provided "as is." While we work to keep the audit trail and check-in records
          accurate and available, we don't guarantee the Service will be uninterrupted or
          error-free, and we make no warranty that it will prevent all unauthorized entry — it's a
          record-keeping and coordination tool, not a substitute for a Community's own physical
          security judgment at the gate.
        </p>
      </LegalSection>

      <LegalSection heading="8. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Argus Systems will not be liable for indirect,
          incidental, or consequential damages arising from your use of Palisade, including
          damages arising from a gate staff member's or Community's own access decisions. Our
          total liability for any claim relating to the Service is limited to the fees paid by the
          relevant Community for the three months preceding the claim.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes">
        <p>
          We may update these Terms from time to time. If we make a material change, we'll update
          the date at the top of this page and, where practical, notify Community Admins. Continued
          use of Palisade after a change takes effect means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing Law">
        <p>
          These Terms are governed by the laws of the Commonwealth of The Bahamas, without regard
          to its conflict-of-law principles.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          Questions about these Terms can be sent to{' '}
          <a href="mailto:hello@argusbahamas.com" className="text-accent-600 underline hover:no-underline">
            hello@argusbahamas.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
