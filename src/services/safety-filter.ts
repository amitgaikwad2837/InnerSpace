/**
 * Safety Filter Rules
 * 
 * 7 hard rules that trigger immediate redirection.
 * No exceptions. No engagement with the topic.
 */

export const SAFETY_RULES = {
  CRISIS_SELF_HARM: {
    keywords: [
      'suicide',
      'suicidal',
      'kill myself',
      'end my life',
      "don't want to live",
      'self harm',
      'self-harm',
      'cutting myself',
      'hurt myself',
      'overdose',
      'nobody would miss me',
      'better off without me',
      'want to die',
    ],
    message: `I hear that you're going through something really difficult. 
You're not alone, and there are people trained to help.

Call 988 (US) · 116 123 (UK) · Text HOME to 741741

Please reach out to someone right now. You deserve support.`,
  },

  MEDICAL: {
    keywords: [
      'diagnose',
      'diagnosis',
      'my symptoms',
      'what medication',
      'should i take',
      'drug interaction',
      'dosage',
      'side effects',
      'is this serious',
      'diagnosed with',
      'prescription',
    ],
    message: `That's something a doctor or pharmacist is the right person to help with — 
I'm not qualified to give medical guidance. 
Is there something else I can support you with today?`,
  },

  LEGAL: {
    keywords: [
      'legal rights',
      'should i sue',
      'contract',
      'legal action',
      'custody',
      'divorce',
      'employment law',
      'solicitor',
      'attorney',
      'court',
    ],
    message: `I can hear this is stressful. For legal questions, a solicitor or 
Citizens Advice is the right place to go. 

Is there something else I can help you think through?`,
  },

  FINANCIAL: {
    keywords: [
      'invest in',
      'stocks',
      'cryptocurrency',
      'bitcoin',
      'mortgage',
      'should i buy',
      'should i sell',
      'debt',
      'tax advice',
      'pension',
    ],
    message: `I can help you think through what matters to you around money, 
but for specific financial decisions a financial adviser is the right person to talk to.`,
  },

  ABUSE_SAFEGUARDING: {
    keywords: [
      'domestic abuse',
      'being abused',
      'hit me',
      'violence',
      'threatening',
      'scared of',
      'child abuse',
      'child hurt',
      'bruises',
      'unsafe',
    ],
    message: `I'm so glad you reached out. You deserve to be safe.

UK: 0808 2000 247 · US: 1-800-799-7233

Please contact a safety service right now. You're not alone.`,
  },

  POLITICAL_RELIGIOUS: {
    keywords: [
      'vote for',
      'which party',
      'political party',
      'religion true',
      'which religion',
      'is abortion',
      'immigration',
      'which candidate',
    ],
    message: `That's a really personal question and I don't think it's my place 
to influence your views on this. What I can do is help you think 
through what matters to you personally.`,
  },

  HATEFUL_DIVISIVE: {
    keywords: [
      'hate',
      'racist',
      'sexist',
      'discriminat',
      'offensive',
    ],
    message: `I'm here to support growth and kindness. I can't engage with that topic, 
but I'm happy to help you with something constructive.`,
  },

  ADULT_CONTENT: {
    keywords: [
      'porn',
      'XXX',
      'explicit sexual',
      'hardcore',
      'nsfw',
      'adult video',
      'nude',
      'naked',
      'sex work',
      'escort',
      'prostitut',
      'fetish',
      'erotic',
      'climax',
      'orgasm',
      'sexual content',
      'adult content',
      'explicit',
      'obscene',
      'lewd',
      'sexually explicit',
    ],
    message: `InnerSpace is not designed for adult or explicit content. 
I'm here to support your personal growth, wellbeing, and decision-making in a respectful way.

Is there something else I can help you with?`,
  },

  ILLEGAL_ACTIVITY: {
    keywords: [
      'how to hack',
      'steal',
      'fraud',
      'counterfeit',
      'money laundering',
      'bomb',
      'explosives',
      'make bombs',
      'manufacturing drugs',
      'cook meth',
      'how to hack',
      'sql injection',
      'phishing',
      'ransomware',
      'malware',
      'identity theft',
      'credit card fraud',
      'forgery',
    ],
    message: `I can't provide guidance on illegal activities. These are serious crimes that harm others.

If you're facing pressure to do something illegal, or struggling with something that led you here, there are support services available.

Is there something legal and constructive I can help with instead?`,
  },

  DRUG_ABUSE: {
    keywords: [
      'make drugs',
      'manufacture heroin',
      'cook crystal meth',
      'synthesize cocaine',
      'how to use',
      'best way to inject',
      'overdose on',
      'drug recipe',
      'get high',
      'fentanyl',
      'how to obtain illegal drugs',
    ],
    message: `I can't help with drug use or manufacturing. If you or someone you know is struggling with substance use, support is available.

SAMHSA Helpline: 1-800-662-4357 (free, confidential, 24/7, US)
Or contact a local addiction service.

Is there something else I can help with?`,
  },

  EATING_DISORDERS: {
    keywords: [
      'pro-ana',
      'pro-mia',
      'thin inspiration',
      'thinspo',
      'eating disorder tips',
      'how to restrict',
      'how to purge',
      'calorie restriction methods',
      'avoid eating',
      'eating disorder encouragement',
    ],
    message: `Eating disorders are serious health conditions. I can't provide tips or encouragement for disordered eating.

If you're struggling, support is available:
- BEAT Eating Disorders (UK): 0808 801 0677
- National Association of Anorexia Nervosa (US): 1-888-375-7767

You deserve care and recovery. Please reach out.`,
  },

  CHILD_SAFETY: {
    keywords: [
      'child exploitation',
      'child abuse material',
      'CSAM',
      'groom a child',
      'child predator',
      'underage',
      'children in sexual',
      'how to abuse children',
      'child endangerment',
    ],
    message: `I cannot engage with content involving harm to children. This is illegal and deeply harmful.

If you're aware of child exploitation:
- UK: National Crime Agency (NCMEC)
- US: CyberTipline.org
- Global: INTERPOL

If you're having thoughts about harming children, please seek professional help immediately.`,
  },

  VIOLENCE_WEAPONS: {
    keywords: [
      'how to make a gun',
      'build a bomb',
      'make explosives',
      'kill someone',
      'how to poison',
      'weapon instructions',
      'make a knife',
      'how to stab',
      'torture methods',
      'mass shooting',
      'how to commit murder',
    ],
    message: `I cannot provide instructions for violence or weapons. These cause real harm.

If you're having thoughts of harming yourself or others, please reach out immediately:
- US: 988 (Suicide & Crisis Lifeline)
- UK: 116 123 (Samaritans)
- Global: Crisis Text Line, findahelpline.com

You matter. Help is available.`,
  },

  DANGEROUS_MISINFORMATION: {
    keywords: [
      'vaccines cause autism',
      'vaccine microchip',
      'essential oils cure cancer',
      'homeopathy cures everything',
      'colloidal silver heals',
      'drinking bleach cures',
      'covid is a hoax',
      'vaccines are poison',
      'health scam',
      'fake cure',
      'miracle cure',
    ],
    message: `I can't share health misinformation. This can cause real harm.

For health information, trust:
- NHS (UK)
- CDC (US)
- WHO (Global)
- Your doctor or pharmacist

Is there something evidence-based I can help with?`,
  },

  CYBERBULLYING: {
    keywords: [
      'how to doxx someone',
      'find someones address',
      'publish private information',
      'expose someones secrets',
      'harass online',
      'how to cyberbully',
      'send hate messages',
      'coordinate harassment',
      'revenge porn',
      'leak someones photos',
    ],
    message: `Cyberbullying and harassment are harmful and often illegal. I can't help with this.

If you're experiencing harassment:
- Report to the platform (Twitter, Instagram, etc.)
- Contact local police if threats are made
- Reach out to a trusted adult or counselor

If you're struggling with anger toward someone, I can help you work through that constructively.`,
  },

  EXTREMISM: {
    keywords: [
      'extremist ideology',
      'radicalization',
      'join a cult',
      'white supremacist',
      'nazi ideology',
      'isis recruitment',
      'terrorist organization',
      'extremist recruitment',
      'indoctrination',
    ],
    message: `I can't engage with extremist ideology or help with radicalization.

If you're being recruited or feeling pressured:
- Life After Hate (liftedhope.org) — deradicalization support
- Exit programs available in most countries
- Talk to someone you trust

If you've had harmful thoughts, speaking with a counselor can help you find a healthier path.`,
  },
};

