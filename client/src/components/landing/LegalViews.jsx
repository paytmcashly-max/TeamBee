import React from 'react';
import { ArrowLeft } from 'lucide-react';

// Plain-language legal pages. A SaaS that takes money needs these to
// exist; the wording is standard and conservative. The contact line
// deliberately avoids inventing an email address — it gets a real one
// when the custom domain is set up.
function Shell({ title, onBack, children }) {
  return (
    <div className="view-scroll">
      <div className="legal-wrap">
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated: October 2026</p>
        <div className="legal-content">{children}</div>
      </div>
    </div>
  );
}

export function TermsView({ onBack }) {
  return (
    <Shell title="Terms of Service" onBack={onBack}>
      <p><strong>1. The service.</strong> TeamBee is a shared WhatsApp team inbox built on Meta’s WhatsApp Business Platform. We provide the software; your WhatsApp number, Meta business account and the conversations on them remain yours.</p>
      <p><strong>2. Your responsibilities.</strong> You are responsible for your team’s use of the service, for having your customers’ consent to message them, and for following WhatsApp’s Business and Commerce Policies. Accounts that send spam or otherwise violate Meta’s policies may be restricted by Meta, and we may suspend workspaces that abuse the platform.</p>
      <p><strong>3. Trials and billing.</strong> New workspaces start with a free trial. Paid plans are billed monthly in advance in Indian Rupees (plus applicable GST). Meta’s per-conversation charges are billed by Meta directly and are not included in our subscription. You may cancel anytime; access continues until the end of the paid period.</p>
      <p><strong>4. Data and availability.</strong> We work to keep the service available and your data safe, but we do not guarantee uninterrupted service — in particular, features depend on Meta’s platform, which we do not control. Our liability is limited to the subscription fees you paid in the preceding three months.</p>
      <p><strong>5. Contact.</strong> For anything about these terms, reach us through the support option inside your TeamBee workspace.</p>
    </Shell>
  );
}

export function PrivacyView({ onBack }) {
  return (
    <Shell title="Privacy Policy" onBack={onBack}>
      <p><strong>1. What we process.</strong> TeamBee processes the data needed to run your team inbox: your team’s account details, your customers’ WhatsApp profile names and numbers, and the messages your business sends and receives through the WhatsApp Business Platform.</p>
      <p><strong>2. Who it belongs to.</strong> Your customers’ data belongs to your business. We process it only to provide the service — we do not sell it, use it for advertising, or train models on your conversations.</p>
      <p><strong>3. Where it runs.</strong> Data is stored with established cloud infrastructure providers and transmitted over encrypted connections. Access inside TeamBee is limited to what is needed to operate and support the service.</p>
      <p><strong>4. Retention and deletion.</strong> Workspace data is retained while your workspace is active. If you close your workspace, you may request deletion of your business data, and we will remove it from active systems within a reasonable period, subject to legal retention duties.</p>
      <p><strong>5. Your customers’ rights.</strong> Because the customer relationship is yours, requests from your customers (access, correction, deletion) should be handled by your business; we will support you in fulfilling them where the platform allows.</p>
      <p><strong>6. Contact.</strong> Questions about this policy can be raised through the support option inside your TeamBee workspace.</p>
    </Shell>
  );
}

export function RefundsView({ onBack }) {
  return (
    <Shell title="Refund Policy" onBack={onBack}>
      <p><strong>1. Free trial.</strong> Every workspace starts with a free trial and no card is required. Nothing is charged during the trial, so nothing needs refunding.</p>
      <p><strong>2. Cancelling a paid plan.</strong> You may cancel anytime. Cancellation stops the next renewal; your workspace stays active until the end of the period you have already paid for. Subscription fees for a period that has already begun are not refunded on cancellation.</p>
      <p><strong>3. Duplicate or failed charges.</strong> If you are charged twice for the same period, or a payment is taken after a failed/cancelled checkout, tell us through the support option inside your workspace — the duplicate amount will be refunded in full to the original payment method.</p>
      <p><strong>4. Service not delivered.</strong> If a paid workspace could not be used at all because of an error on our side (for example, a workspace that never activated after a successful payment), the charge for that period will be refunded in full.</p>
      <p><strong>5. Meta charges.</strong> Per-conversation charges are billed by Meta directly under Meta's own policies and are not covered by this policy.</p>
      <p><strong>6. How refunds are processed.</strong> Approved refunds go back to the original payment method through our payment partner. The time to reflect depends on your bank, typically a few business days after approval.</p>
    </Shell>
  );
}
