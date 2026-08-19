# Roadmap — Living Memory

**עודכן:** 2026-08-19
**בסיס:** קוד נוכחי, 532 בדיקות עוברות ובדיקת משתמש בזמן אמת

מקרא:

- ✅ הושלם ומאומת
- 🟡 חלקי או דורש הקשחה
- ⛔ טרם התחיל

## תמונת מצב

Living Memory כבר אינה רק תשתית או TTS כללי. קיים מסלול פעיל מקצה לקצה של תוכן מאושר → Chat → קול אישי → אווטאר D‑ID בזמן אמת עם lip sync ודיבור מדורג.

הפער המרכזי עבר מ״האם אפשר לגרום לזה לעבוד״ ל״כיצד להפוך את זה לחוויה רציפה, בטוחה ומוכנה לפרודקשן״.

## Phase 0 — אפיון, גבולות והסכמה

**סטטוס: 🟡**

הושלם:

- מטרת מוצר וגבול בין AI לבין האדם.
- disclosures בממשק.
- `ConsentRecord` והסכמה להפעלת קול/אווטאר.
- הפרדה בין קול, קלט קולי ואווטאר.

נותר:

- הכרעת Product: גימיק רגשי קצר מול זיכרון ביוגרפי עמוק.
- מדיניות משפטית לקול, פנים, מורשים לאחר פטירה וקטינים.
- retention, ביטול הסכמה ומחיקה אצל ספקים.
- מדיניות שימוש לרעה ודיווח.

## Phase 1 — יסודות ותשתית

**סטטוס: ✅**

- npm workspaces, React/Vite, Express ו־ES Modules.
- RTL, proxy, lint, tests, build ו־health endpoint.
- env validation, structured logs, request IDs ו־central errors.
- MongoDB startup/shutdown.
- SRV DNS fallback ממוקד שנבדק ברשת בעייתית.

נותר ל־Production: Helmet, CORS סופי, distributed limits, monitoring ו־static serving.

## Phase 2 — Authentication

**סטטוס: 🟡 מתקדם**

הושלם: Argon2id, access/refresh tokens, httpOnly cookie, rotation, reuse detection, session families, logout ושחזור session.

נותר: password reset, email verification, login limits, session UI, audit events, Google OAuth ו־CSRF review.

## Phase 3 — פרופילי זיכרון והרשאות

**סטטוס: 🟡 מתקדם**

הושלם: כמה פרופילים, CRUD בסיסי, ארכוב, owner boundary, memberships, roles ומטריצת הרשאות.

נותר: shared memories, member-aware profile access, role-aware UI, owner protections ומחיקת גרף משאבים.

## Phase 4 — הזמנות ושיתוף

**סטטוס: ⛔**

- invitation model ו־token hash.
- expiration, acceptance, cancellation ו־resend.
- יצירת membership ושינוי תפקיד.
- audit trail ו־UI.

## Phase 5 — תוכן ותרומות

**סטטוס: 🟡 מתקדם**

הושלם: סיפורים, שאלון ביוגרפי, תמלילים, אישור מקורות ומקור יצירתי מה־Chat.

נותר: review workflow, `PENDING_REVIEW`, `REJECTED`, מניעת self-approval, reason, version history, metadata ו־pagination.

## Phase 6 — Knowledge ו־RAG

**סטטוס: 🟡 grounding לקסיקלי פעיל**

הושלם: Source Providers, תוכן מאושר בלבד, chunking בסיסי, דירוג לקסיקלי, context limits ובידוד לפי `memoryId`.

נותר:

- `KnowledgeChunk` ו־semantic chunking.
- embedding provider/model version.
- vector index ו־hybrid retrieval.
- indexing/re-indexing/deletion jobs.
- isolation tests לאינדקס.

## Phase 7 — Chat מבוסס מקורות

**סטטוס: 🟡 פעיל מקצה לקצה**

הושלם: conversations, messages, pagination, OpenAI Responses API, structured output, citations, filtering, prompt safety, creative mode, rate limits ו־UI.

נותר: `VERIFIED | INFERRED | UNKNOWN`, `uncertaintyReason`, usage/cost records, reporting ו־Client E2E.

## Phase 8 — הקלטות, קבצים ותמלול

**סטטוס: 🟡 פעיל אך מקומי**

