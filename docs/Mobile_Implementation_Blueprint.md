# InnerSpace Mobile — Implementation Blueprint

> **Status: Partially Stale**
> The architecture and phases here describe early design intent. The following items in this doc
> no longer match the actual implementation: Gmail OAuth (replaced by guest-first), SQLite (replaced
> by AsyncStorage only), React Native Paper (not used), NativeWind (not used).
> For the current verified state see docs/Mobile_Checkpoint_2026-05-31.md.

**Version:** 2.0 (Mobile Pivot)  
**Date:** 2026-05-31  
**Platform:** Expo React Native (iOS + Android)  
**Architecture:** Self-running, offline device-local data, Gemini API integration

---

## Phase Overview

| Phase | Duration | Focus | Outcome |
|---|---|---|---|
| Phase 0 | Days 1-2 | Mobile scaffold, folder structure, CI | Expo app runs on iOS/Android simulator |
| Phase 1 | Days 3-5 | Gmail auth, agent system, safety filter | Users can sign in, see agents, chat with safety rules |
| Phase 2 | Days 6-10 | Core modes (Chat, Habits, Reflect) | Full conversation + tracking + journaling |
| Phase 3 | Days 11-13 | Decide mode, custom agent creation | Full 4-mode experience + user-created agents |
| Phase 4 | Days 14-16 | BYOK settings, data export, hardening | Multi-provider support + safety red-team |
| Phase 5 | Days 17-19 | Polish, testing, release prep | App store ready |

---

## Core Technical Stack

| Layer | Technology | Justification |
|---|---|---|
| Platform | Expo SDK 56 (React Native) | iOS + Android from single codebase |
| State | Zustand | Lightweight, minimal boilerplate |
| Storage | AsyncStorage + SQLite | Queryable local data, chat history |
| Auth | Expo Google OAuth | Native Google sign-in, no backend needed |
| AI | Gemini API (free tier) | Direct integration, BYOK support in settings |
| Safety | Client-side keyword filter + system prompt | 7 hard rules enforced before API call |
| Navigation | React Navigation | Standard for React Native |
| UI Framework | React Native Paper | Material Design components |
| Styling | NativeWind (TailwindCSS for RN) | Rapid, consistent theming |

---

## Folder Architecture

```
src/
  screens/           # Main flow screens
    HomeScreen.tsx
    ChatScreen.tsx
    HabitsScreen.tsx
    ReflectScreen.tsx
    DecideScreen.tsx
    SettingsScreen.tsx
    AgentCreationScreen.tsx
    
  components/        # Reusable UI components
    AgentCard.tsx
    ChatBubble.tsx
    SafetyAlert.tsx
    HabitList.tsx
    
  services/          # Core business logic
    gemini-service.ts        # API calls with error handling
    safety-filter.ts         # 7-rule keyword safety check
    agent-service.ts         # Agent CRUD + predefined personas
    storage-service.ts       # AsyncStorage + SQLite
    
  hooks/             # Custom React hooks
    useAuth.ts
    useAgent.ts
    useConversation.ts
    useHabits.ts
    
  types/             # TypeScript interfaces
    index.ts
    
  store/             # Zustand state management
    auth.ts
    agents.ts
    conversations.ts
    habits.ts
    
  constants/         # Config, API keys, safety rules
    agents.ts        # Predefined agents
    safety-rules.ts  # 7 hard rules + redirect text
    gemini-config.ts
    
  utils/             # Helpers
    date.ts
    storage.ts
    validation.ts
    
app.tsx             # Root component
```

---

## Phase 0 Deliverables (Days 1-2)

### Scaffold & Folder Structure
- Expo app initialized with TypeScript
- Folder architecture in place
- CI pipeline (ESLint, TypeScript check, basic tests)

### Core Dependencies
```json
{
  "expo": "^56.0.0",
  "react-native": "^0.76.0",
  "expo-auth-session": "^5.4.0",
  "@react-navigation/native": "^6.1.0",
  "zustand": "^4.5.0",
  "@react-native-async-storage/async-storage": "^1.23.0",
  "sqlite": "^5.1.0",
  "react-native-paper": "^5.11.0",
  "nativewind": "^2.0.11"
}
```

