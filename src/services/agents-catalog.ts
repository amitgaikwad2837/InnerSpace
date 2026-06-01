/**
 * InnerSpace — Remote Agents Catalog Service
 *
 * Fetches the helpers marketplace catalog from the GitHub repo at startup.
 * Caches locally in AsyncStorage with a 24-hour TTL.
 * Falls back to the bundled PREDEFINED_AGENTS if the fetch fails or is stale.
 *
 * To add, remove, or edit helpers: edit .github/agents.json in the repo.
 * Safety rules (SAFETY_PREFIX) are always injected client-side and cannot
 * be bypassed by editing the catalog JSON.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { PREDEFINED_AGENTS } from '../constants/agents';
import { containsAdultContent } from './safety-filter';
import type { Agent, AIMode } from '../types';

const CACHE_KEY = '@innerspace:agents_catalog_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type ExpoExtra = {
  agentsCatalogUrl?: string;
};

/** Shape of each entry in .github/agents.json */
interface CatalogEntry {
  id: string;
  name: string;
  nameKey: string;
  descriptionKey: string;
  category: string;
  emoji: string;
  /** Agent expertise without the safety prefix — injected at runtime */
  expertise: string;
  suggestedQuestions: string[];
  isCustom: boolean;
  isPremium: boolean;
  minimumAIMode: AIMode;
}

interface CatalogFile {
  version: number;
  agents: CatalogEntry[];
}

interface CacheRecord {
  fetchedAt: number;
  catalog: CatalogEntry[];
}

// ─── Safety prefix (mirrors agents.ts — always enforced) ──────────────────────

const SAFETY_PREFIX = `
IMPORTANT RULES — ALWAYS FOLLOW — NO EXCEPTIONS:
- Suicidal thoughts/self-harm/crisis → immediate crisis resources (988 US / 116 123 UK / Text HOME to 741741). Stop normal conversation.
- Medical symptoms/diagnosis/medications → redirect warmly to a doctor or pharmacist. Do not engage.
- Legal advice for a specific situation → redirect to a solicitor or Citizens Advice.
- Specific investment/financial decisions → redirect to a qualified financial adviser.
- Domestic abuse/violence/child at risk → provide emergency helpline immediately (0808 2000 247 UK / 1-800-799-7233 US).
- Political/religious opinion questions → remain neutral; help them explore their own values.
- Never give advice that could cause physical harm.

LANGUAGE: Always respond in the same language the user writes in.
TONE: Respond using this style: {TONE}
`;

function buildAgent(entry: CatalogEntry): Agent {
  return {
    id: entry.id,
    name: entry.name,
    nameKey: entry.nameKey,
    descriptionKey: entry.descriptionKey,
    category: entry.category,
    emoji: entry.emoji,
    systemPrompt: SAFETY_PREFIX + '\n\n' + entry.expertise,
    suggestedQuestions: entry.suggestedQuestions,
    isCustom: entry.isCustom,
    isPremium: entry.isPremium,
    minimumAIMode: entry.minimumAIMode,
  };
}

// ─── Verification layer ───────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  'home_family', 'nature_garden', 'health_wellness', 'career_learning',
  'creative_hobbies', 'tech_digital', 'pets_animals', 'travel_culture', 'personal_growth',
]);

/**
 * Phrases that signal an attempt to override the safety prefix.
 * If any of these appear in the expertise text the agent is rejected.
 * Checks are case-insensitive and ignore extra whitespace.
 */
