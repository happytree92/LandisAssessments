import type { Question } from "./scoring";

// Score maps by risk level:
// High-risk (weight >= 8): Maybe gives only 30 — a partial answer is nearly as
// bad as "No" for critical controls.
// Medium-risk (weight 5–7): Maybe gives 50 — partial compliance counts for more.
const HIGH_RISK = { Yes: 100, No: 0, Maybe: 30 };
const MED_RISK = { Yes: 100, No: 0, Maybe: 50 };

export const securityQuestions: Question[] = [
  // ── Access Control ────────────────────────────────────────────────────────
  {
    id: "ac-01",
    category: "Access Control",
    text: "Does the customer use MFA on all admin accounts?",
    weight: 10,
    scores: HIGH_RISK,
  },
  {
    id: "ac-02",
    category: "Access Control",
    text: "Is MFA enabled for all Microsoft 365 / cloud service logins?",
    weight: 10,
    scores: HIGH_RISK,
  },
  {
    id: "ac-03",
    category: "Access Control",
    text: "Are privileged accounts (domain admin, etc.) separate from daily-use accounts?",
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "ac-04",
    category: "Access Control",
    text: "Is there a formal offboarding process to revoke access when employees leave?",
    weight: 9,
    scores: HIGH_RISK,
  },
  {
    id: "ac-05",
    category: "Access Control",
    text: "Are passwords managed with a password manager (e.g., no shared spreadsheets)?",
    weight: 8,
    scores: HIGH_RISK,
  },

  // ── Email Security ────────────────────────────────────────────────────────
  {
    id: "em-01",
    category: "Email Security",
    text: "Is SPF configured on the domain?",
    weight: 7,
    scores: MED_RISK,
  },
  {
    id: "em-02",
    category: "Email Security",
    text: "Is DKIM configured and passing?",
    weight: 7,
    scores: MED_RISK,
  },
  {
    id: "em-03",
    category: "Email Security",
    text: 'Is DMARC configured with at least a "p=quarantine" policy?',
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "em-04",
    category: "Email Security",
    text: "Is anti-phishing / safe links protection enabled in M365 Defender?",
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "em-05",
    category: "Email Security",
    text: "Are users trained to identify phishing attempts?",
    weight: 6,
    scores: MED_RISK,
  },

  // ── Backup & Recovery ─────────────────────────────────────────────────────
  {
    id: "br-01",
    category: "Backup & Recovery",
    text: "Are all critical systems backed up daily?",
    weight: 10,
    scores: HIGH_RISK,
  },
  {
    id: "br-02",
    category: "Backup & Recovery",
    text: "Are backups stored offsite or in cloud (not just local)?",
    weight: 10,
    scores: HIGH_RISK,
  },
  {
    id: "br-03",
    category: "Backup & Recovery",
    text: "Has a backup restore test been performed in the last 6 months?",
    weight: 9,
    scores: HIGH_RISK,
  },
  {
    id: "br-04",
    category: "Backup & Recovery",
    text: "Is Microsoft 365 data (email, SharePoint, OneDrive) backed up by a third-party tool?",
    weight: 9,
    scores: HIGH_RISK,
  },

  // ── Endpoint Security ─────────────────────────────────────────────────────
  {
    id: "ep-01",
    category: "Endpoint Security",
    text: "Is endpoint detection and response (EDR) software deployed on all machines?",
    weight: 9,
    scores: HIGH_RISK,
  },
  {
    id: "ep-02",
    category: "Endpoint Security",
    text: "Is application whitelisting or allowlisting in use (e.g., ThreatLocker)?",
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "ep-03",
    category: "Endpoint Security",
    text: "Are OS and software updates applied within 30 days of release?",
    weight: 7,
    scores: MED_RISK,
  },
  {
    id: "ep-04",
    category: "Endpoint Security",
    text: "Is BitLocker or equivalent full-disk encryption enabled on laptops?",
    weight: 8,
    scores: HIGH_RISK,
  },

  // ── Network Security ──────────────────────────────────────────────────────
  {
    id: "ns-01",
    category: "Network Security",
    text: "Is the firewall actively managed and reviewed?",
    weight: 7,
    scores: MED_RISK,
  },
  {
    id: "ns-02",
    category: "Network Security",
    text: "Is there network segmentation between corporate and guest Wi-Fi?",
    weight: 6,
    scores: MED_RISK,
  },
  {
    id: "ns-03",
    category: "Network Security",
    text: "Is remote access via VPN or a Zero Trust solution (not open RDP)?",
    weight: 9,
    scores: HIGH_RISK,
  },

  // ── Incident Response ─────────────────────────────────────────────────────
  {
    id: "ir-01",
    category: "Incident Response",
    text: "Does the customer have a documented incident response plan?",
    weight: 7,
    scores: MED_RISK,
  },
  {
    id: "ir-02",
    category: "Incident Response",
    text: "Do staff know who to call if a breach or ransomware event occurs?",
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "ir-03",
    category: "Incident Response",
    text: "Has a tabletop or incident response drill been conducted in the last year?",
    weight: 5,
    scores: MED_RISK,
  },

  // ── Compliance & Governance ───────────────────────────────────────────────
  {
    id: "cg-01",
    category: "Compliance & Governance",
    text: "Is there a written acceptable use policy for IT systems?",
    weight: 5,
    scores: MED_RISK,
  },
  {
    id: "cg-02",
    category: "Compliance & Governance",
    text: "Is security awareness training conducted at least annually?",
    weight: 6,
    scores: MED_RISK,
  },
];

