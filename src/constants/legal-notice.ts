import * as Localization from 'expo-localization';
import Constants from 'expo-constants';

export const LEGAL_ACK_KEY = '@innerspace:legal_ack_version';
export const LEGAL_ACK_VERSION = '2026-06-01';

const EU_EEA_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO',
  'SK', 'SI', 'ES', 'SE',
];

type LegalRegion = 'US' | 'CA' | 'EU_EEA' | 'UK' | 'IN' | 'APAC' | 'LATAM' | 'MENA' | 'GLOBAL';

export interface LegalNotice {
  region: LegalRegion;
  regionLabel: string;
  title: string;
  summary: string;
  bullets: string[];
}

type ExpoExtra = {
  legalNoticeMarkdownUrl?: string;
};

function detectLegalRegion(): LegalRegion {
  const regionCode = (Localization.getLocales()[0]?.regionCode ?? '').toUpperCase();
  if (regionCode === 'US') return 'US';
  if (regionCode === 'CA') return 'CA';
  if (regionCode === 'GB' || regionCode === 'UK') return 'UK';
  if (regionCode === 'IN') return 'IN';
  if (EU_EEA_CODES.includes(regionCode)) return 'EU_EEA';

  if (['JP', 'KR', 'SG', 'AU', 'NZ', 'CN', 'HK', 'TW', 'PH', 'ID', 'MY', 'TH', 'VN'].includes(regionCode)) {
    return 'APAC';
  }

  if (['BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'UY', 'PY', 'EC', 'BO'].includes(regionCode)) {
    return 'LATAM';
  }

  if (['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'EG', 'JO', 'MA'].includes(regionCode)) {
    return 'MENA';
  }

  return 'GLOBAL';
}

const GLOBAL_BULLETS = [
  'InnerSpace is an AI self-help companion and not a medical, legal, or crisis service.',
  'Do not rely on this app for emergencies, diagnosis, urgent legal decisions, or urgent financial decisions.',
  'If you are in danger or crisis, contact local emergency services or a local crisis hotline immediately.',
  'You are responsible for reviewing and validating AI-generated responses before acting on them.',
  'Your data is stored on your device. If you connect an AI provider, your prompts may be processed by that provider under its terms.',
  'Some regions require parental consent and special protections for minors; this app is intended for adults 18+.',
];

const REGION_RULES: Record<LegalRegion, string[]> = {
  US: [
    'US users may have state-specific privacy rights (for example, access, deletion, correction, and opt-out rights) depending on local law.',
    'Consumer and healthcare privacy laws may apply based on your location and use case.',
  ],
  CA: [
    'Canadian privacy requirements may include consent, access, correction, and deletion rights under applicable provincial and federal law.',
  ],
  EU_EEA: [
    'EU and EEA users may have rights under GDPR, including access, rectification, erasure, portability, and objection where applicable.',
    'Lawful basis, transparency, and purpose limitation principles may apply to personal data processing.',
  ],
  UK: [
    'UK users may have rights under UK GDPR and the Data Protection Act, including access, correction, and deletion rights where applicable.',
  ],
  IN: [
    'Users in India may have rights and obligations under the Digital Personal Data Protection framework and related guidance.',
  ],
  APAC: [
    'APAC jurisdictions may have local consent, data-transfer, and retention obligations depending on country-specific law.',
  ],
  LATAM: [
    'LATAM jurisdictions may impose local data protection obligations such as consent, notice, and rights to access or deletion.',
  ],
  MENA: [
    'MENA jurisdictions may impose local personal data and cross-border transfer restrictions depending on country-specific law.',
  ],
  GLOBAL: [
    'Local consumer, privacy, and AI laws may apply depending on your country and state or province.',
  ],
};

const REGION_LABEL: Record<LegalRegion, string> = {
  US: 'United States',
  CA: 'Canada',
  EU_EEA: 'EU/EEA',
  UK: 'United Kingdom',
  IN: 'India',
  APAC: 'APAC',
  LATAM: 'Latin America',
  MENA: 'Middle East and North Africa',
  GLOBAL: 'Global',
};

export function getLegalNotice(): LegalNotice {
  const region = detectLegalRegion();
  return {
    region,
    regionLabel: REGION_LABEL[region],
    title: 'Legal and Privacy Notice',
    summary:
      'Please review and accept this notice before using InnerSpace. This app is guidance-only and is not a substitute for professional services.',
    bullets: [...GLOBAL_BULLETS, ...REGION_RULES[region]],
  };
}

export function getLegalNoticeText(): string {
  const notice = getLegalNotice();
  const bullets = notice.bullets.map((line) => `- ${line}`).join('\n');
  return `${notice.summary}\n\nRegion detected: ${notice.regionLabel}\n\n${bullets}`;
}

function getRemoteLegalNoticeMarkdownUrl(): string | null {
  const url = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.legalNoticeMarkdownUrl;
  if (!url || typeof url !== 'string') return null;
  return url.trim() || null;
}

export async function getLegalNoticeTextFromRepo(): Promise<string | null> {
  const url = getRemoteLegalNoticeMarkdownUrl();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;

    const markdown = (await res.text()).trim();
    if (!markdown) return null;

    const notice = getLegalNotice();
    return markdown
      .replaceAll('{{REGION_LABEL}}', notice.regionLabel)
      .replaceAll('{{REGION_CODE}}', notice.region)
      .replaceAll('{{LEGAL_ACK_VERSION}}', LEGAL_ACK_VERSION);
  } catch {
    return null;
  }
}

export async function getEffectiveLegalNoticeText(): Promise<string> {
  const fromRepo = await getLegalNoticeTextFromRepo();
  return fromRepo ?? getLegalNoticeText();
}