### Exit Criteria
- App runs in simulator
- Folder structure matches specification
- TypeScript compilation passes
- First screen renders (home placeholder)

---

## Phase 1: Auth + Agent System (Days 3-5)

### Gmail OAuth Flow
1. User taps "Sign in with Google"
2. Native Google sign-in (via `expo-auth-session`)
3. JWT stored locally in AsyncStorage
4. Gemini API calls include bearer token from user's Gmail account

### Predefined Agents
Create 10 default agents with personas:
- Chef
- Handyman
- Botanist
- Fitness Coach
- Career Coach
- Parenting Coach
- Travel Advisor
- Home Organizer
- DIY Crafter
- Pet Trainer

Each agent has:
- Unique system prompt (personality, expertise)
- Icon/avatar
- Description
- Conversation history (stored locally)

### Safety Filter
- Runs before every Gemini call
- Checks user message for 7 hard-rule keywords
- If triggered, shows warm redirect (no API call)
- Logs safety event for analytics (local only)

---

## Phase 2: Core Modes (Days 6-10)

### Mode 1: Just Talk (Chat)
- Multi-turn conversation with selected agent
- User message → safety check → Gemini API → stream response
- Conversation history saved to SQLite
- Thumbs-down feedback button

### Mode 2: My Habits
- Create habit (name, category, target freq)
- One-tap daily completion
- Streak + XP calculation
- Weekly summary

### Mode 3: Reflect
- AI suggests journaling prompt (context-aware)
- User writes reflection
- AI generates insight
- Calendar history view

---

## Phase 3: Decide Mode + Custom Agents (Days 11-13)

### Mode 4: Decide
- 5-step structured decision framework
- Save/resume across sessions
- Clarity score self-rating
- Archive completed decisions

### Custom Agent Creation
- User describes desired expertise
- Safety validation (block harmful personas)
- System prompt generation + safety inherited
- New agent added to user's agent list

---

## Phase 4: Settings + BYOK (Days 14-16)

### Settings Page
- Gmail account info + sign out
- Manage Gemini free tier usage
- BYOK: Add OpenAI/Claude/Groq API keys
  - Keys encrypted before local storage
  - Masked display (last 4 chars only)
  - Test call validation
- Configure agent personality (warm/formal/direct)
- Data export (JSON) + local backup

---

## Phase 5: Polish + Launch (Days 17-19)

### Quality Gates
- Safety red-team: 35+ test inputs across 7 categories
- Performance: <2s home load, <3s API response
- Accessibility: Basic screen reader support
- iOS/Android device testing

### Pre-Launch
- App Store + Google Play submission
- Privacy policy + ToS in app
- Gemini API rate limit monitoring
- Sentry error tracking active

---

## Safety Rules (Embedded in Client)

### Rule 1: Crisis & Self-Harm
**Trigger:** suicide, self-harm, end my life, cutting, overdose, etc.  
**Response:** Immediate crisis line + warm care message  
```
I hear that you're going through something really difficult. 
You're not alone, and there are people trained to help.

Call 988 (US) · 116 123 (UK) · Text HOME to 741741

Please reach out to someone right now. You deserve support.
```

### Rule 2: Medical Diagnosis/Treatment
**Trigger:** symptoms, diagnosed, medication, dosage, should I take, etc.  
**Response:** Warm redirect to doctor/pharmacist  
```
That's something a doctor or pharmacist is the right person to help with — 
I'm not qualified to give medical guidance. 
Is there something else I can support you with today?
```

### Rule 3: Legal Advice
**Trigger:** rights, contract, legal action, custody, divorce, etc.  
**Response:** Warm redirect to solicitor/Citizens Advice  
```
I can hear this is stressful. For legal questions, a solicitor or 
Citizens Advice is the right place to go. 

Is there something else I can help you think through?
```