הושלם: upload, format/signature checks, private storage, SHA-256, OpenAI transcription, review ואישור grounding.

נותר: cloud object storage, playback/download מלא, archive/delete, retention, orphan cleanup, malware scan ו־queues.

## Phase 9 — קול אישי וקלט קולי

**סטטוס: ✅ MVP פעיל; 🟡 הקשחת Production**

הושלם:

- General AI TTS.
- `VoiceProvider`, `VoiceProfile` ו־mock provider.
- ElevenLabs custom cloned voice.
- הסכמה והפעלה מפורשת.
- microphone input, upload ותמלול לשיחה.
- playback, stop, cleanup ו־fallback.

נותר:

- barge-in מלא.
- streaming STT ושיחה hands-free.
- cache ומדיניות שמירת אודיו.
- provider-side deletion מאומת.
- מדידת latency ועלות.

## Phase 10 — אווטאר ושיחה חיה

**סטטוס: ✅ MVP פעיל ומאומת; 🟡 רציפות**

הושלם:

- `AvatarProvider`, `AvatarProfile` ו־mock provider.
- D‑ID profile/provider ו־Client SDK.
- MediaStream חי ו־lip sync.
- קול אישי המוזן ל־D‑ID.
- fallback לווידאו מוכן, קול מקומי או תמונה.
- release tokens וניקוי realtime audio.
- שמירת הווידאו מוצג בין מקטעים.

אימות 2026-08-19:

- תחילת דיבור סביב 8 שניות.
- וידאו ושפתיים תקינים לאורך תשובה ארוכה.
- המשך מעבר למשפט הראשון.
- אין חזרה לתמונת הרקע בין המקטעים לאחר התיקון.

המשימה הפעילה הבאה:

1. לצמצם את הפסקת השמע שנמדדה בכ־3 שניות בין מקטעים.
2. למדוד `message sent → first audio`, `chunk end → next chunk start` ושיעור fallback.
3. להוסיף stop/barge-in ולבדוק כמה שאלות רצופות.
4. להוסיף E2E עם mock SDK ואחריו smoke test אמיתי מבוקר.

## Phase 11 — Jobs ו־עיבוד אסינכרוני

**סטטוס: ⛔**

- queue, workers, retries ו־dead-letter.
- progress events.
- persistence ל־avatar jobs ולמשאבים זמניים בפריסה מרובת מופעים.
- cleanup מתוזמן.

## Phase 12 — מנהל מערכת

**סטטוס: ⛔**

קיים רק `systemRole: admin`. נדרשים routes/UI לניהול משתמשים, הסכמות, ספקים, abuse, audit ו־suspension, בלי להעניק גישה אוטומטית לתוכן פרטי.

## Phase 13 — פרטיות ואבטחה מתקדמת

**סטטוס: 🟡 בסיס טוב**

נותר: Helmet, global limits, audit log, export, complete deletion, retention, provider deletion, incident monitoring, spend controls ו־legal review.

כלל תפעולי: אין לשתף `.env`, Authorization headers, cookies או refresh tokens. חשיפה מחייבת ביטול והחלפה.

## Phase 14 — UX ונגישות

**סטטוס: 🟡**

קיים: RTL, responsive CSS, states, ARIA בסיסי, reduced motion, citations, disclosure ומצבי שיחה חיה.

נותר: role-aware UI, consent management, accessibility audit, automated a11y, mobile matrix ושיחת hands-free.

## Phase 15 — Production

**סטטוס: ⛔**

- deployment ו־CI/CD.
- cloud storage ו־queue.
- monitoring, alerts ו־backups.
- secrets management ו־TLS/domain.
- distributed rate limiting.
- production smoke/E2E tests.
- privacy/legal documents וניהול עלויות.

## סדר עבודה מומלץ

1. **רציפות השיחה החיה** — הפסקות, barge-in, מדדים ו־E2E.
2. **הסכמה ומחיקה** — lifecycle מלא גם אצל ElevenLabs ו־D‑ID.
3. **הכרעת Product** — גימיק מול זיכרון ביוגרפי עמוק.
4. **סגירת MVP שיתופי** — invitations, memberships ו־review workflow.
5. **RAG אמיתי** — embeddings, index ו־jobs.
6. **Production foundation** — cloud storage, queues, observability ואבטחה.