// Safety bypass patterns — detects both:
// 1. Prompt injection attempts (ignore rules, act as DAN, etc.)
// 2. Harmful agent purposes (illegal, violence, abuse, exploitation, etc.)
const SAFETY_BYPASS_PATTERNS: RegExp[] = [
  /ignore\s+(the\s+)?(above|previous|prior|safety|rules|instructions)/i,
  /disregard\s+(the\s+)?(above|previous|prior|safety|rules|instructions)/i,
  /override\s+(the\s+)?(above|previous|prior|safety|rules|instructions)/i,
  /forget\s+(the\s+)?(above|previous|prior|safety|rules|instructions)/i,
  /you\s+(can|may|should|must)\s+(now\s+)?(give|provide|offer)\s+(medical|legal|financial|crisis|clinical|diagnostic|prescription)/i,
  /bypass\s+(safety|rules|restrictions|guidelines)/i,
  /no\s+restrictions?\s+(apply|mode|enabled)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(un(restricted|filtered|censored)|jailbroken|DAN)/i,
  /do\s+not\s+(follow|apply|use|respect)\s+(the\s+)?(safety|rules|guidelines|restrictions)/i,
  /rules?\s+(above|below|listed)\s+(do\s+not|don'?t)\s+apply/i,
  /pretend\s+(there\s+are\s+no|you\s+have\s+no)\s+(rules?|restrictions?|guidelines?)/i,
  // Harmful agent purposes detection
  /how\s+to\s+(make|create|build|manufacture).*(bomb|explosive|weapon|drug|poison|hack)/i,
  /illegal\s+(activity|drugs?|hacking|weapons?)/i,
  /instructions?\s+for\s+(violence|torture|murder|killing|bombing)/i,
  /pro-?ana|pro-?mia|thinspo|eating.?disorder.?tips/i,
  /child\s+(exploitation|abuse|grooming|endangerment)/i,
  /doxx|doxing|publish.?private.?information|revenge.?porn/i,
  /extremist|radicalization|white.?supremacist|nazi|terrorism/i,
];

export type AgentRejectionReason =
  | 'missing_required_fields'
  | 'invalid_category'
  | 'id_too_long'
  | 'name_too_long'
  | 'expertise_too_long'
  | 'expertise_too_short'
  | 'control_characters_detected'
  | 'safety_bypass_detected'
  | 'adult_content_detected'
  | 'harmful_purpose_detected'
  | 'duplicate_id';

export interface AgentVerificationResult {
  accepted: CatalogEntry[];
  rejected: Array<{ id: string; name: string; reason: AgentRejectionReason }>;
}

function hasSafetyBypass(expertise: string): boolean {
  return SAFETY_BYPASS_PATTERNS.some((pattern) => pattern.test(expertise));
}

function hasControlCharacters(value: string): boolean {
  // Allow common whitespace (\n \r \t) but reject null bytes and other control chars
  return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value);
}

/** Full structural + safety verification for a single entry. Returns null if the shape is wrong. */
function verifyEntry(
  e: unknown,
  seenIds: Set<string>,
): { entry: CatalogEntry; reason: null } | { entry: null; reason: AgentRejectionReason; id: string; name: string } {
  if (!e || typeof e !== 'object') {
    return { entry: null, reason: 'missing_required_fields', id: '?', name: '?' };
  }

  const o = e as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const name = typeof o.name === 'string' ? o.name.trim() : '';

  // 1. Required fields
  if (
    !id ||
    !name ||
    typeof o.nameKey !== 'string' ||
    typeof o.descriptionKey !== 'string' ||
    typeof o.category !== 'string' ||
    typeof o.emoji !== 'string' ||
    typeof o.expertise !== 'string' ||
    !Array.isArray(o.suggestedQuestions)
  ) {
    return { entry: null, reason: 'missing_required_fields', id: id || '?', name: name || '?' };
  }

  const expertise = o.expertise as string;

  // 2. Length caps (prevent resource exhaustion and abuse)
  if (id.length > 64)         return { entry: null, reason: 'id_too_long',        id, name };
  if (name.length > 80)       return { entry: null, reason: 'name_too_long',       id, name };
  if (expertise.length < 20)  return { entry: null, reason: 'expertise_too_short', id, name };
  if (expertise.length > 4000) return { entry: null, reason: 'expertise_too_long', id, name };

  // 3. Control character check
  if (hasControlCharacters(id) || hasControlCharacters(name) || hasControlCharacters(expertise)) {
    return { entry: null, reason: 'control_characters_detected', id, name };
  }

  const minimumAIMode = o.minimumAIMode === 'cloud' ? 'cloud' : 'local';

  // 4. Valid category
  if (!VALID_CATEGORIES.has(o.category as string)) {
    return { entry: null, reason: 'invalid_category', id, name };
  }

  // 5. Duplicate ID (first occurrence wins)
  if (seenIds.has(id)) {
    return { entry: null, reason: 'duplicate_id', id, name };
  }

  // 6. Safety bypass detection — most important check
  if (hasSafetyBypass(expertise)) {
    return { entry: null, reason: 'safety_bypass_detected', id, name };
  }

  // 7. Adult content check — strict enforcement
  if (containsAdultContent(name) || containsAdultContent(expertise)) {
    return { entry: null, reason: 'adult_content_detected', id, name };
  }

  seenIds.add(id);
  return {
    entry: {
      id,
      name,
      nameKey: o.nameKey as string,
      descriptionKey: o.descriptionKey as string,
      category: o.category as string,
      emoji: o.emoji as string,
      expertise,
      suggestedQuestions: (o.suggestedQuestions as unknown[])
        .filter((q): q is string => typeof q === 'string')
        .slice(0, 10),
      isCustom: o.isCustom === true,
      isPremium: o.isPremium === true,
      minimumAIMode,
    },
    reason: null,
  };
}