export const onboardingQuestions: Question[] = [
  // ── M365 Setup ────────────────────────────────────────────────────────────
  {
    id: "ob-m365-01",
    category: "M365 Setup",
    text: "Has the M365 tenant been configured by Landis IT (not self-provisioned)?",
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "ob-m365-02",
    category: "M365 Setup",
    text: "Are all licensed users assigned the correct M365 plan?",
    weight: 7,
    scores: MED_RISK,
  },
  {
    id: "ob-m365-03",
    category: "M365 Setup",
    text: "Is Conditional Access configured in Entra ID (Azure AD)?",
    weight: 9,
    scores: HIGH_RISK,
  },

  // ── Documentation ─────────────────────────────────────────────────────────
  {
    id: "ob-doc-01",
    category: "Documentation",
    text: "Has a full network and user inventory been documented?",
    weight: 8,
    scores: HIGH_RISK,
  },
  {
    id: "ob-doc-02",
    category: "Documentation",
    text: "Are all passwords and credentials stored securely in the Landis IT password manager?",
    weight: 9,
    scores: HIGH_RISK,
  },
  {
    id: "ob-doc-03",
    category: "Documentation",
    text: "Is the customer's IT environment documented in the PSA/documentation system?",
    weight: 7,
    scores: MED_RISK,
  },

  // ── Remote Support ────────────────────────────────────────────────────────
  {
    id: "ob-rs-01",
    category: "Remote Support",
    text: "Is the remote monitoring and management (RMM) agent installed on all endpoints?",
    weight: 9,
    scores: HIGH_RISK,
  },
  {
    id: "ob-rs-02",
    category: "Remote Support",
    text: "Is the customer aware of the support ticketing process and SLAs?",
    weight: 7,
    scores: MED_RISK,
  },

  // ── Security Baseline ─────────────────────────────────────────────────────
  {
    id: "ob-sb-01",
    category: "Security Baseline",
    text: "Has the initial security assessment been completed?",
    weight: 10,
    scores: HIGH_RISK,
  },
  {
    id: "ob-sb-02",
    category: "Security Baseline",
    text: "Is EDR deployed on all devices as part of onboarding?",
    weight: 9,
    scores: HIGH_RISK,
  },
  {
    id: "ob-sb-03",
    category: "Security Baseline",
    text: "Have cloud backups been configured and tested?",
    weight: 9,
    scores: HIGH_RISK,
  },

  // ── Business Continuity ───────────────────────────────────────────────────
  {
    id: "ob-bc-01",
    category: "Business Continuity",
    text: "Has a business continuity discussion been had with the customer's leadership?",
    weight: 7,
    scores: MED_RISK,
  },
];
