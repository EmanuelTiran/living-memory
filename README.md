# זיכרון חי — Living Memory

אפליקציה לשימור סיפורי חיים, זיכרונות ומורשת משפחתית באמצעות מקורות שהמשתמשים מוסרים ומאשרים.

> המערכת מיועדת ליצור זיכרון אינטראקטיבי מבוסס AI. היא אינה האדם עצמו ואינה משחזרת את תודעתו.

## מצב הפרויקט

הושלמו יסודות הפיתוח ותשתיות השרת של Phase 1 ו־Phase 2.

התשתית הנוכחית כוללת:

- Monorepo עם npm workspaces.
- React ו־Vite בצד הלקוח.
- Express ו־Mongoose בצד השרת.
- חיבור מאומת ל־MongoDB Atlas.
- JavaScript ו־ES Modules.
- ממשק עברי בכיוון RTL.
- אימות מרכזי של משתני סביבה.
- טיפול מרכזי בשגיאות API.
- Request ID ייחודי לכל בקשה.
- לוגים מובנים ובטוחים בפורמט JSON.
- בדיקות API באמצעות Vitest ו־Supertest.
- Vite proxy עבור נתיבי `/api`.
- הפעלה וכיבוי מסודרים של שרת ה־HTTP ומסד הנתונים.

## דרישות מערכת

- Node.js `>=24.18.0 <25`
- npm `>=10`
- Git
- MongoDB Atlas

## התקנה

מתיקיית השורש של הפרויקט:

```powershell
npm install
Copy-Item .\client\.env.example .\client\.env.local
Copy-Item .\server\.env.example .\server\.env