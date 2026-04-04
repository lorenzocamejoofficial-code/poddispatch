import { useSearchParams, Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";

function LegalFooter() {
  return (
    <div className="mt-12 pt-6 border-t border-border text-center text-xs text-muted-foreground">
      <p>© {new Date().getFullYear()} PodDispatch LLC. All rights reserved.</p>
      <p className="mt-1">
        Questions? Contact{" "}
        <a href="mailto:support@poddispatch.com" className="text-primary hover:underline">
          support@poddispatch.com
        </a>
      </p>
    </div>
  );
}

export default function LegalPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "terms";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </Link>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">
          Legal Documents
        </h1>

        <Tabs defaultValue={initialTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="terms">Terms of Service</TabsTrigger>
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
            <TabsTrigger value="baa">BAA</TabsTrigger>
          </TabsList>

          <TabsContent value="terms">
            <article className="prose prose-sm dark:prose-invert max-w-none mt-6">
              <h2>PodDispatch Terms of Service</h2>
              <p className="text-muted-foreground text-sm">Last updated April 2026</p>

              <h3>Acceptance of Terms</h3>
              <p>By creating an account and using PodDispatch you agree to be bound by these Terms of Service. If you are using PodDispatch on behalf of a company you represent that you have authority to bind that company to these terms.</p>

              <h3>Description of Service</h3>
              <p>PodDispatch is a cloud-based dispatch, clinical documentation, and billing management platform designed for non-emergency medical transportation operators. The service includes dispatch board management, patient care report documentation, billing claim preparation, clearinghouse export tools, compliance monitoring, and related features.</p>

              <h3>Account Registration</h3>
              <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials. You are responsible for all activity that occurs under your account. You must notify PodDispatch immediately of any unauthorized use of your account.</p>

              <h3>Subscription and Payment</h3>
              <p>PodDispatch is offered on a monthly subscription basis. Payment is due at the beginning of each billing period. Subscriptions automatically renew unless cancelled before the renewal date. Refunds are available within 30 days of initial subscription if you have completed onboarding and run at least one trip through the system and the software does not perform as described. No refunds are available after 30 days.</p>

              <h3>HIPAA Compliance</h3>
              <p>You acknowledge that you are a HIPAA covered entity or business associate and that you are responsible for your own HIPAA compliance. PodDispatch will execute a Business Associate Agreement with you as part of account creation. You are responsible for ensuring your use of PodDispatch complies with all applicable federal and state privacy and security laws.</p>

              <h3>Billing Accuracy</h3>
              <p>PodDispatch provides tools to assist with billing preparation and claim management. PodDispatch does not guarantee that claims prepared using the software will be paid by any payer. You are responsible for verifying the accuracy of all billing information before submission to any clearinghouse or payer. PodDispatch is not a licensed billing service and does not provide billing or coding advice.</p>

              <h3>Data Ownership</h3>
              <p>You own all data you enter into PodDispatch including patient records, trip records, and billing information. PodDispatch will not sell your data or use it for any purpose other than providing the service. Upon cancellation you may request an export of your data within 30 days. After 30 days data may be deleted in accordance with our data retention policy.</p>

              <h3>Acceptable Use</h3>
              <p>You agree not to use PodDispatch for any unlawful purpose, to submit false or fraudulent billing claims, to access or attempt to access another company's data, to reverse engineer or copy the software, or to resell or sublicense access to the software.</p>

              <h3>Limitation of Liability</h3>
              <p>PodDispatch is provided as is without warranty of any kind. PodDispatch shall not be liable for any indirect, incidental, special, or consequential damages including lost revenue, lost profits, or data loss arising from your use of the service. PodDispatch's total liability shall not exceed the fees paid in the three months preceding the claim.</p>

              <h3>Indemnification</h3>
              <p>You agree to indemnify and hold harmless PodDispatch and its officers, employees, and agents from any claims, damages, or expenses including reasonable attorneys fees arising from your use of the service or your violation of these terms.</p>

              <h3>Modifications</h3>
              <p>PodDispatch reserves the right to modify these terms at any time. You will be notified of material changes by email or in-app notification. Continued use of the service after notification constitutes acceptance of the modified terms.</p>

              <h3>Termination</h3>
              <p>PodDispatch may suspend or terminate your account for violation of these terms, non-payment, or any conduct that PodDispatch determines is harmful to other users or to the service. You may cancel your subscription at any time through the account settings.</p>

              <h3>Governing Law</h3>
              <p>These terms are governed by the laws of the State of Georgia. Any disputes shall be resolved in the courts of Georgia.</p>

              <h3>Contact</h3>
              <p>For questions about these terms contact <a href="mailto:support@poddispatch.com" className="text-primary hover:underline">support@poddispatch.com</a>.</p>
            </article>
          </TabsContent>

          <TabsContent value="privacy">
            <article className="prose prose-sm dark:prose-invert max-w-none mt-6">
              <h2>PodDispatch Privacy Policy</h2>
              <p className="text-muted-foreground text-sm">Last updated April 2026</p>

              <h3>Introduction</h3>
              <p>PodDispatch is committed to protecting the privacy of your information and the protected health information of your patients. This Privacy Policy describes how we collect, use, and protect information in connection with our service.</p>

              <h3>Information We Collect</h3>
              <p>We collect information you provide directly including company name, contact information, employee information, patient records, trip records, billing information, and payment information. We collect information automatically when you use the service including log data, device information, and usage patterns. We do not collect patient PHI beyond what is necessary to provide the dispatch and billing services you have contracted for.</p>

              <h3>How We Use Information</h3>
              <p>We use your information to provide and improve the service, to process payments, to send service-related communications, to comply with legal obligations, and to respond to support requests. We do not sell your information to third parties. We do not use patient PHI for any purpose other than providing the contracted service.</p>

              <h3>How We Protect Information</h3>
              <p>We use industry-standard security measures including encryption in transit and at rest, role-based access controls, audit logging, and regular security reviews. Patient data is stored in HIPAA-compliant infrastructure. Access to PHI is limited to authorized personnel only.</p>

              <h3>Data Retention</h3>
              <p>We retain your data for as long as your account is active and for seven years following account termination as required by applicable healthcare regulations. You may request deletion of non-PHI data at any time. PHI retention is governed by your Business Associate Agreement with us.</p>

              <h3>Third Party Services</h3>
              <p>We use the following third party services to provide the platform: Supabase for database and authentication infrastructure, Stripe for payment processing, and Anthropic for AI-powered features. Each of these providers maintains their own privacy and security standards. We execute appropriate agreements with each provider to protect your data.</p>

              <h3>Your Rights</h3>
              <p>You have the right to access, correct, or delete your account information at any time. You have the right to export your data. You have the right to terminate your account. For PHI-related rights please refer to your Business Associate Agreement.</p>

              <h3>Changes to This Policy</h3>
              <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or in-app notification. Continued use of the service after notification constitutes acceptance of the updated policy.</p>

              <h3>Contact</h3>
              <p>For privacy-related questions contact <a href="mailto:support@poddispatch.com" className="text-primary hover:underline">support@poddispatch.com</a>.</p>
            </article>
          </TabsContent>

          <TabsContent value="baa">
            <article className="prose prose-sm dark:prose-invert max-w-none mt-6">
              <h2>PodDispatch Business Associate Agreement</h2>
              <p className="text-muted-foreground text-sm">Effective upon electronic acceptance during account creation</p>
              <p>This Business Associate Agreement is entered into between PodDispatch LLC, hereinafter referred to as Business Associate, and the covered entity identified during account registration, hereinafter referred to as Covered Entity.</p>

              <h3>Definitions</h3>
              <p>Terms used in this Agreement shall have the same meanings as defined in the Health Insurance Portability and Accountability Act of 1996 and its implementing regulations at 45 CFR Parts 160 and 164. Protected Health Information or PHI means any individually identifiable health information created, received, maintained, or transmitted by Business Associate on behalf of Covered Entity.</p>

              <h3>Obligations of Business Associate</h3>
              <p>Business Associate agrees to not use or disclose PHI other than as permitted or required by this Agreement or as required by law. To use appropriate safeguards to prevent use or disclosure of PHI other than as provided for by this Agreement. To report to Covered Entity any use or disclosure of PHI not provided for by this Agreement within 60 days of discovery. To ensure that any subcontractors that create, receive, maintain, or transmit PHI agree to the same restrictions. To make available PHI in a designated record set to Covered Entity as necessary to satisfy obligations under 45 CFR 164.524. To make its internal practices, books, and records available to the Secretary of HHS for purposes of determining compliance with HIPAA.</p>

              <h3>Permitted Uses and Disclosures</h3>
              <p>Business Associate may use and disclose PHI only as necessary to provide the dispatch, clinical documentation, and billing management services described in the Terms of Service. Business Associate may use PHI for the proper management and administration of its business. Business Associate shall not use or disclose PHI in a manner that would violate HIPAA if done by Covered Entity.</p>

              <h3>Obligations of Covered Entity</h3>
              <p>Covered Entity agrees to notify Business Associate of any limitation in its notice of privacy practices that would affect Business Associate use or disclosure of PHI. To notify Business Associate of any changes in or revocation of permission by an individual to use or disclose PHI. To not request Business Associate to use or disclose PHI in any manner that would not be permissible under HIPAA.</p>

              <h3>Security of Electronic PHI</h3>
              <p>Business Associate shall implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of electronic PHI in accordance with 45 CFR Part 164 Subpart C.</p>

              <h3>Term and Termination</h3>
              <p>This Agreement shall be effective as of the date of account creation. Either party may terminate this Agreement if the other party materially breaches a provision and fails to cure such breach within 30 days of written notice. Upon termination Business Associate shall return or destroy all PHI received from Covered Entity.</p>

              <h3>Breach Notification</h3>
              <p>Business Associate shall notify Covered Entity without unreasonable delay and in no case later than 60 days following discovery of a breach of unsecured PHI. Notification shall include identification of each individual whose PHI was breached, a description of the breach, the type of PHI involved, and steps Business Associate is taking to investigate and mitigate the breach.</p>

              <h3>Limitation of Liability</h3>
              <p>Business Associate total liability under this Agreement shall not exceed the total fees paid by Covered Entity in the three months preceding the event giving rise to the claim.</p>

              <h3>Governing Law</h3>
              <p>This Agreement shall be governed by the laws of the State of Georgia.</p>
            </article>
          </TabsContent>
        </Tabs>

        <LegalFooter />
      </div>
    </div>
  );
}