/**
 * Run the full verification pass over a raw array.
 * Returns both the accepted entries and a structured rejection log.
 */
function verifyCatalog(raw: unknown[]): AgentVerificationResult {
  const accepted: CatalogEntry[] = [];
  const rejected: AgentVerificationResult['rejected'] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    const result = verifyEntry(item, seenIds);
    if (result.reason === null) {
      accepted.push(result.entry);
    } else {
      rejected.push({ id: result.id, name: result.name, reason: result.reason });
    }
  }

  return { accepted, rejected };
}

// For existing code that only needs a boolean check on a raw unknown
function isValidEntry(e: unknown): e is CatalogEntry {
  const result = verifyEntry(e, new Set());
  return result.reason === null;
}

function getCatalogUrl(): string | null {
  const url = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.agentsCatalogUrl;
  if (!url || typeof url !== 'string') return null;
  return url.trim() || null;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(): Promise<CatalogEntry[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const record: CacheRecord = JSON.parse(raw);
    if (Date.now() - record.fetchedAt > CACHE_TTL_MS) return null; // stale
    if (!Array.isArray(record.catalog) || record.catalog.length === 0) return null;

    // Re-verify on read — guards against a poisoned cache written by a compromised build
    const { accepted } = verifyCatalog(record.catalog);
    if (accepted.length === 0) return null;
    return accepted;
  } catch {
    return null;
  }
}

async function writeCache(catalog: CatalogEntry[]): Promise<void> {
  try {
    const record: CacheRecord = { fetchedAt: Date.now(), catalog };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(record));
  } catch {
    // non-critical — cache write failure is fine
  }
}

// ─── Network fetch ────────────────────────────────────────────────────────────

async function fetchRemoteCatalog(): Promise<CatalogEntry[] | null> {
  const url = getCatalogUrl();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data: CatalogFile = await res.json();
    if (!data || !Array.isArray(data.agents)) return null;

    const { accepted, rejected } = verifyCatalog(data.agents);

    if (__DEV__ && rejected.length > 0) {
      console.warn(
        '[AgentsCatalog] Rejected agents:',
        rejected.map((r) => `${r.id} (${r.reason})`).join(', '),
      );
    }

    if (accepted.length === 0) return null;
    return accepted;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current agents list.
 * Order of resolution: AsyncStorage cache → remote fetch → bundled fallback.
 * A background refresh is triggered if the cache is fresh (so the next call
 * gets updated data without blocking the UI).
 */
export async function getCatalogAgents(): Promise<Agent[]> {
  // 1. Try fresh cache
  const cached = await readCache();
  if (cached) {
    // Trigger a background refresh so next cold-start gets latest
    fetchRemoteCatalog().then((fresh) => {
      if (fresh) writeCache(fresh);
    });
    return cached.map(buildAgent);
  }

  // 2. Try network
  const remote = await fetchRemoteCatalog();
  if (remote) {
    await writeCache(remote);
    return remote.map(buildAgent);
  }

  // 3. Bundled fallback
  return PREDEFINED_AGENTS;
}

/** Invalidate the local cache — forces a fresh fetch on next getCatalogAgents() call */
export async function invalidateCatalogCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
