# מצב הפרויקט — Living Memory

**עודכן לאחרונה:** 2026-08-19
**מקור:** קוד נוכחי, 88 קובצי בדיקה, בדיקת build ובדיקות משתמש בזמן אמת
**מצב Git:** לא אומת
**מצב כללי:** vertical slice מתקדם ופועל מקצה לקצה, כולל שיחה מבוססת מקורות, קול אישי ואווטאר D‑ID בזמן אמת. המערכת עדיין אינה מוכנה ל־Production.

## מטרת המוצר

Living Memory היא מערכת עברית ו־RTL לשימור זיכרונות ומורשת ולהפיכתם לשיחה אינטראקטיבית. התשובות מבוססות ככל האפשר על חומרים שסופקו ואושרו.

המערכת אינה האדם עצמו, אינה משחזרת תודעה ואינה אמורה להציג הדמיה או השלמה יצירתית כעובדה היסטורית.

## Stack וארכיטקטורה

- npm monorepo: `client`, `server`, `shared`.
- JavaScript ו־ES Modules.
- React 19, Vite ו־React Router.
- Node.js `>=24.18.0 <25`, Express 5.
- MongoDB Atlas ו־Mongoose.
- Zod validation.
- Vitest ו־Supertest.
- Modular Monolith.
- API יחסי דרך Vite proxy בפיתוח.

## תשתית שרת

ממומש:

- env validation מרכזי.
- חיבור MongoDB לפני HTTP ו־graceful shutdown.
- request IDs, structured logging ו־error handler מרכזי.
- טיפול ב־JSON פגום ומגבלות גודל.
- rate limiters לפי יכולת.
- health endpoint.
- MongoDB SRV DNS fallback ממוקד ל־`querySrv ECONNREFUSED`.

חסר ל־Production:

- Helmet ומדיניות CORS סופית.
- global/distributed rate limiting.
- monitoring, alerting ו־centralized logs.
- production static-client serving מאומת.

## Authentication

ממומש:

- User, הרשמה ו־Login.
- Argon2id ושדרוג hash חלש.
- access token קצר מועד.
- refresh token אקראי הנשמר כ־SHA-256.
- httpOnly cookie, rotation, session families ו־reuse detection.
- logout, `/me`, שחזור session ומשתמש מושעה.
- `user` ו־`admin` כתפקידי מערכת נפרדים.

חסר:

- password reset ואימות email.
- login rate limiting ואירועי אבטחה.
- UI לניהול sessions ומשתמשים.
- Google OAuth.
- ניתוח CSRF מתועד ובדיקות ייעודיות.

## פרופילי זיכרון, Memberships ושיתוף

ממומש:

- כמה `MemoryProfile` לכל משתמש.
- יצירה, רשימה, צפייה, עריכה וארכוב.
- פרטיות כברירת מחדל.
- `MemoryMembership` עם viewer, contributor ו־editor.
- מטריצת הרשאות ושירות `requireMemoryPermission`.
- הסתרת משאב לא מורשה באמצעות 404 בטוח.

חסר:

- CRUD מלא לחברים ולהזמנות.
- שינוי תפקיד, הסרה, תפוגה והעברת בעלות.
- UI לשיתוף ורשימת shared memories.
- שימוש עקבי בהרשאה המרכזית בכל מודולי התוכן.
- מחיקה מלאה של גרף המשאבים.

## תוכן ומקורות

ממומש:

- סיפורי חיים: draft, approved, archived.
- עריכה המחזירה סיפור לטיוטה.
- שאלון ביוגרפי עם קטלוג 80 שאלות ו־revision.
- הקלטה ותמלול כטיוטה, עריכה ואישור כמקור.
- מקור ביוגרפי מתשובת Chat יצירתית עם קישור להודעת המקור.

חסר:

- `PENDING_REVIEW`, `REJECTED` ו־`INDEXED` מלאים.
- contribution review, מניעת self-approval ו־rejection reason.
- version history, audit metadata ו־pagination עקבית.

## Knowledge ו־Chat

ממומש:

- `ChatConversation` ו־`ChatMessage`.
- היסטוריה עם cursor pagination ועד 12 הודעות אחרונות כהקשר.
- מקורות מאושרים מסיפור, ביוגרפיה ותמלול.
- retrieval לקסיקלי ובחירת עד שישה מקורות.
- OpenAI Responses API עם Structured Output.
- citations, source-ID filtering והוראות נגד prompt injection.
- מצבי `grounded`, `inferred`, `general_knowledge`, `creative`, `insufficient_context`.
- creative workflow הנשמר כמקור רק בפעולה מפורשת.
- rate limiting, disclosure ו־fallback לחוסר מידע.

חסר:

- embeddings, vector index, indexing jobs ו־hybrid retrieval.
- חוזה היעד `VERIFIED | INFERRED | UNKNOWN` ו־`uncertaintyReason`.
- UsageRecord, עלויות, reporting ו־E2E tests.

## הקלטות ותמלול

ממומש:

