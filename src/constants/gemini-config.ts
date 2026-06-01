export const GEMINI_CONFIG = {
  // Default Gemini API endpoint
  API_BASE: 'https://generativelanguage.googleapis.com/v1beta',
  
  // Model to use
  MODEL: 'gemini-1.5-flash',
  
  // Temperature for more deterministic responses
  TEMPERATURE: 0.7,
  
  // Max tokens per response
  MAX_TOKENS: 1024,
};

// Gemini free tier limits (as of 2026)
export const GEMINI_RATE_LIMITS = {
  // Requests per minute
  RPM: 60,
  
  // Tokens per minute
  TPM: 4000,
};
