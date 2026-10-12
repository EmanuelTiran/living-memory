# Community Notice Board — דפי מידע ציבוריים

האזור נוסף מקומית בענף `release/production-launch`. לא בוצעו Push או Deploy.

## קבצים ונתיבים

ארבעה קובצי HTML ו־`styles.css` נמצאים ב־`client/public/noticeboard/`.
Vite מעתיק אותם ללא שינוי אל `client/dist/noticeboard/` בבנייה הקיימת.
ב־`server/src/app.js` נוספו ארבעה נתיבי GET בתוך התנאי הקיים `serveClientBuild`, לפני הגשת הקבצים הסטטיים וה־SPA fallback.
הנתיבים ציבוריים, ללא בדיקת התחברות וללא קריאות למסד הנתונים. Express תומך גם ב־HEAD ובסלאש סופי.

אין שינוי ב־React, בתפריטים הקיימים, ב־API, בהרשאות, בסכמת הנתונים, בתלויות או ב־`render.yaml` במסגרת תוספת זו.
הדפים אינם כוללים JavaScript, טפסים, נתוני משתמשים, מזהי גיליונות או קוד של התוסף.

## אימות מקומי — 12 באוקטובר 2026

- `npm.cmd run build` עבר. נותרה אזהרת Vite על גודל חלק מחבילות ה־SPA הקיימות.
- `npm.cmd test`: 157 קובצי בדיקה עברו; קובץ אחד נכשל. 983 בדיקות עברו ו־9 נכשלו.
- כל 9 הכשלים הם ב־`googleAuthRoute.test.js`, עם תשובות 403 בבדיקת Origin. הרצת אותן בדיקות עם `app.js` המקורי מ־HEAD שחזרה את אותם 9 כשלים. מנגנון ההתחברות לא שונה.
- בדיקות ממוקדות: 8 קבצים, 41 בדיקות עברו — Notice Board, התחברות רגילה, רישום, requireAuth, health, infrastructure, securityHeaders ו־SEO.
- ESLint עבר עבור `server/src/app.js` ו־`server/tests/noticeboard.test.js`.
- בדיקת Chromium מקומית עברה עבור ארבעת הדפים ברוחבים 1280, 390 ו־320 פיקסלים: RTL, כותרת ראשית אחת, landmark ראשי, דילוג לתוכן במקלדת, פתיחת שאלות נפוצות במקלדת, ללא גלילה אופקית או שגיאות דפדפן. משאבי הדפים נטענים מאותו שרת בלבד.
- בדיקות הנתיבים מאמתות שכל קישור פנימי ומשאב מקומי נגישים, שמטרות העוגנים קיימות, ושהשורש ומסכי ה־SPA הקיימים מחזירים את אותו `client/dist/index.html`.
- `git diff --check` עבר.

בדיקות הנתיבים החדשות נמצאות ב־`server/tests/noticeboard.test.js` ומשתמשות בבנייה האמיתית. יש להריץ בנייה לפניהן; הן מדולגות אם אין `client/dist/index.html`.
לא נבדקה פריסה בפרודקשן, ולא בוצעה כניסה לחשבון אמיתי או גישה למסד הייצור.
פקודת Render נשארה `npm ci && npm run build`; הבנייה המקומית נבדקה עם התלויות המותקנות, ללא התקנה נקייה נוספת.

## השלמות ידניות לפני הגשה

המסמכים עודכנו לפי הבהרות המפתח מ־12 באוקטובר 2026. סימוני הטיוטה הכלליים הוסרו מתנאי השימוש ומהחלקים שהושלמו במדיניות; סעיף 5 במדיניות משאיר את ההשלמות הנקודתיות גלויות. עמוד התמיכה ותנאי השימוש מפנים לאותן השלמות, ללא הבטחה למחיקה או לתקופת שמירה.

הפרטים שנמסרו ואושרו בידי המפתח: המודעות נשמרות ב־Google Sheets; מצב הקריאה האישי ב־Apps Script User Properties; גיליון הצפייה הפרטי נקרא דרך Google Sheets API; גישת הצפייה ניתנת באמצעות הרשאות Sheets שהוענקו לקבוצת Google Groups. התוסף אינו מבקש הרשאה לקריאת תוכן הודעות Gmail. הרשאת `spreadsheets.readonly` אינה מוגבלת טכנית לגיליון יחיד.