- MP3, M4A, MP4, WAV ו־WebM עד 25MB.
- MIME/signature validation ונרמול AAC.
- אחסון פרטי מחוץ ל־MongoDB, מפתח אקראי ו־SHA-256.
- בדיקת שלמות, ניקוי buffers והסכמות נפרדות.
- OpenAI transcription, עריכה עם optimistic revision ואישור grounding.

מגבלות:

- אחסון filesystem מקומי בלבד.
- עיבוד סינכרוני ללא queue/worker.
- אין retention, orphan cleanup, archive/delete או cloud adapter מלאים.
- אין playback/download מלא להקלטה המקורית בכל הזרימות.

## קול, קלט קולי ואווטאר

ממומש:

- General AI TTS כ־MP3.
- `VoiceProvider`, `VoiceProfile` וספקי mock.
- קול אישי מאושר באמצעות ElevenLabs.
- קלט מיקרופון לשיחה, upload מוגבל ותמלול.
- `AvatarProvider`, `AvatarProfile` ו־D‑ID.
- `ConsentRecord`, הסכמה עצמית וביטולה.
- D‑ID Client SDK ו־MediaStream בזמן אמת.
- lip sync לקול האישי.
- דיבור ישיר מטקסט ומסלול אודיו אישי.
- חלוקה לעד שישה מקטעים; מקטע ראשון קצר והכנת המקטע הבא מראש.
- release tokens ושחרור משאבי realtime audio.
- fallback אוטומטי לטקסט/קול/אווטאר מקומי.
- שמירת זרם הווידאו מוצג בזמן המעבר בין מקטעים.

בדיקת משתמש מאומתת ב־2026-08-19:

- תחילת הדיבור סביב 8 שניות.
- הדיבור המשיך מעבר למשפט הראשון.
- הווידאו והשפתיים פעלו לאורך התשובה ובהתאם לקול.
- לאחר תיקון המעבר, תמונת הרקע אינה מחליפה את הווידאו בין המקטעים.

מגבלות:

- עדיין קיימת הפסקת שמע של כ־3 שניות בין מקטעים בתרחיש שנבדק.
- אין barge-in מלא או state machine של שיחת טלפון רציפה.
- אין cache ושמירת אודיו מתוכננים לפרודקשן.
- משאבי realtime/jobs זמניים דורשים persistence/coordination לפריסה מרובת מופעים.
- מחיקה וביטול אצל כל ספק דורשים השלמה ואימות.

## אבטחה ופרטיות

קיים:

- strict validation, scoped queries והרשאות שרת.
- ObjectId validation, private storage ו־path traversal protection.
- cookies מאובטחים בפרודקשן ו־refresh rotation.
- rate limiting ל־Chat, Speech, chunks וקלט קולי.
- safe errors, request IDs, source validation ו־AI disclosures.
- הסכמה נפרדת לקול, קלט קולי ואווטאר.

חסר:

- audit log, consent history מלאה ו־provider-side deletion מאומת.
- privacy export, retention ומחיקה מלאה.
- malware scanning, abuse reporting ו־incident monitoring.
- spend limits וניהול עלויות ספקים.
- בדיקה משפטית מלאה למדיניות קול ופנים.
- בדיקה ש־ADMIN אינו מקבל גישה אוטומטית לתוכן פרטי.

הערת תפעול: אין לשתף `.env`, Authorization headers, cookies או refresh tokens. לאחר חשיפה יש לבטל/להחליף את האישורים.

## ממשק משתמש

קיים:

- הרשמה, Login, Dashboard ופרופילי זיכרון.
- סיפורים, ביוגרפיה, הקלטה ותמלול.
- Chat עם citations, סיווג ו־creative mode.
- כפתורי קול, מיקרופון ושיחה חיה.
- אווטאר מקומי, וידאו D‑ID ומצבי loading/error/fallback.
- RTL, responsive CSS, ARIA בסיסי ו־reduced motion.

חסר:

- role-aware UI, שיתוף והזמנות.
- consent-management מלא וממשק מנהל.
- accessibility audit ובדיקות Client/E2E אוטומטיות.
- אימות מובייל רחב ושיחת hands-free רציפה.

## בדיקות

אומת ב־2026-08-19:

- 88 קובצי בדיקה עברו.
- 532 בדיקות עברו.
- ESLint עבר ללא warnings.
- Vite production build עבר.
- בדיקת משתמש לשיחה חיה עברה.

אין עדיין בדיקות E2E לדפדפן עבור רצף קול + D‑ID, וכן חסרות בדיקות לזרימות שיתוף, הזמנות, מחיקה ו־Production.

## הצעד הבא המומלץ

1. לצמצם או להעלים את הפסקת השמע בין המקטעים ולמדוד latency באופן מובנה.
2. להוסיף stop/barge-in אמין ולבדוק רצף של כמה שאלות ללא רענון.
3. להוסיף E2E לשיחה החיה ול־fallbacks.
4. לאחר ייצוב חוויית השיחה, לחזור לסגירת Memberships/Invitations/RAG או לבחור במפורש מסלול Product אחר.
