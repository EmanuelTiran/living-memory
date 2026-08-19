# Architecture — Living Memory

**עודכן:** 2026-08-19

## סגנון ארכיטקטוני

Living Memory בנויה כ־Modular Monolith בתוך npm monorepo. הקוד הוא JavaScript ו־ES Modules.

Workspaces:

- `client` — React 19, Vite, React Router וממשק RTL.
- `server` — Express 5 REST API, Mongoose ושילובי ספקים.
- `shared` — constants וחוזים בטוחים המשותפים לשני הצדדים.

## זרימת בקשה בפיתוח

1. הדפדפן פונה לנתיב יחסי תחת `/api`.
2. Vite מעביר את הבקשה ל־Express המקומי.
3. Express מאמת authentication, הרשאה, params/body ו־rate limit.
4. השירות העסקי פונה ל־MongoDB או לספק חיצוני.
5. התגובה מוחזרת באותו origin דרך Vite.

רכיבי React אינם מכילים כתובות localhost או production API קשיחות.

## מבנה השרת

היכולות העסקיות נמצאות תחת `server/src/modules`:

- `auth` — משתמשים, sessions, access/refresh tokens.
- `memories` — פרופילים, memberships, סיפורים וביוגרפיה.
- `media` — הקלטות, קבצים פרטיים ותמלול.
- `chat` — שיחות, הודעות, retrieval וקלט קולי.
- `voice` — TTS, קול אישי וחלוקת תשובות למקטעים.
- `digitalPersona` — הסכמה, VoiceProfile, AvatarProfile ו־D‑ID.

תשתיות רוחב נמצאות תחת `config`, `middleware`, `platform`, `utils` ו־`workers` לפי הצורך.

## גבול אבטחה והרשאות

`MemoryProfile` הוא גבול ההרשאה המרכזי. פעולות במשאב השייך לזיכרון חייבות לבדוק גם את מזהה המשאב וגם `memoryId` מורשה.

- system roles נפרדים מ־memory roles.
- refresh token נשמר ב־httpOnly cookie; access token מוחזק בזיכרון הלקוח.
- קבצי מדיה נשמרים מחוץ ל־MongoDB עם מפתחות אקראיים ו־checksum.
- תשובות AI וקובצי קול מוחזרים עם `private, no-store`.
- אסור להדפיס או לתעד secrets, cookies, Authorization headers או URLs חתומים.

## Knowledge ו־Chat

ה־Chat משתמש רק במקורות מאושרים: סיפורים, תשובות ביוגרפיות ותמלילים בעלי הרשאת grounding.

ה־retrieval הנוכחי הוא לקסיקלי:

1. Source Providers טוענים מועמדים בתוך אותו `memoryId`.
2. השאלה מפורקת למונחים ומקבלת ניקוד מול כותרת ותוכן.
3. נבחרים עד שישה מקורות תחת מגבלת context.
4. OpenAI Responses API מחזיר תשובה מובנית וסיווג.
5. השרת מסנן citation IDs שלא נכללו במקורות שנשלחו למודל.

Vector search, embeddings ו־indexing jobs עדיין אינם קיימים.

## שיחה קולית ואווטאר בזמן אמת

הזרימה הפעילה:

1. תשובת Assistant נשמרת במסד.
2. `speechChunking` מחלק תשובה ארוכה בגבולות משפט/מילה, עד שישה מקטעים.
3. המקטע הראשון קצר ומוכן ראשון; המקטע הבא מופק מראש בזמן שהנוכחי מושמע.
4. ElevenLabs מפיק את הקול האישי המאושר.
5. השרת מעביר ל־D‑ID כתובת אודיו זמנית ומוגנת באמצעות release token.
6. D‑ID Client SDK מזרים `MediaStream` לדפדפן ומסנכרן שפתיים.
7. הלקוח משמיע את האודיו המקומי ושומר את זרם הווידאו מוצג גם בהמתנה בין מקטעים.
8. לאחר שימוש, הלקוח שולח `DELETE /realtime-audio/:token` והשרת משחרר את המשאב.

נתיבים עיקריים:

- `POST .../messages/:messageId/speech`
- `POST .../messages/:messageId/realtime-avatar-speech`
- `POST .../messages/:messageId/realtime-avatar-speech/chunks/:chunkIndex`
- `DELETE .../realtime-audio/:realtimeAudioToken`
- `POST .../voice-input/transcription`

Fallbacks:

- כשל בשידור החי אינו מבטל את הטקסט או הקול המקומי.
- כשל במסלול המדורג מחזיר למסלול המלא הקודם.
- עצירה או מעבר הודעה מבטלים רצפים ישנים ומשחררים Object URLs ומשאבים זמניים.

## Digital Persona והסכמה

`ConsentRecord`, `VoiceProfile` ו־`AvatarProfile` מפרידים בין הסכמה לבין פרטי הספק. הפעלת קול אישי, קלט קולי ואווטאר דורשת setup מאושר. ביטול הסכמה הוא פעולה מפורשת; מחיקה מלאה אצל כל ספק עדיין דורשת השלמה.

## MongoDB ו־DNS

השרת מתחבר ל־MongoDB לפני פתיחת HTTP. `mongodbDnsResolver` משתמש ב־DNS הרגיל, ורק כאשר שאילתת SRV נכשלת ב־`ECONNREFUSED` הוא מפעיל DNS חלופי לתהליך Node ומנסה את החיבור האמיתי. הגדרות Windows ו־Atlas אינן משתנות.

## מצב ויעד Production

כיוון היעד הוא origin יחיד שבו Express מגיש את build הלקוח. לפני Production נדרשים cloud object storage, queue/workers, persistence למשאבים זמניים, distributed rate limiting, monitoring, backups, secrets management, מדיניות CORS/Helmet ומסמכי פרטיות והסכמה.
