import { checkSafety } from '../safety-filter';

describe('Safety Filter', () => {
  describe('Crisis & Self-Harm Detection', () => {
    it('blocks suicide keyword', () => {
      const result = checkSafety('I want to kill myself');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });

    it('blocks self-harm keywords', () => {
      const result = checkSafety('I am cutting myself');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });

    it('blocks overdose reference', () => {
      const result = checkSafety('I took an overdose');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });

    it('allows normal emotional discussion', () => {
      expect(checkSafety('I am feeling sad today').isSafe).toBe(true);
    });
  });

  describe('Medical Advice Detection', () => {
    it('blocks diagnosis request', () => {
      const result = checkSafety('Can you diagnose my symptoms?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('MEDICAL');
    });

    it('blocks medication question', () => {
      const result = checkSafety('What medication should I take?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('MEDICAL');
    });

    it('allows health lifestyle discussion', () => {
      expect(checkSafety('How can I build a healthier routine?').isSafe).toBe(true);
    });
  });

  describe('Legal Advice Detection', () => {
    it('blocks legal action question', () => {
      const result = checkSafety('Should I sue my employer?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('LEGAL');
    });

    it('blocks custody question', () => {
      const result = checkSafety('How do I handle custody?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('LEGAL');
    });

    it('allows personal values discussion', () => {
      expect(checkSafety('How can I be a better partner?').isSafe).toBe(true);
    });
  });

  describe('Financial Advice Detection', () => {
    it('blocks investment advice request', () => {
      const result = checkSafety('Should I invest in Bitcoin?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('FINANCIAL');
    });

    it('blocks mortgage advice request', () => {
      const result = checkSafety('What mortgage should I get?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('FINANCIAL');
    });

    it('allows financial wellness discussion', () => {
      expect(checkSafety('How can I save more money?').isSafe).toBe(true);
    });
  });

  describe('Abuse & Safeguarding Detection', () => {
    it('blocks domestic abuse disclosure', () => {
      const result = checkSafety('I am experiencing domestic abuse');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('ABUSE_SAFEGUARDING');
    });

    it('blocks child abuse disclosure', () => {
      const result = checkSafety('There is child abuse happening at home');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('ABUSE_SAFEGUARDING');
    });
  });

  describe('Illegal Activity Detection', () => {
    it('blocks fraud question', () => {
      const result = checkSafety('How do I commit fraud?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('ILLEGAL_ACTIVITY');
    });

    it('blocks theft question', () => {
      const result = checkSafety('How do I steal without getting caught?');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('ILLEGAL_ACTIVITY');
    });
  });

  describe('Word-boundary false-positive prevention', () => {
    it('does not flag "hate" inside "whatever"', () => {
      expect(checkSafety('whatever works for you').isSafe).toBe(true);
    });

    it('does not flag "hate" inside "advocate"', () => {
      expect(checkSafety('I advocate for kindness').isSafe).toBe(true);
    });

    it('still catches standalone "hate"', () => {
      expect(checkSafety('I hate everything').isSafe).toBe(false);
    });
  });

  describe('Unicode normalization (NFKC bypass prevention)', () => {
    it('catches fullwidth suicide keyword', () => {
      const result = checkSafety('I want to ｓｕｉｃｉｄｅ');
      expect(result.isSafe).toBe(false);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });
  });

  describe('Edge cases', () => {
    it('is case-insensitive', () => {
      expect(checkSafety('SUICIDE').isSafe).toBe(false);
    });

    it('handles mixed case', () => {
      expect(checkSafety('SuIcIdE').isSafe).toBe(false);
    });

    it('allows empty string', () => {
      expect(checkSafety('').isSafe).toBe(true);
    });

    it('handles very long messages', () => {
      const longMessage = 'a'.repeat(10000) + ' suicide ' + 'b'.repeat(10000);
      expect(checkSafety(longMessage).isSafe).toBe(false);
    });
  });

  describe('Performance', () => {
    it('checks a message in under 50ms', () => {
      const start = Date.now();
      checkSafety('I want to talk about my feelings');
      expect(Date.now() - start).toBeLessThan(50);
    });

    it('handles many checks in under 100ms', () => {
      const messages = [
        'I feel sad',
        'I want to die',
        'How do I build habits?',
        'Can you diagnose me?',
      ];
      const start = Date.now();
      messages.forEach((msg) => checkSafety(msg));
      expect(Date.now() - start).toBeLessThan(100);
    });
  });
});