בבדיקת `server/src/middleware/requestLogger.js` ו־`server/src/utils/logger.js` אומתו שדות לוגי Express: מזהה בקשה, נתיב, שיטת HTTP, קוד תגובה, חותמת זמן ומשך הבקשה. תשתיות Google ו־Render עשויות לעבד מידע תפעולי; אין במסמכים טענה שספקי התשתית אינם אוספים מידע נוסף. מנגנון הגישה שתואר אינו הבטחה לאבטחה מוחלטת, להצפנה מיוחדת או לתאימות רגולטורית.

נותרו שלוש השלמות לפני הגשה סופית ל־Google:

1. **שמירה ומחיקה:** לא נמצאו במאגר קובצי Apps Script או manifest של התוסף, ולא נמצא מימוש למחיקת User Properties שניתן לבדוק. אין להסיק מכך שהמנגנון אינו קיים בפרויקט החיצוני. יש לבדוק אותו בפרויקט התוסף; **אם אינו קיים, נותרת השלמה טכנית בתוסף לפני הפרסום**. יש לתעד מה נמחק, כיצד מטופלת בקשת מחיקה ומהם תנאי שמירת מצב הקריאה ולוגי התשתית. לא הומצאה תקופת שמירה קבועה, ולא נטען שהסרת התוסף מוחקת נתונים. קשר: עמנואל, t7193439@gmail.com. אין לבצע שינוי בקוד Apps Script במסגרת משימה זו.
2. **שימושים נוספים בנתונים:** לבדוק בקוד התוסף ובתצורת השירותים אם קיימים נתונים נוספים, בעלי גישה או העברות שלא תוארו. היעדר שימוש בנתוני Google לפרסום ולשיווק אינו ניתן לאימות מתוך מאגר זה; לכן לא נוספה הצהרה מוחלטת על היעדר שימוש כזה. להוסיף את ההצהרה לאחר אימות המימוש.
3. **הרשאות ומדיניות Google:** לאמת את ה־manifest מול שלוש ההרשאות המוצהרות ואת ההתאמה ל־Google API Services User Data Policy, כולל Limited Use ככל שחלות. לא נוספה הצהרת עמידה מלאה. הסברי ההרשאות נשענים על [מדריך Google לתוספי Gmail](https://codelabs.developers.google.com/codelabs/gmail-add-ons), [הרשאות Sheets](https://developers.google.com/workspace/sheets/api/scopes) ו־[Properties Service](https://developers.google.com/apps-script/guides/properties).

ה־Commit של המשימה מוגבל לשמונת הקבצים הבאים, באמצעות `git add` עם שמות מפורשים:

- `client/public/noticeboard/index.html`
- `client/public/noticeboard/privacy.html`
- `client/public/noticeboard/terms.html`
- `client/public/noticeboard/support.html`
- `client/public/noticeboard/styles.css`
- `server/src/app.js`
- `server/tests/noticeboard.test.js`
- `docs/NOTICEBOARD.md`

לאחר אישור נפרד ומפורש ל־Push ול־Deploy, יש לפרוס באותו שירות Render ולבדוק את ארבע הכתובות ללא התחברות. השינויים הקודמים שאינם קשורים אינם חלק מה־Commit הזה. יש להזין את הקישורים ב־Google Cloud וב־Marketplace רק לאחר שהדפים נגישים בפרודקשן וההשלמות אומתו. אין עדיין קישור התקנה ציבורי, ולכן לא נוסף כזה.

## כתובות היעד המדויקות

- דף מוצר / Application home page: https://zikaron-hai.co.il/noticeboard
- מדיניות פרטיות / Privacy policy: https://zikaron-hai.co.il/noticeboard/privacy
- תנאי שימוש / Terms of service: https://zikaron-hai.co.il/noticeboard/terms
- תמיכה / Support: https://zikaron-hai.co.il/noticeboard/support

אלו כתובות היעד לאחר פריסה; הן לא אומתו כפעילות באתר הציבורי במסגרת העבודה המקומית.
