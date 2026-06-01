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
};

export function checkSafety(userMessage: string): {
  isSafe: boolean;
  redirectMessage: string | null;
  category: string | null;
} {
  const lowerMessage = userMessage.toLowerCase();

  for (const [category, rule] of Object.entries(SAFETY_RULES)) {
    const triggered = rule.keywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );
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
