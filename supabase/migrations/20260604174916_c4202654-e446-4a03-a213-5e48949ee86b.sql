
CREATE TABLE public.creator_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('customer_billing','hipaa_phi','legal_regulatory','software_incident','ops_unexpected')),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  when_it_applies TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  scripts JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_clock TEXT,
  refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_seeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_playbooks TO authenticated;
GRANT ALL ON public.creator_playbooks TO service_role;
ALTER TABLE public.creator_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator can read playbooks" ON public.creator_playbooks FOR SELECT TO authenticated USING (public.is_system_creator());
CREATE POLICY "Creator can modify playbooks" ON public.creator_playbooks FOR ALL TO authenticated USING (public.is_system_creator()) WITH CHECK (public.is_system_creator());
CREATE INDEX idx_creator_playbooks_category ON public.creator_playbooks(category);

CREATE TABLE public.creator_playbook_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.creator_playbooks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_playbook_notes TO authenticated;
GRANT ALL ON public.creator_playbook_notes TO service_role;
ALTER TABLE public.creator_playbook_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator can read notes" ON public.creator_playbook_notes FOR SELECT TO authenticated USING (public.is_system_creator());
CREATE POLICY "Creator can modify notes" ON public.creator_playbook_notes FOR ALL TO authenticated USING (public.is_system_creator()) WITH CHECK (public.is_system_creator());

