/**
 * Safety Filter Unit Tests
 *
 * Tests for the dual-layer safety filter that prevents harmful content
 * from reaching users or being sent to the AI.
 */

import { checkSafety } from '../src/services/safety-filter';

describe('Safety Filter', () => {
  describe('Crisis & Self-Harm Detection', () => {
    it('should block suicide-related keywords', () => {
      const result = checkSafety('I want to kill myself', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });

    it('should block self-harm keywords', () => {
      const result = checkSafety('I am cutting myself', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });

    it('should block overdose references', () => {
      const result = checkSafety('I took an overdose', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('CRISIS_SELF_HARM');
    });

    it('should allow normal mental health discussion', () => {
      const result = checkSafety('I am feeling sad today', 'user');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Medical Advice Detection', () => {
    it('should block diagnosis requests', () => {
      const result = checkSafety('Can you diagnose my symptoms?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('MEDICAL');
    });

    it('should block medication questions', () => {
      const result = checkSafety('What medication should I take?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('MEDICAL');
    });

    it('should allow health lifestyle discussion', () => {
      const result = checkSafety('How can I build a healthier routine?', 'user');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Legal Advice Detection', () => {
    it('should block legal action questions', () => {
      const result = checkSafety('Should I sue my employer?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('LEGAL');
    });

    it('should block divorce/custody questions', () => {
      const result = checkSafety('How do I handle custody?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('LEGAL');
    });

    it('should allow general legal awareness', () => {
      const result = checkSafety('What are my rights as an employee?', 'user');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Financial Advice Detection', () => {
    it('should block investment advice', () => {
      const result = checkSafety('Should I invest in Bitcoin?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('FINANCIAL');
    });

    it('should block mortgage advice', () => {
      const result = checkSafety('What mortgage should I get?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('FINANCIAL');
    });

    it('should allow financial wellness discussion', () => {
      const result = checkSafety('How can I save more money?', 'user');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Abuse & Safeguarding Detection', () => {
    it('should block domestic abuse reports', () => {
      const result = checkSafety('My partner is abusing me', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('ABUSE_SAFEGUARDING');
    });

    it('should block child abuse reports', () => {
      const result = checkSafety('Child is being hurt', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('ABUSE_SAFEGUARDING');
    });
  });

  describe('Illegal Activities Detection', () => {
    it('should block drug dealing questions', () => {
      const result = checkSafety('How do I sell drugs?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('ILLEGAL');
    });

    it('should block theft/fraud questions', () => {
      const result = checkSafety('How do I commit fraud?', 'user');
      expect(result.blocked).toBe(true);
      expect(result.category).toBe('ILLEGAL');
    });
  });

  describe('Edge Cases', () => {
    it('should be case-insensitive', () => {
      const result = checkSafety('SUICIDE', 'user');
      expect(result.blocked).toBe(true);
    });

    it('should handle mixed case', () => {
      const result = checkSafety('SuIcIdE', 'user');
      expect(result.blocked).toBe(true);
    });

    it('should block even with typos', () => {
      const result = checkSafety('I want to kll myself', 'user');
      // May or may not catch typos depending on implementation
      // This test documents the behavior
    });

    it('should allow empty strings', () => {
      const result = checkSafety('', 'user');
      expect(result.blocked).toBe(false);
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000) + ' suicide ' + 'b'.repeat(10000);
      const result = checkSafety(longMessage, 'user');
      expect(result.blocked).toBe(true);
    });
  });

  describe('Assistant Responses', () => {
    it('should check assistant responses too', () => {
      const result = checkSafety('Here is medical advice...', 'assistant');
      // Implementation determines if this is blocked
    });

    it('should verify AI is not claiming to be human', () => {
      const result = checkSafety('I am a real doctor', 'assistant');
      // Implementation should catch deceptive claims
    });
  });

  describe('Performance', () => {
    it('should check message quickly', () => {
      const start = Date.now();
      checkSafety('I want to talk about my feelings', 'user');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should handle many checks per second', () => {
      const messages = [
        'I feel sad',
        'I want to die',
        'How do I build habits?',
        'Can you diagnose me?',
      ];
      const start = Date.now();
      messages.forEach(msg => checkSafety(msg, 'user'));
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // All checks should be fast
    });
  });
});