### Rule 4: Financial Advice
**Trigger:** invest, stocks, cryptocurrency, mortgage, debt, tax, etc.  
**Response:** Warm redirect to financial adviser  
```
I can help you think through what matters to you around money, 
but for specific financial decisions a financial adviser is the right person to talk to.
```

### Rule 5: Abuse/Safeguarding
**Trigger:** domestic abuse, violence, child at risk, threatening situation, etc.  
**Response:** Immediate emergency line + care message  
```
I'm so glad you reached out. You deserve to be safe.

UK: 0808 2000 247 · US: 1-800-799-7233

Please contact a safety service right now. You're not alone.
```

### Rule 6: Political/Religious
**Trigger:** vote for, which party, religion true, which religion, etc.  
**Response:** Neutral redirect to user's values  
```
That's a really personal question and I don't think it's my place 
to influence your views on this. What I can do is help you think 
through what matters to you personally.
```

### Rule 7: Divisive/Hateful
**Trigger:** Offensive stereotypes, hate speech, discrimination, etc.  
**Response:** Firm boundary with redirect  
```
I'm here to support growth and kindness. I can't engage with that topic, 
but I'm happy to help you with something constructive.
```

---

## Data Model (SQLite + AsyncStorage)

### users
```sql
id TEXT PRIMARY KEY
email TEXT
name TEXT
avatar_url TEXT
created_at TIMESTAMP
first_name TEXT
preferred_agent_tone TEXT (warm/direct/motivational)
```

### agents
```sql
id TEXT PRIMARY KEY
user_id TEXT
name TEXT
description TEXT
system_prompt TEXT
is_custom BOOLEAN
created_at TIMESTAMP
last_used TIMESTAMP
FOREIGN KEY (user_id) REFERENCES users(id)
```

### conversations
```sql
id TEXT PRIMARY KEY
user_id TEXT
agent_id TEXT
created_at TIMESTAMP
FOREIGN KEY (user_id) REFERENCES users(id)
FOREIGN KEY (agent_id) REFERENCES agents(id)
```

### messages
```sql
id TEXT PRIMARY KEY
conversation_id TEXT
role TEXT (user/assistant)
content TEXT
created_at TIMESTAMP
flagged BOOLEAN
FOREIGN KEY (conversation_id) REFERENCES conversations(id)
```

### habits
```sql
id TEXT PRIMARY KEY
user_id TEXT
name TEXT
frequency TEXT
created_at TIMESTAMP
FOREIGN KEY (user_id) REFERENCES users(id)
```

### habit_completions
```sql
id TEXT PRIMARY KEY
habit_id TEXT
completed_date DATE
FOREIGN KEY (habit_id) REFERENCES habits(id)
```

### journal_entries
```sql
id TEXT PRIMARY KEY
user_id TEXT
prompt TEXT
content TEXT
ai_insight TEXT
entry_date DATE
FOREIGN KEY (user_id) REFERENCES users(id)
```

---

## Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit tests | Jest | Safety filter logic, date calculations, validators |
| Integration | Jest | Storage read/write, agent CRUD, conversation save |
| E2E | Detox/Appium | Auth flow, chat completion, habit tracking |
| Safety | Manual | 35+ red-team inputs across 7 categories |

---

## Recovery & Checkpointing

**Before each phase:**
- Commit working code: `git commit -m "phase-X: deliverable Y"`
- Update docs/Execution_Checkpoints.md
- Update repository memory note

**If interrupted:**
1. Read Execution_Checkpoints.md for last completed phase
2. Read this blueprint for phase exit criteria
3. Resume from next uncompleted phase

---

## Go-Live Checklist

- [ ] All 7 safety rules pass red-team tests
- [ ] iOS + Android builds complete
- [ ] Accessibility audit passed
- [ ] Gemini rate limits documented + monitored
- [ ] Privacy policy live in app
- [ ] Terms of Service live in app
- [ ] Sentry error tracking active
- [ ] App Store + Google Play submitted