CREATE TABLE public.creator_playbook_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New situation',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_playbook_chats TO authenticated;
GRANT ALL ON public.creator_playbook_chats TO service_role;
ALTER TABLE public.creator_playbook_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator can manage own chats" ON public.creator_playbook_chats FOR ALL TO authenticated
USING (public.is_system_creator() AND author_id = auth.uid())
WITH CHECK (public.is_system_creator() AND author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_creator_playbooks_updated BEFORE UPDATE ON public.creator_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_creator_playbook_chats_updated BEFORE UPDATE ON public.creator_playbook_chats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.creator_playbooks (slug, category, severity, title, summary, when_it_applies, steps, scripts, legal_clock, refs, is_seeded) VALUES
('refund-demand','customer_billing','medium','Customer demands a refund',
 'Owner threatens to leave unless they get a refund (full or partial).',
 'Any subscriber asks for a refund — politely, angrily, or via chargeback threat.',
 '[{"title":"Pause before replying","detail":"Do not reply for at least 30 minutes. Angry customers escalate when you respond defensively."},{"title":"Pull the facts","detail":"Open Creator Console, find the company. Check: signup date, plan, last payment, last 3 logins, open support tickets, any outages on those dates."},{"title":"Decide your policy stance","detail":"Default: pro-rate the unused portion of the current month, cancel future renewals. Full refund only if: outage caused them measurable harm, they were on trial, or under 7 days since charge."},{"title":"Reply with the offer in writing","detail":"Use the script below. Always email — never only phone — so there is a record."},{"title":"If they accept","detail":"Refund in Stripe then Customer then Payment then Refund. Add a note in Creator Console with the reason."},{"title":"If they refuse and threaten chargeback","detail":"Tell them once, calmly, that you will provide Stripe with the signup record, usage logs, and your refund offer. Then stop arguing."}]'::jsonb,
 '[{"label":"Refund offer email","body":"Hi {name},\n\nThank you for being direct with me. I want to make this right.\n\nLooking at your account: you signed up on {signup_date}, you are on the {plan} plan, and your last charge was {amount} on {date}.\n\nHere is what I can do today:\n- Cancel your subscription effective immediately so you are not billed again.\n- Refund the unused portion of this month ({pro_rated_amount}).\n\nIf that works, reply yes and I will process it within 24 hours.\n\n- {your_name}"}]'::jsonb,
 NULL, '[{"label":"Stripe refund docs","url":"https://stripe.com/docs/refunds"}]'::jsonb, true),

('stripe-chargeback','customer_billing','high','Stripe chargeback filed',
 'Customer disputed a charge with their bank instead of asking for a refund.',
 'Stripe email "A dispute has been opened" arrives. You have ~7-10 days to respond.',
 '[{"title":"Do NOT email the customer angrily","detail":"They already escalated. Anything you say can be screenshotted and sent to the bank."},{"title":"Gather evidence in Stripe Dashboard","detail":"Go to Payments, Disputes, this dispute. Click Submit Evidence."},{"title":"Required evidence","detail":"Signed Terms of Service acceptance (timestamp + IP from your DB), proof of service used (login count, trips dispatched, claims submitted in that period), any refund offer email you sent, the BAA they signed."},{"title":"Write a short customer-communication note","detail":"3-5 sentences max. Customer signed up X, agreed to TOS, used product Y times, was offered refund Z which they declined, then filed dispute."},{"title":"Submit before the deadline","detail":"Late equals automatic loss plus $15 fee retained."},{"title":"If you lose","detail":"Suspend the company in Creator Console. Note the user/email so they cannot re-signup."}]'::jsonb,
 '[]'::jsonb, 'Stripe dispute response window (typically 7-10 days from notification)',
 '[{"label":"Stripe disputes guide","url":"https://stripe.com/docs/disputes/responding"}]'::jsonb, true),

('angry-owner-call','customer_billing','medium','Angry owner on the phone',
 'Subscriber calls/emails screaming about a real or perceived problem.',
 'Owner is using words like unacceptable, lawsuit, destroying my business.',
 '[{"title":"Let them finish","detail":"Do not interrupt for the first 60 seconds. Take notes."},{"title":"Reflect back","detail":"Let me make sure I have this right - you are saying X, Y, Z. Did I miss anything?"},{"title":"Separate the technical from the emotional","detail":"Two issues are happening: the software problem, and the trust problem. Acknowledge the second before fixing the first."},{"title":"Commit to a timeline","detail":"Never say I will fix it now unless you literally can. Say I will investigate today and email you by 6pm with what I found."},{"title":"Send the followup email same day","detail":"In writing. With the next concrete step and a date."},{"title":"Document in Creator Console","detail":"Add a note on the company: date, what they said, what you committed to, deadline."}]'::jsonb,
 '[{"label":"Acknowledgment line","body":"I hear you. This is not the experience I want anyone running their business on my software to have. Give me until {time} today to look at exactly what happened and I will email you with a real answer."}]'::jsonb, NULL, '[]'::jsonb, true),

('cancellation-no-pay','customer_billing','low','Customer cancels but owes money',
 'Owner cancels mid-month or has unpaid invoices and wants to leave.',
 'Cancellation request comes in with outstanding balance or active subscription period.',
 '[{"title":"Confirm the cancellation in writing","detail":"Reply same day acknowledging. Set Stripe to cancel at period end (not immediately) unless they explicitly demand immediate."},{"title":"Decide collection vs writeoff","detail":"Under $200 and they are angry: write off, move on. Over $200: send one polite final invoice with a 14-day deadline."},{"title":"Data export","detail":"Offer a CSV export of their trip and claim records. HIPAA gives the customer the right to their data."},{"title":"Suspend access after grace period","detail":"30 days after cancellation: Creator Console then Suspend. Data is retained for the 7-year HIPAA retention period."}]'::jsonb,
 '[]'::jsonb, NULL, '[]'::jsonb, true),

('hipaa-breach-decision','hipaa_phi','critical','Possible HIPAA breach - decision tree',
 'PHI may have been exposed. You must decide within hours whether it is a reportable breach.',
 'Lost laptop/phone with PHI, wrong-recipient email, data leaked between tenants, ransomware, employee snooped.',
 '[{"title":"STOP - write down what happened","detail":"Date, time, who, what data, how many patients, how you found out. Do this NOW. Memory degrades and a regulator will ask."},{"title":"Contain","detail":"Revoke device access, rotate the affected user password, lock the company in Creator Console if cross-tenant leak suspected."},{"title":"Run the 4-factor risk assessment","detail":"HIPAA says it IS a breach unless you can document low probability of compromise across: (1) nature/extent of PHI involved, (2) who got it, (3) whether it was actually viewed/acquired, (4) extent of mitigation."},{"title":"If breach is probable: notify the affected covered entity","detail":"You are a Business Associate. Notify the CUSTOMER (their company), not their patients directly. They notify patients."},{"title":"Notification deadlines","detail":"Notify the covered entity without unreasonable delay and no later than 60 days from discovery. If 500+ individuals affected, the covered entity must also notify HHS and media within 60 days."},{"title":"Document everything","detail":"Even if you decide it is NOT a breach, write down the 4-factor analysis and store it. Retain for 6 years."}]'::jsonb,
 '[{"label":"Breach notification to customer","body":"Subject: Important notice regarding your account - security incident\n\nDear {owner_name},\n\nAs your Business Associate, I am notifying you of a security incident discovered on {discovery_date} that may have affected protected health information processed through PodDispatch for {company_name}.\n\nWhat happened: {plain_description}\nWhen: {date_range}\nWhat PHI was involved: {phi_types} for approximately {count} patients\nWhat we have done: {containment_steps}\nWhat you need to do: As the covered entity, you are responsible for evaluating whether patient notification is required under 45 CFR 164.404 and notifying HHS if applicable. I am available to support that process.\n\nI will follow up in writing within 7 days with a full incident report.\n\n- {your_name}"}]'::jsonb,
 '60 days from discovery to notify covered entity; 500+ affected = HHS + media notice required within 60 days',
 '[{"label":"HHS breach notification rule","url":"https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html"}]'::jsonb, true),

('lost-device-phi','hipaa_phi','critical','Lost or stolen device with PHI access',
 'Crew/admin device that can log in to PodDispatch is lost, stolen, or sold without wipe.',
 'User reports a phone/laptop missing that had an active session or saved credentials.',
 '[{"title":"Immediately revoke the session","detail":"Creator Console, find the user, Sign out all sessions / rotate password. Do this even before confirming the device is really lost."},{"title":"Check device-level encryption status","detail":"If the device was encrypted (iPhone with passcode, Mac with FileVault, Android with screen lock + modern Android, Windows with BitLocker), the PHI is considered safe harbor under HIPAA and notification is NOT required."},{"title":"If NOT encrypted","detail":"Treat as a presumed breach. Run the hipaa-breach-decision playbook. Count every patient whose record was viewable from that user account."},{"title":"File a police report","detail":"For theft, file a report and keep the report number."},{"title":"Update workforce training","detail":"Going forward all devices accessing PodDispatch must have screen lock + encryption verified at onboarding."}]'::jsonb,
 '[]'::jsonb, '60 days from discovery if PHI was unencrypted', '[]'::jsonb, true),

('wrong-recipient-email','hipaa_phi','high','Email with PHI sent to wrong person',
 'A patient roster, run sheet, or report was emailed to an unintended address.',
 'You or a customer sent PHI to the wrong email - typo, autocomplete, forwarded chain.',
 '[{"title":"Recall if possible","detail":"If sent through Gmail/Outlook in the last 30 seconds: undo send. If sent through PodDispatch: not recallable, move to next step."},{"title":"Contact the unintended recipient","detail":"Email them within 1 hour. Ask them to delete without opening attachments, confirm in writing they deleted, and not to share."},{"title":"Get written confirmation of deletion","detail":"This is the single most important mitigation factor for the 4-factor analysis. Save the reply."},{"title":"Document the incident","detail":"Who sent, what was sent (specific PHI fields), how many patients, who received, deletion confirmation."},{"title":"Decide breach reportability","detail":"If recipient confirmed prompt deletion AND was a single trusted recipient, the 4-factor analysis often supports a low-probability-of-compromise finding. Document the reasoning."}]'::jsonb,
 '[{"label":"Recipient deletion request","body":"Subject: Urgent - please delete email sent in error\n\nHello,\n\nAn email was sent to you in error at {time} on {date} containing information that was not intended for you.\n\nPlease:\n1. Delete the email from your inbox and trash without opening any attachments.\n2. Reply to this email confirming you have done so.\n3. Do not forward or share the email or its contents.\n\nThank you for your prompt help.\n\n- {your_name}"}]'::jsonb,
 '60 days from discovery if recipient does not confirm deletion', '[]'::jsonb, true),

('subpoena-received','legal_regulatory','critical','Subpoena or court order for patient records',
 'Law enforcement or attorney sends a subpoena demanding PHI.',
 'You receive a subpoena, court order, search warrant, or grand jury subpoena via mail/process server/email.',
 '[{"title":"Do NOT respond same day","detail":"Even if the document says immediate. You have time. Acting without counsel can violate HIPAA."},{"title":"Confirm what type of legal process it is","detail":"Court order signed by a judge = comply per the order. Subpoena from attorney (no judge signature) = HIPAA requires either patient notice OR qualified protective order before disclosure. Administrative subpoena (HHS-OIG, DEA) = different rules."},{"title":"Notify the customer (covered entity)","detail":"Forward to the company HIPAA privacy officer the same day. They are the legal data owner; you are the BA."},{"title":"Get a lawyer","detail":"For anything not a clear judge-signed court order: contact a healthcare attorney before producing data. Budget: $500-1500 for a 1-hour consult and response letter."},{"title":"Produce only what is demanded","detail":"Do not over-produce. Bates-stamp pages. Keep a copy of everything sent and a log of who received it."},{"title":"Document","detail":"Save the subpoena, your counsel advice, the customer instructions, and the production log. Retain 6+ years."}]'::jsonb,
 '[{"label":"Holding email to requesting attorney","body":"Counsel,\n\nReceipt acknowledged of the {document_type} dated {date} regarding {subject}.\n\nAs a HIPAA Business Associate, I am required to coordinate with the covered entity and confirm the disclosure satisfies 45 CFR 164.512(e) before producing records. I am taking those steps and will respond by {date_within_window}.\n\n- {your_name}"}]'::jsonb,
 'Subpoena response deadline stated on the document - typically 14-30 days',
 '[{"label":"45 CFR 164.512(e)","url":"https://www.ecfr.gov/current/title-45/section-164.512"}]'::jsonb, true),

('medicare-adr','legal_regulatory','high','Medicare ADR / audit letter received',
 'CMS or a MAC requests medical records to support paid claims (Additional Documentation Request).',
 'Customer forwards an ADR letter from Noridian/Palmetto/CGS, or you see an ADR alert in their dashboard.',
 '[{"title":"Identify the deadline","detail":"ADRs typically allow 45 days to respond. Missing the deadline equals automatic denial and recoupment."},{"title":"Gather the documents per claim","detail":"For each claim listed: PCS form, run sheet/ePCR, signature attestations, dispatch record, mileage proof, medical necessity documentation. Pull from PodDispatch using the trip ID."},{"title":"Quality-check before sending","detail":"Crew signature present? Patient or partner signature present? Origin/destination match billed mileage? Medical necessity narrative present?"},{"title":"Submit through the MAC portal or fax - never email","detail":"PHI cannot go over plain email. Use the MAC secure portal or encrypted fax."},{"title":"Track the response","detail":"Create a calendar reminder for 30 days post-submission to check status."},{"title":"If denied: appeal within 120 days","detail":"Level 1 redetermination is free and worth filing for any denial you believe was wrong."}]'::jsonb,
 '[]'::jsonb, '45 days to respond to ADR; 120 days for Level 1 appeal of denial', '[]'::jsonb, true),

('oig-inquiry','legal_regulatory','critical','OIG inquiry or investigation letter',
 'Office of Inspector General contacts you or a customer about possible fraud/abuse.',
 'Letter from OIG, civil investigative demand (CID), or subpoena from HHS-OIG arrives.',
 '[{"title":"DO NOT respond yourself","detail":"Get a healthcare fraud attorney before any contact. OIG investigations are serious - informal answers can be used as evidence."},{"title":"Preserve all data immediately","detail":"Issue a litigation hold internally. Do not delete anything: emails, claims, trip records, audit logs. Auto-delete jobs should be paused."},{"title":"Determine if you are a target, subject, or witness","detail":"Your attorney asks. Treatment differs."},{"title":"Customer-side coordination","detail":"If the inquiry is about a customer, they are likely the primary target. You are a BA and may be asked for records. Coordinate through their counsel."},{"title":"Never destroy or alter records","detail":"Obstruction of justice charge is worse than the underlying issue. Even if you find a mistake, document it; do not fix it retroactively."}]'::jsonb,
 '[]'::jsonb, 'CIDs typically 30-60 days', '[]'::jsonb, true),

('state-ems-complaint','legal_regulatory','high','State EMS / DPH complaint',
 'State agency (e.g. Georgia DPH) contacts a customer about a complaint involving a transport.',
 'Customer receives a complaint letter, DPH investigator visits, or you are asked for records.',
 '[{"title":"Get the complaint in writing","detail":"Ask what specifically is being investigated and which transport(s)."},{"title":"Pull the trip records","detail":"Full ePCR, timestamps, crew assignments, vehicle inspection for that day, dispatch audit log, any incident reports filed."},{"title":"Check signature and documentation completeness","detail":"Most state investigations find paperwork problems, not patient harm. Identify gaps proactively."},{"title":"Customer responds, not you","detail":"You are the SaaS vendor, not the EMS provider. Give them the records, let their compliance officer respond."},{"title":"Offer to be on the response call","detail":"Many solo founders do not have a compliance officer. Offer to walk through the system records with the investigator if helpful - only with customer permission, in writing."}]'::jsonb,
 '[]'::jsonb, NULL, '[]'::jsonb, true),

('lawyer-demand-letter','legal_regulatory','high','Lawyer demand letter',
 'You receive a letter from an attorney threatening to sue (negligence, breach of contract, HIPAA).',
 'Letter says demand or if not resolved by {date} we will pursue all available remedies.',
 '[{"title":"Do not respond emotionally or substantively","detail":"Acknowledge receipt only. Anything you say will be used."},{"title":"Tell your E&O / cyber insurance carrier within 48 hours","detail":"Most policies REQUIRE prompt notice. Late notice equals denied coverage."},{"title":"Get counsel","detail":"Your insurance carrier may assign one. If not, hire your own - $250-500/hr for a response letter."},{"title":"Preserve all records","detail":"Litigation hold. Do not delete emails, audit logs, or trip records related to the matter."},{"title":"Send only an acknowledgment until counsel responds","detail":"See script."}]'::jsonb,
 '[{"label":"Acknowledgment of demand letter","body":"Counsel,\n\nThis confirms receipt of your letter dated {date}. We are reviewing the matter with our own counsel and will respond substantively by {date}.\n\nIn the meantime, please direct all further communication regarding this matter in writing to this address.\n\n- {your_name}"}]'::jsonb,
 'Insurance notice typically 24-72 hours', '[]'::jsonb, true),

('baa-dispute','legal_regulatory','medium','BAA terms dispute with customer',
 'A customer or their lawyer pushes back on the standard BAA terms or wants their own.',
 'During onboarding or partway through subscription, customer sends red-lined BAA or demands custom terms.',
 '[{"title":"Compare to your standard","detail":"What did they change? Liability cap, indemnification, breach notification timeline, encryption requirements, audit rights?"},{"title":"Default red lines you can accept","detail":"Shorter breach notification (you commit to 30 days instead of 60), specific encryption (AES-256), reasonable audit rights with 30-day notice."},{"title":"Default red lines to push back on","detail":"Unlimited liability, indemnification of THEIR HIPAA violations, no liability cap at all, audit on demand with no notice."},{"title":"When to walk away","detail":"If they will not accept any liability cap and you cannot get insurance to cover unlimited exposure, this customer is a financial risk. Politely decline and refund."},{"title":"Always run final language past counsel","detail":"$200-400 BAA review is cheap insurance."}]'::jsonb,
 '[]'::jsonb, NULL, '[]'::jsonb, true),

('outage-customer-facing','software_incident','critical','Active outage affecting customers',
 'PodDispatch is down or severely degraded for one or more customers.',
 'Multiple customer reports, Health Check panel red, edge functions failing, dispatch board not loading.',
 '[{"title":"Open the Health Check panel in Creator Console","detail":"Confirm which subsystem is down: database, edge functions, Stripe, Twilio, Office Ally."},{"title":"Post a status acknowledgment within 15 minutes","detail":"Pinned banner in the app + email to affected owners. Even we are investigating is better than silence."},{"title":"Check Lovable Cloud status","detail":"https://status.lovable.dev. If platform is down, your job is communication, not fixing."},{"title":"Isolate the cause","detail":"Recent deploy? Roll back. Database issue? Check connection limits. Specific edge function? Check function logs in dashboard."},{"title":"Update every 30 minutes","detail":"Even if no new info: Still investigating, next update at {time}."},{"title":"Post-incident","detail":"Within 48 hours, send a postmortem email to every affected owner: what happened, why, what you are doing to prevent recurrence."}]'::jsonb,
 '[{"label":"Initial status email","body":"Subject: PodDispatch service issue - investigating\n\nWe are investigating reports of {symptom} affecting some users that started at approximately {time}.\n\nDispatch and patient records remain stored safely; this is a connectivity/availability issue, not data loss.\n\nWe will send the next update by {time + 30min}. Reply to this email if your operation is critically impacted right now.\n\n- {your_name}"}]'::jsonb,
 NULL, '[{"label":"Lovable status","url":"https://status.lovable.dev"}]'::jsonb, true),

('cross-tenant-leak','software_incident','critical','Cross-tenant data leak (one company sees another)',
 'A user reports seeing data from a company they do not belong to.',
 'Screenshot proof, support ticket, or you discover it in logs.',
 '[{"title":"Treat as a HIPAA breach by default","detail":"Cross-tenant PHI exposure is the worst-case bug. Start the hipaa-breach-decision playbook in parallel."},{"title":"Identify the failing RLS policy or filter","detail":"Most cross-tenant bugs come from: missing company_id filter on a query, an edge function with service-role key skipping RLS, a realtime subscription without channel scoping."},{"title":"Patch immediately","detail":"Even a temporary disable of the affected feature is better than continued exposure."},{"title":"Quantify exposure","detail":"Database audit logs: which records were viewed by whom and when. This number drives the breach notification math."},{"title":"Notify BOTH affected customers","detail":"The one that saw, and the one whose data was seen. Both have a right to know."},{"title":"Add a regression test","detail":"Write a test for the specific RLS or filter that failed. Run it on every deploy."}]'::jsonb,
 '[]'::jsonb, '60 days from discovery for affected covered entities', '[]'::jsonb, true),

('data-corruption','software_incident','critical','Database corruption or data loss suspected',
 'Records missing, wrong values, or restore-from-backup is being considered.',
 'Customer reports lost trips/claims; bulk update went wrong; migration failed mid-way.',
 '[{"title":"STOP writes to the affected table immediately","detail":"Continuing writes makes recovery harder. Disable the feature or put the app into maintenance mode."},{"title":"Do NOT restore the whole DB unless you must","detail":"Restoring overwrites every customer data including correct data from after the incident. Surgical recovery is preferred."},{"title":"Check Lovable Cloud snapshots","detail":"See docs/runbooks/restore-cloud-snapshot.md. Snapshots are point-in-time; you can export a single table from a snapshot and re-insert selectively."},{"title":"Identify the blast radius","detail":"How many companies, how many records, what date range. Drive notification based on this."},{"title":"Reconstruct from audit logs if possible","detail":"PodDispatch audit_log table holds before/after values for many updates."},{"title":"Notify affected customers","detail":"Same day. Be specific about what was lost and what was recovered."}]'::jsonb,
 '[]'::jsonb, NULL, '[{"label":"Restore snapshot runbook","url":"/docs/runbooks/restore-cloud-snapshot.md"}]'::jsonb, true),

('twilio-officeally-down','software_incident','high','Twilio or Office Ally outage',
 'Calls not connecting (Twilio), or claims/eligibility failing (Office Ally).',
 'Customer reports inbound voice broken, or claim submissions all 500-erroring.',
 '[{"title":"Confirm it is the upstream","detail":"Check status.twilio.com or status.officeally.com. Open a single test request from /creator-console."},{"title":"Post status banner to affected customers","detail":"Make clear it is an upstream provider, with a link to their status page."},{"title":"Queue, do not fail","detail":"PodDispatch claim submissions queue automatically and retry. Make sure the queue is not silently dropping."},{"title":"For Twilio voice down","detail":"Customers can use cell phones temporarily. Send the number to forward to."},{"title":"Document customer-impact time","detail":"For SLA credits if you offer them; for postmortem."}]'::jsonb,
 '[]'::jsonb, NULL, '[]'::jsonb, true),

('stripe-webhook-stuck','software_incident','high','Stripe webhook stuck - subscriptions not activating',
 'Customers paid but their plan did not activate; they see trial expired or get locked out.',
 'Multiple reports same day, or you see the stripe-webhook-stuck runbook in docs.',
 '[{"title":"Follow docs/runbooks/stripe-webhook-stuck.md","detail":"Detailed steps live in the runbook."},{"title":"Manually activate the affected company in Creator Console","detail":"Unblock the customer FIRST. Investigate the webhook second."},{"title":"Replay the webhook from Stripe dashboard","detail":"Developers, Webhooks, the failed event, Resend."},{"title":"Apologize in writing","detail":"Email the customer. Your payment went through correctly; our system did not pick it up. Activated manually. Sorry."}]'::jsonb,
 '[]'::jsonb, NULL, '[{"label":"Webhook runbook","url":"/docs/runbooks/stripe-webhook-stuck.md"}]'::jsonb, true),

('threatening-caller','ops_unexpected','high','Threatening or violent caller',
 'A customer (or their employee) is threatening you, your safety, your family, or your business.',
 'Phone call, email, voicemail, or in-app message with threats of violence, doxxing, or harm.',
 '[{"title":"End the call / stop responding","detail":"You owe no one the conversation. Hang up. Do not engage."},{"title":"Preserve evidence","detail":"Record the voicemail, screenshot the email, save the chat. Note date/time and exact words."},{"title":"Suspend the company in Creator Console","detail":"Use the suspension workflow. They lose access immediately; data is retained."},{"title":"Report to police if credible","detail":"Non-emergency line for general threats. 911 if you believe immediate danger."},{"title":"Send one written notice - then no contact","detail":"See script. After this, route everything to a lawyer."},{"title":"Refund without argument","detail":"Issue a full refund and end the relationship. The few hundred dollars is worth being done."}]'::jsonb,
 '[{"label":"Final communication after threats","body":"This is the only further communication you will receive from me regarding your account.\n\nYour subscription has been cancelled effective immediately. A full refund of {amount} has been issued and will appear in 5-10 business days. Your account data is retained per HIPAA requirements and is available to your authorized data recipient.\n\nDo not contact me, my staff, or this company further. All future communication must be in writing through legal counsel.\n\n- {your_name}"}]'::jsonb,
 NULL, '[]'::jsonb, true),

('employee-leaves-with-access','ops_unexpected','high','Employee/contractor leaves with system access',
 'Anyone who had admin/db/Stripe access stops working with you - amicable or not.',
 'You hired help (developer, VA, biller) and they are no longer working with you.',
 '[{"title":"Make a list of every system they touched","detail":"Lovable, Supabase dashboard, Stripe, Twilio, Office Ally, email, GitHub, password manager, customer accounts."},{"title":"Revoke / rotate within 24 hours","detail":"Remove from each system. Rotate any shared passwords. Revoke API keys. Rotate LOVABLE_API_KEY (Lovable settings, Rotate)."},{"title":"Check for backdoors","detail":"Review recent commits, new edge functions, new database users, new admin memberships, scheduled jobs."},{"title":"Audit log review","detail":"Last 30 days of actions by their user. Anything unusual: data exports, mass updates, customer impersonation."},{"title":"Get a signed exit/NDA acknowledgment if possible","detail":"Reminds them of confidentiality obligations."}]'::jsonb,
 '[]'::jsonb, NULL, '[]'::jsonb, true),

('ransomware-suspected','ops_unexpected','critical','Ransomware or account takeover suspected',
 'Your own machine is compromised, or you see signs of attacker activity in the system.',
 'Ransom note, encrypted files, suspicious logins from foreign IPs, unfamiliar admin accounts.',
 '[{"title":"Disconnect the affected device from network","detail":"Pull wifi/ethernet. Do not power off - forensics may want memory."},{"title":"Do NOT pay","detail":"Payment is not deductible for tax, often illegal under OFAC rules, and ~50% of payers never get data back."},{"title":"Rotate every credential from a CLEAN device","detail":"Phone or separate laptop. Lovable, Supabase, Stripe, email, password manager master password."},{"title":"Call your cyber insurance hotline FIRST","detail":"Most policies require you call them before doing anything else. They assign a forensics firm at policy rate."},{"title":"Treat as HIPAA breach until proven otherwise","detail":"Ransomware is presumed breach under HHS guidance. Start hipaa-breach-decision in parallel."},{"title":"Notify customers proactively","detail":"Within 48-72 hours. Be honest. Trust survives candor; it does not survive coverup."}]'::jsonb,
 '[]'::jsonb, '60 days from discovery for HIPAA breach notification',
 '[{"label":"HHS ransomware fact sheet","url":"https://www.hhs.gov/sites/default/files/RansomwareFactSheet.pdf"}]'::jsonb, true),

('social-media-complaint','ops_unexpected','medium','Public complaint on social media',
 'A customer publicly trashes PodDispatch on LinkedIn, Twitter/X, Facebook, Reddit, or G2.',
 'You see or are tagged in a post complaining about the product, support, or you personally.',
 '[{"title":"Do not reply in anger","detail":"Wait 24 hours before any public response. Read the post 3 times."},{"title":"Verify the underlying issue","detail":"Look up the customer. Is the complaint accurate? Was there really an outage? A bug? A billing mistake?"},{"title":"Respond once, publicly, briefly","detail":"Acknowledge, take it offline. Never argue facts in public."},{"title":"Actually solve it offline","detail":"Email or call within 24 hours of the post. Fix what you can fix."},{"title":"Ask for an update only after resolution","detail":"If you make them happy, ask if they would update the post. Do not pressure."},{"title":"Never sue for a review","detail":"Streisand effect. The lawsuit becomes the story."}]'::jsonb,
 '[{"label":"Public reply template","body":"Hi {name} - this is {your_name}, the person who builds PodDispatch. I am sorry you had this experience. I sent you an email just now and would like to fix this directly. My personal email is {email} if it does not arrive."}]'::jsonb,
 NULL, '[]'::jsonb, true),

('press-inquiry','ops_unexpected','high','Press / journalist inquiry',
 'A reporter contacts you about the product, a customer, an incident, or the industry.',
 'Email from a journalist, request for comment, or you are mentioned in an article draft.',
 '[{"title":"Acknowledge receipt; commit to nothing","detail":"Thanks for reaching out, I will get back to you by {date}. Buy time."},{"title":"Identify the angle","detail":"Is this about a breach? An outage? A customer? A product feature? Industry trends? Each requires a different posture."},{"title":"Never go off-the-record with someone you do not know","detail":"Off the record has no legal meaning. Assume everything will be printed."},{"title":"Prepare 3 sentences","detail":"What you do, why you do it, what you want readers to know. Practice them."},{"title":"For incident-related inquiries: get counsel","detail":"Especially for breach or lawsuit-related. Wrong word in print can become evidence."},{"title":"Decline politely if unsure","detail":"I do not have anything to share publicly at this time is a complete answer."}]'::jsonb,
 '[]'::jsonb, NULL, '[]'::jsonb, true),

('accidental-mass-email','ops_unexpected','high','Accidental mass email or broken automation',
 'You sent the wrong email to a customer list, or an automation fired incorrectly.',
 'Wrong template, wrong list, broken merge variables, billing email sent to everyone, etc.',
 '[{"title":"Stop the automation NOW","detail":"Disable the cron, the trigger, or the queue worker before more emails go out."},{"title":"Count the damage","detail":"How many emails went out, to whom, what did they say."},{"title":"Send a correction within 1 hour","detail":"From your own personal address if possible - feels more human. Apologize plainly. Do not blame the system."},{"title":"If PHI was in the wrong email","detail":"This is also wrong-recipient-email - run that playbook in parallel and treat as potential breach."},{"title":"Fix the root cause before resuming","detail":"Add a confirm-before-send gate, a dry-run mode, or a small-batch test for the automation."}]'::jsonb,
 '[{"label":"Correction email","body":"Subject: Please disregard my last email\n\nHi - earlier today PodDispatch sent you an email titled {subject} that should not have gone to you. Please disregard it.\n\nWhat happened: {plain_one_sentence}. No action is needed on your part.\n\nI am sorry for the noise.\n\n- {your_name}"}]'::jsonb,
 NULL, '[]'::jsonb, true);
