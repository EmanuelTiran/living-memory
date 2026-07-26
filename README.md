# זיכרון חי — Living Memory

אפליקציה לשימור סיפורי חיים, זיכרונות ומורשת משפחתית באמצעות מקורות שהמשתמשים מוסרים ומאשרים.

> המערכת מיועדת ליצור זיכרון אינטראקטיבי מבוסס AI. היא אינה האדם עצמו ואינה משחזרת את תודעתו.

## מצב הפרויקט

הפרויקט נמצא בסיום שלב 1 — הקמת יסודות הפיתוח.

התשתית הנוכחית כוללת:

- Monorepo עם npm workspaces.
- React ו־Vite בצד הלקוח.
- Express בצד השרת.
- JavaScript ו־ES Modules.
- ממשק עברי בכיוון RTL.
- ESLint מרכזי.
- בדיקות API באמצעות Vitest ו־Supertest.
- Health Check.
- Vite proxy עבור נתיבי `/api`.
- פקודת פיתוח משותפת ללקוח ולשרת.

## דרישות מערכת

- Node.js `>=24.18.0 <25`
- npm `>=10`
- Git

## התקנה

מתיקיית השורש של הפרויקט:

- הרץ `npm install`.
- העתק את `client/.env.example` אל `client/.env.local`.
- הרץ `npm run dev`.

לאחר ההפעלה:

- Client: `http://localhost:5173`
- API: `http://localhost:5000`
- Health דרך ה־Proxy: `http://localhost:5173/api/health`

## פקודות מרכזיות

- `npm run dev` — הפעלת הלקוח והשרת יחד.
- `npm run lint` — בדיקת ESLint.
- `npm test` — הרצת בדיקות השרת.
- `npm run build` — בניית גרסת Production של הלקוח.
- `npm run check` — הרצת lint, tests ו־build ברצף.

## מבנה הפרויקט

- `client` — אפליקציית React.
- `server` — REST API המבוסס על Express.
- `shared` — constants ו־contracts משותפים.
- `docs` — ארכיטקטורה, Roadmap ומצב הפרויקט.

## ארכיטקטורה

הפרויקט נבנה כ־Modular Monolith. מודולים עסקיים יתווספו בהדרגה לפי Vertical Slices, בלי ליצור תשתית שאינה נדרשת עדיין.

בפיתוח, Vite ו־Express רצים בנפרד. בפרודקשן מתוכנן Express להגיש את גרסת ה־Production של React מאותו Origin.

## השלב הבא

שלב 2 יוסיף MongoDB ותשתיות שרת מרכזיות, כולל טיפול בשגיאות, Request IDs, Logging בטוח ומבנה מודולים.