function matchesKeyword(normalizedMessage: string, keyword: string): boolean {
  const nk = keyword.normalize('NFKC').toLowerCase();
  // Multi-word phrases and hyphenated terms: substring match
  if (nk.includes(' ') || nk.includes('-')) return normalizedMessage.includes(nk);
  // Single tokens: require a word boundary at the start to prevent substring false positives
  // e.g. "stocks" in "Goldilocks", "hate" in "whatever", "court" in "courtship"
  const escaped = nk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}`, 'u').test(normalizedMessage);
}

export function checkSafety(userMessage: string): {
  isSafe: boolean;
  redirectMessage: string | null;
  category: string | null;
} {
  const normalized = userMessage.normalize('NFKC').toLowerCase();

  for (const [category, rule] of Object.entries(SAFETY_RULES)) {
    const triggered = rule.keywords.some((keyword) => matchesKeyword(normalized, keyword));
    if (triggered) {
      return {
        isSafe: false,
        redirectMessage: rule.message,
        category,
      };
    }
  }

  return { isSafe: true, redirectMessage: null, category: null };
}

export function containsAdultContent(text: string): boolean {
  const normalized = text.normalize('NFKC').toLowerCase();
  const adultKeywords = SAFETY_RULES.ADULT_CONTENT?.keywords || [];
  return adultKeywords.some((keyword) => matchesKeyword(normalized, keyword));
}

