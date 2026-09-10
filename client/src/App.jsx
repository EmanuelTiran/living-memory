import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import {
  ApiError,
  resolveGoogleRedirectState,
  loginAccount,
  loginWithGoogle,
  refreshSession,
  registerAccount,
  requestPasswordReset,
  resetPassword as submitNewPassword,
} from './api/authApi.js'
import {
  pilotInviteOnly,
} from './config/pilotFeatures.js'
import AdminDashboard from './features/admin/AdminDashboard.jsx'
import MemoryChatPage from './features/chat/MemoryChatPage.jsx'
import FamilyAccessPage from './features/memories/FamilyAccessPage.jsx'
import InvitationAcceptPage from './features/memories/InvitationAcceptPage.jsx'
import MemoryDashboard from './features/memories/MemoryDashboard.jsx'
import MemoryPilotPage from './features/memories/MemoryPilotPage.jsx'
import MemoryPricingPilotPage from './features/memories/MemoryPricingPilotPage.jsx'
import MemoryProfilePage from './features/memories/MemoryProfilePage.jsx'
import BrandLogo from './BrandLogo.jsx'
import GoogleIdentityButton from './GoogleIdentityButton.jsx'
import {
  getConfiguredGoogleClientId,
} from './googleClientConfiguration.js'
import { getSafeReturnTo } from './safeReturnTo.js'
import './App.css'

const googleClientId =
  getConfiguredGoogleClientId(
    import.meta.env.VITE_GOOGLE_CLIENT_ID,
  )

const googleRedirectErrorCodes = new Set([
  'ACCOUNT_SUSPENDED',
  'AUTH_RATE_LIMITED',
  'GOOGLE_ACCOUNT_LINK_REQUIRED',
  'GOOGLE_AUTH_INVALID',
  'GOOGLE_AUTH_NOT_CONFIGURED',
  'GOOGLE_REGISTRATION_UNAVAILABLE',
  'REGISTRATION_INVITATION_INVALID',
  'REGISTRATION_INVITATION_REQUIRED',
  'VALIDATION_ERROR',
])

const archiveItems = [
  {
    title: 'סיפורים ופרטי חיים',
    description:
      'זיכרונות מהילדות, אנשים משמעותיים, מקומות ותחנות בדרך — עם השמות והפרטים שעוזרים להבין את הסיפור.',
  },
  {
    title: 'הקלטות ותמלולים',
    description:
      'הקול המקורי, עם המילים והדרך שבה נאמרו. תמלולים עוברים בדיקה ואישור בנפרד מההקלטה.',
  },
  {
    title: 'תמונות וחומרים משפחתיים',
    description:
      'תמונות וחומרים משפחתיים נשמרים לצד הסיפורים שאליהם הם שייכים.',
  },
  {
    title: 'שאלות מהמשפחה',
    description:
      'מה תמיד רציתם לשאול? שומרים גם את השאלות שעוד מחכות לסיפור שלהן.',
  },
]

const processSteps = [
  {
    title: 'בוחרים מאיפה להתחיל',
    description:
      'שאלה מהמשפחה, סיפור שרוצים לשמור או ראיון חיים מודרך שעוזר למצוא את המילים.',
  },
  {
    title: 'מתעדים ובודקים',
    description:
      'מקליטים, כותבים או מוסיפים תמונה. עוברים על הטיוטות והתמלולים לפני שמאשרים אותם.',
  },
  {
    title: 'חוזרים ומוסיפים',
    description:
      'מקשיבים שוב, קוראים יחד ומוסיפים פרטים וסיפורים לאורך השנים. בהדרגה נבנה ארכיון של מורשת משפחתית.',
  },
]

const conversationFeatures = [
  {
    title: 'שאלות שמחזירות לסיפור',
    description:
      'השיחה מחברת בין השאלה לחומרים הרלוונטיים בארכיון. כשהמידע קיים, אפשר לחזור גם אל המקור שממנו התשובה נשענת.',
  },
  {
    title: 'תשובות בקול מותאם',
    description:
      'למי שיבחרו בכך, אפשר להוסיף שכבה של קול מלאכותי המותאם להקלטות של האדם שסיפורו נשמר. ההקלטות המקוריות נשארות נפרדות מהדיבור שנוצר.',
  },
  {
    title: 'גם עם אווטאר',
    description:
      'אווטאר חזותי יכול להוסיף נוכחות לחוויית השיחה — כשכבה אופציונלית נוספת.',
  },
]

const trustPrinciples = [
  {
    title: 'אתם בוחרים מה לאשר ואת מי לשתף',
    description:
      'המשפחה מנהלת את הגישה לארכיון ואת התכנים המאושרים בו.',
  },
  {
    title: 'טיוטה נשארת טיוטה עד לאישור',
    description:
      'תמלולים וטיוטות נבדקים לפני שהם הופכים לחלק המאושר של הארכיון.',
  },
  {
    title: 'מקור שאפשר לחזור אליו',
    description:
      'ההקלטה המקורית והחומרים שנשמרו נשארים לצד העיבודים שלהם, כדי שאפשר יהיה לחזור להקשר שבו תועד הסיפור.',
  },
]

const homeMetadata = {
  title: 'זיכרון חי | ארכיון משפחתי לסיפורי חיים וקול',
  description:
    'זיכרון חי הוא ארכיון משפחתי לסיפורי חיים, זיכרונות, הקלטות ותמונות. מתחילים מסיפור אחד ושומרים אותו לדורות הבאים. כעת בפיילוט פרטי, בהזמנה בלבד.',
  path: '/',
}

const privacySections = [
  {
    title: 'מהו השירות',
    paragraphs: [
      'זיכרון חי / Living Memory הוא שירות ליצירה ולניהול של ארכיון משפחתי. אפשר לשמור בו סיפורי חיים, זיכרונות, תשובות לשאלות, תמונות, הקלטות, תמלולים וחומרים הקשורים למורשת המשפחתית.',
      'מדיניות זו מסבירה באופן כללי איזה מידע מעובד במסגרת השירות, לאילו מטרות ועם מי הוא עשוי להיות משותף לצורך הפעלת השירות.',
    ],
  },
  {
    title: 'מידע שנמסר בעת פתיחת חשבון ושימוש בו',
    paragraphs: [
      'בעת הרשמה או התחברות עשויים להימסר שם תצוגה, כתובת אימייל וסיסמה. הסיסמה עצמה אינה נשמרת כטקסט גלוי; נשמר ערך גיבוב מאובטח שנועד לאימות. אם מבקשים לאפס סיסמה, כתובת האימייל משמשת לשליחת קישור האיפוס ולמטרות אבטחה.',
      'בנוסף נשמר מידע הדרוש לניהול החשבון והגישה, כגון מצב החשבון, תפקידים בארכיונים משפחתיים, הזמנות וחיבורי התחברות פעילים.',
    ],
  },
  {
    title: 'כניסה באמצעות Google',
    paragraphs: [
      'כאשר בוחרים להיכנס באמצעות Google, השירות מקבל מ-Google פרטי זיהוי בסיסיים הדרושים לאימות: מזהה קבוע של חשבון Google, כתובת אימייל, מצב אימות האימייל ושם תצוגה, ככל שנמסר.',
      'השימוש ב-Google הוא לצורכי הרשמה והתחברות בלבד. זיכרון חי אינו מקבל סיסמת Google ואינו מבקש גישה ל-Gmail, ל-Google Drive, ליומן, לאנשי קשר, ל-YouTube או לתוכן אחר בחשבון Google.',
    ],
  },
  {
    title: 'תוכן הארכיון המשפחתי',
    paragraphs: [
      'המשתמשים יכולים למסור מידע על עצמם ועל בני משפחה ואנשים אחרים: שמות, קשרים משפחתיים, פרטי חיים, סיפורים, זיכרונות, שאלות, תשובות, תמונות, קובצי שמע, הקלטות ותמלולים. תוכן כזה עשוי להיות אישי או רגיש מטבעו.',
      'לצורך ניהול החומרים נשמר גם מידע נלווה, כגון מי העלה חומר, מועדי יצירה ועדכון, מצב טיוטה או אישור, והקשרים בין סיפור, תמונה, הקלטה או שאלה.',
    ],
  },
  {
    title: 'מידע טכני, עוגיות ואבטחת החשבון',
    paragraphs: [
      'השירות משתמש בעוגיות ובאסימוני התחברות כדי לזהות חיבור פעיל, לרענן אותו באופן מאובטח, למנוע שימוש חוזר לא מורשה ולתמוך בתהליך כניסה באמצעות Google. עשוי להיעשות עיבוד של נתוני בקשה טכניים, כתובת IP, מועדים ומזהי אבטחה לצורך הפעלה, הגנה, איתור תקלות והגבלת שימוש לרעה.',
      'לא זוהה במוצר הנוכחי שימוש בכלי פרסום או ניתוח התנהגותי של צד שלישי. אם אופן השימוש בכלים כאלה ישתנה, המדיניות תעודכן בהתאם.',
    ],
  },
  {
    title: 'כיצד משתמשים במידע',
    items: [
      'כדי ליצור ולנהל חשבונות, התחברויות והרשאות גישה.',
      'כדי לשמור, לארגן, להציג ולשתף חומרי ארכיון בהתאם לפעולות ולהרשאות של המשתמשים.',
      'כדי להפיק תמלולים, לחפש במקורות מאושרים ולהפעיל תכונות שיחה, קול או אווטאר כאשר הן זמינות ונבחרות.',
      'כדי לשלוח הודעות שירות, ובהן הודעות איפוס סיסמה.',
      'כדי להגן על השירות, למנוע שימוש לרעה, לפתור תקלות ולשפר את התפעול.',
    ],
  },
  {
    title: 'ספקי שירות ועיבוד באמצעות בינה מלאכותית',
    paragraphs: [
      'לצורך הפעלת השירות עשוי מידע להישלח לספקים שמבצעים עבור זיכרון חי פעולה מוגדרת: Google לצורך אימות זהות; Postmark לשליחת הודעות איפוס סיסמה; OpenAI לתמלול, שיחה או הפקת קול; ElevenLabs להפקת קול מותאם; ו-D-ID להפעלת חוויית אווטאר. השימוש בפועל תלוי בתכונה שנבחרה ובאופן שבו השירות הוגדר.',
      'כאשר מופעלת תכונת בינה מלאכותית, רק החומר הנדרש לביצוע הפעולה עשוי לעבור עיבוד אצל הספק הרלוונטי. תשובות, קול ואווטאר שנוצרים באמצעות בינה מלאכותית הם עיבודים טכנולוגיים ואינם האדם עצמו. ההקלטות והמקורות המקוריים נשמרים בנפרד מן התוצרים שנוצרו.',
      'בנוסף נעשה שימוש בתשתיות אירוח, מסד נתונים ואחסון לצורך הפעלת השירות ושמירת החומרים.',
    ],
  },
  {
    title: 'שיתוף וגישה בתוך המשפחה',
    paragraphs: [
      'בעלי הארכיון ובעלי תפקידים מורשים יכולים להזמין בני משפחה ולהעניק להם רמות גישה שונות, כגון צפייה, הוספת תוכן, עריכה או ניהול גישה. תוכן הארכיון מוצג למי שקיבלו הרשאה מתאימה, ולכן חשוב לבחור בקפידה את המוזמנים ואת התפקיד שניתן להם.',
      'זיכרון חי אינו מציג תוכן משפחתי פרטי כחלק מהאתר הציבורי.',
    ],
  },
  {
    title: 'הבחירות שלכם, שמירה ומחיקה',
    paragraphs: [
      'אפשר לעדכן חלק מפרטי החשבון והתוכן באמצעות ממשקי השירות ולנהל גישה של בני משפחה בהתאם להרשאות. ניתן לפנות אלינו בנוגע לגישה למידע, תיקון או בקשת מחיקה.',
      'מידע נשמר כל עוד הוא דרוש להפעלת החשבון והארכיון, לאבטחה, לטיפול בבקשות או לעמידה בחובות החלות על השירות. משך השמירה עשוי להשתנות לפי סוג המידע, מצב החשבון והצורך התפעולי. איננו מתחייבים כאן לתקופת שמירה קבועה שלא הוגדרה במוצר.',
    ],
  },
  {
    title: 'אבטחת מידע',
    paragraphs: [
      'ננקטים אמצעים טכניים וארגוניים שנועדו לצמצם גישה בלתי מורשית, ובהם אימות, הרשאות, עוגיות התחברות מוגנות, הגבלת ניסיונות ושמירת קובצי מדיה מחוץ לגישה ציבורית ישירה. עם זאת, אין מערכת מקוונת שיכולה להבטיח אבטחה מוחלטת.',
    ],
  },
  {
    title: 'מידע על ילדים ובני משפחה אחרים',
    paragraphs: [
      'ארכיון משפחתי עשוי לכלול מידע על ילדים או על אנשים שאינם משתמשים בשירות בעצמם. מי שמעלה או משתף מידע כזה אחראי לוודא שיש לו הרשאה מתאימה ולעשות זאת ברגישות, תוך הימנעות ממידע שאינו נחוץ או שעלול לפגוע באדם המתועד.',
    ],
  },
  {
    title: 'שינויים ויצירת קשר',
    paragraphs: [
      'אנו עשויים לעדכן מדיניות זו כאשר השירות או אופן עיבוד המידע משתנים. הגרסה המעודכנת תפורסם בעמוד זה עם מועד העדכון.',
      'לשאלות או לבקשות בנושא פרטיות ניתן לפנות אל admin@zikaron-hai.co.il.',
    ],
  },
]

const termsSections = [
  {
    title: 'קבלת התנאים',
    paragraphs: [
      'השימוש בזיכרון חי / Living Memory כפוף לתנאים אלה. פתיחת חשבון, התחברות או שימוש בשירות מבטאים הסכמה לתנאים. אם אינכם מסכימים להם, אין להשתמש בשירות.',
      'השירות פועל כעת כפיילוט פרטי ומצומצם, וההצטרפות אליו עשויה להיות מותנית בהזמנה.',
    ],
  },
  {
    title: 'מטרת השירות',
    paragraphs: [
      'זיכרון חי מאפשר ליצור ולנהל ארכיון משפחתי הכולל סיפורי חיים, זיכרונות, שאלות, תמונות, הקלטות, תמלולים וחומרים קשורים. תכונות שיחה, קול מותאם ואווטאר עשויות להיות זמינות כשכבות אופציונליות המבוססות על חומרי הארכיון.',
    ],
  },
  {
    title: 'חשבון ואחריות המשתמשים',
    paragraphs: [
      'יש למסור פרטים נכונים ועדכניים, לשמור על אמצעי ההתחברות ולא לאפשר שימוש בלתי מורשה בחשבון. יש לעדכן אותנו בהקדם אם מתעורר חשש לגישה שאינה מורשית.',
      'כניסה באמצעות Google משמשת לאימות החשבון בלבד ואינה מעניקה לזיכרון חי גישה לשירותי Google אחרים.',
    ],
  },
  {
    title: 'גישה לארכיון המשפחתי',
    paragraphs: [
      'בעל או בעלת הארכיון ובעלי תפקידים מורשים יכולים להזמין בני משפחה ולהגדיר הרשאות. מי שמנהל גישה אחראי לבחור מוזמנים ותפקידים מתאימים. משתמשים רשאים לצפות בתוכן או לפעול בו רק בהתאם להרשאה שניתנה להם.',
    ],
  },
  {
    title: 'התוכן שלכם והרשות לעבד אותו',
    paragraphs: [
      'הזכויות בתוכן שמעלים המשתמשים נשארות בידי בעלי הזכויות בו. כדי לספק את השירות, המשתמשים מעניקים לזיכרון חי רשות מוגבלת לעבד, לאחסן, להעתיק, להציג, להמיר ולהעביר את התוכן לספקי שירות, אך ורק במידה הדרושה להפעלת התכונות שנבחרו, לאבטחה ולתמיכה.',
      'מי שמעלה או משתף סיפור, תמונה, הקלטה או מידע על אדם אחר אחראי לכך שיש לו הרשאה מתאימה לעשות זאת ולבחור את השימושים המותרים. אין להעלות חומר שמפר זכויות, פרטיות או דין.',
    ],
  },
  {
    title: 'שימוש אסור',
    items: [
      'להתחזות לאדם אחר או לנסות לקבל גישה לחשבון או לארכיון ללא רשות.',
      'להעלות תוכן בלתי חוקי, פוגעני, מטעה או מפר זכויות.',
      'לעקוף הרשאות, אמצעי אבטחה או מגבלות שימוש.',
      'להפיץ קוד מזיק, להפריע לפעולת השירות או להשתמש בו באופן אוטומטי ומכביד ללא אישור.',
      'להציג תוצר של קול מלאכותי או אווטאר כאילו היה הקלטה או אמירה אותנטית של האדם המתועד.',
    ],
  },
  {
    title: 'תכונות בינה מלאכותית',
    paragraphs: [
      'תמלולים, תשובות, קול ואווטאר שנוצרים באמצעות בינה מלאכותית עלולים לכלול טעויות, השמטות או ניסוחים שאינם משקפים במדויק את המקור. יש לבדוק תוצרים לפני הסתמכות, אישור או שיתוף שלהם.',
      'תוצר מלאכותי אינו האדם המתועד ואינו תחליף למקור, לעדות מקצועית או לשיקול דעת אנושי. זמינות התכונות תלויה גם בספקים חיצוניים ובהגדרות השירות.',
    ],
  },
  {
    title: 'זמינות, שינויים והפסקת גישה',
    paragraphs: [
      'במהלך הפיילוט השירות עשוי להשתנות, להתעדכן, להיות מוגבל או להפסיק להיות זמין, כולו או חלקו. איננו מתחייבים לזמינות רציפה או לכך שכל תכונה תישאר ללא שינוי.',
      'אנו עשויים להגביל או להשעות חשבון כאשר הדבר נדרש להגנת המשתמשים והשירות, עקב הפרת התנאים או בשל שימוש בלתי מורשה. ככל שהנסיבות מאפשרות, נפעל באופן מידתי וננסה למסור הודעה מתאימה.',
    ],
  },
  {
    title: 'הקניין הרוחני בשירות',
    paragraphs: [
      'הזכויות במוצר זיכרון חי, בממשק, במיתוג, בתוכנה ובתכנים שנוצרו מטעם השירות אינן מועברות למשתמשים. תנאים אלה אינם מגבילים זכויות שיש למשתמשים בתוכן המשפחתי שלהם.',
    ],
  },
  {
    title: 'הסתייגות והגבלת אחריות',
    paragraphs: [
      'השירות ניתן במסגרת פיילוט ובמצבו הנוכחי. אנו פועלים לספק שירות שימושי ואמין, אך איננו מבטיחים שלא יהיו תקלות, הפסקות, אובדן נתונים או טעויות בתוצרים.',
      'במידה המותרת לפי דין, האחריות בקשר לשימוש בשירות מוגבלת לנזק ישיר שנגרם עקב מעשה או מחדל שלנו. אין באמור כדי לגרוע מזכויות שלא ניתן להתנות עליהן לפי דין.',
    ],
  },
  {
    title: 'שינויים בתנאים ויצירת קשר',
    paragraphs: [
      'אנו עשויים לעדכן תנאים אלה כאשר השירות משתנה. הגרסה המעודכנת תפורסם בעמוד זה עם מועד העדכון. המשך שימוש לאחר כניסת שינוי לתוקף ייחשב להסכמה לתנאים המעודכנים.',
      'לשאלות בנוגע לתנאים ניתן לפנות אל admin@zikaron-hai.co.il.',
    ],
  },
]

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה. נסו שוב.'
  }

  const messages = {
    EMAIL_ALREADY_REGISTERED:
      'כבר קיים חשבון עם כתובת האימייל הזאת.',
    INVALID_CREDENTIALS:
      'כתובת האימייל או הסיסמה אינם נכונים.',
    ACCOUNT_SUSPENDED:
      'החשבון הזה הושעה ואינו יכול להתחבר.',
    REGISTRATION_INVITATION_REQUIRED:
      'ההרשמה לפיילוט זמינה דרך קישור הזמנה אישי בלבד.',
    REGISTRATION_INVITATION_INVALID:
      'ההזמנה אינה תקינה, פגה או מיועדת לכתובת אימייל אחרת.',
    PASSWORD_RESET_INVALID_OR_EXPIRED:
      'קישור איפוס הסיסמה אינו תקף או שפג תוקפו. בקשו קישור חדש.',
    GOOGLE_AUTH_INVALID:
      'לא הצלחנו לאמת את הכניסה באמצעות Google. נסו שוב.',
    GOOGLE_AUTH_NOT_CONFIGURED:
      'הכניסה באמצעות Google אינה זמינה כרגע. אפשר להמשיך עם אימייל וסיסמה.',
    GOOGLE_ACCOUNT_LINK_REQUIRED:
      'כבר קיים חשבון עם כתובת האימייל הזאת. התחברו באמצעות הסיסמה לחשבון הקיים. חיבור Google לחשבון כזה יתווסף בהמשך מתוך חשבון מאומת.',
    GOOGLE_REGISTRATION_UNAVAILABLE:
      'בשלב זה אפשר ליצור חשבון עם Google רק באמצעות Gmail או חשבון Google Workspace. אפשר להירשם באמצעות אימייל וסיסמה.',
    AUTH_RATE_LIMITED:
      'בוצעו יותר מדי ניסיונות בזמן קצר. המתינו מעט ונסו שוב.',
    VALIDATION_ERROR:
      'חלק מהפרטים אינם תקינים. בדקו את הטופס ונסו שוב.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת. ודאו שהשרת פועל ונסו שוב.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה. נסו שוב.'
  )
}

function getGoogleRedirectErrorMessage(code) {
  if (!googleRedirectErrorCodes.has(code)) {
    return ''
  }

  return getErrorMessage(
    new ApiError('Google authentication failed.', {
      code,
    }),
  )
}

function PageShell({ children, className = '' }) {
  const classes = ['page-shell', className]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={classes}>
      {children}
    </main>
  )
}

function PublicPageMetadata({
  title,
  description,
  path,
}) {
  useEffect(() => {
    const canonicalUrl = new URL(
      path,
      'https://zikaron-hai.co.il',
    ).toString()
    const canonicalLink = document.querySelector(
      'link[rel="canonical"]',
    )
    const metadata = [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
      ['meta[property="og:url"]', canonicalUrl],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', description],
    ]
    const previousTitle = document.title
    const previousCanonical =
      canonicalLink?.getAttribute('href') ?? ''
    const previousMetadata = metadata.map(
      ([selector]) => {
        const element =
          document.querySelector(selector)

        return [
          element,
          element?.getAttribute('content') ?? '',
        ]
      },
    )

    document.title = title
    canonicalLink?.setAttribute(
      'href',
      canonicalUrl,
    )

    metadata.forEach(
      ([selector, content]) => {
        document
          .querySelector(selector)
          ?.setAttribute('content', content)
      },
    )

    return () => {
      document.title = previousTitle
      canonicalLink?.setAttribute(
        'href',
        previousCanonical,
      )

      previousMetadata.forEach(
        ([element, content]) => {
          element?.setAttribute(
            'content',
            content,
          )
        },
      )
    }
  }, [description, path, title])

  return null
}

function PublicFooter() {
  return (
    <footer className="home-footer public-footer">
      <div>
        <p>
          <strong>זיכרון חי</strong>
          <span aria-hidden="true"> | </span>
          <span dir="ltr">Living Memory</span>
        </p>
        <p>שומרים סיפורי חיים לדורות.</p>
      </div>

      <nav
        className="public-footer-links"
        aria-label="מידע משפטי"
      >
        <Link to="/privacy">מדיניות פרטיות</Link>
        <Link to="/terms">תנאי שימוש</Link>
      </nav>
    </footer>
  )
}

function PublicDocumentPage({
  eyebrow,
  title,
  description,
  path,
  intro,
  sections,
}) {
  return (
    <PageShell className="public-document-shell">
      <PublicPageMetadata
        title={`${title} | זיכרון חי`}
        description={description}
        path={path}
      />

      <header className="public-document-header">
        <Link
          className="public-document-brand"
          to="/"
          aria-label="זיכרון חי — חזרה לעמוד הבית"
        >
          <BrandLogo className="brand-logo-compact" />
          <span dir="ltr">Living Memory</span>
        </Link>

        <Link className="public-document-home-link" to="/">
          חזרה לעמוד הבית
        </Link>
      </header>

      <article
        className="public-document"
        aria-labelledby="public-document-title"
      >
        <div className="public-document-intro">
          <p className="home-section-label">{eyebrow}</p>
          <h1 id="public-document-title">{title}</h1>
          <p>{intro}</p>
          <p className="public-document-date">
            עודכן לאחרונה: 10 בספטמבר 2026
          </p>
        </div>

        <div className="public-document-sections">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>

              {section.paragraphs?.map(
                (paragraph) => (
                  <p key={paragraph}>
                    {paragraph}
                  </p>
                ),
              )}

              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <aside className="public-document-contact">
          <strong>יצירת קשר</strong>
          <a href="mailto:admin@zikaron-hai.co.il">
            admin@zikaron-hai.co.il
          </a>
        </aside>
      </article>

      <PublicFooter />
    </PageShell>
  )
}

function PrivacyPage() {
  return (
    <PublicDocumentPage
      eyebrow="הפרטיות של הארכיון המשפחתי"
      title="מדיניות פרטיות"
      description="מדיניות הפרטיות של זיכרון חי / Living Memory: מידע על חשבונות, ארכיונים משפחתיים, כניסה באמצעות Google ועיבוד תכנים במסגרת השירות."
      path="/privacy"
      intro="הארכיון המשפחתי עשוי להכיל רגעים ומידע אישיים מאוד. לכן חשוב לנו להסביר בשפה ברורה כיצד המידע משמש להפעלת זיכרון חי ואילו בחירות עומדות לרשותכם."
      sections={privacySections}
    />
  )
}

function TermsPage() {
  return (
    <PublicDocumentPage
      eyebrow="כללים פשוטים לשימוש אחראי"
      title="תנאי שימוש"
      description="תנאי השימוש של זיכרון חי / Living Memory לניהול ארכיון משפחתי, העלאת תוכן ושימוש בתכונות שיחה, קול ואווטאר."
      path="/terms"
      intro="תנאים אלה נועדו להגדיר באופן ברור והוגן את השימוש בשירות, את האחריות על תוכן משפחתי ואת המגבלות הסבירות של מוצר הנמצא בפיילוט."
      sections={termsSections}
    />
  )
}

function AuthFrame() {
  return (
    <div className="auth-frame" aria-hidden="true">
      <span className="auth-frame-segment auth-frame-ink" />
      <span className="auth-frame-segment auth-frame-clay" />
      <span className="auth-frame-segment auth-frame-olive" />
    </div>
  )
}

function LoadingScreen() {
  return (
    <PageShell>
      <section
        className="surface-card loading-card"
        aria-live="polite"
      >
        <span className="loading-brand" aria-hidden="true">
          <img src="/favicon-32x32.png" alt="" />
        </span>

        <p>בודקים את מצב ההתחברות...</p>
      </section>
    </PageShell>
  )
}

function HomePage({
  user,
  initializing,
  startupError,
}) {
  const primaryAction = user
    ? {
        label: 'פתיחת הארכיון המשפחתי',
        to: '/app',
        tooltip: 'לפתוח את הזיכרונות המשפחתיים שלך',
      }
    : pilotInviteOnly
      ? {
          label: 'כניסה לפיילוט הפרטי',
          to: '/login',
          tooltip: 'להתחבר לחשבון הפיילוט הפרטי',
        }
      : {
          label: 'התחלת ארכיון משפחתי',
          to: '/register',
          tooltip: 'ליצור חשבון וארכיון משפחתי',
        }

  return (
    <PageShell className="home-page-shell">
      <PublicPageMetadata {...homeMetadata} />

      <section
        className="home-hero"
        aria-labelledby="home-title"
      >
        <div className="home-hero-brand">
          <BrandLogo className="home-brand-logo" />
          <span className="home-brand-divider" aria-hidden="true" />
          <span className="home-brand-english" dir="ltr">
            Living Memory
          </span>
        </div>

        <div className="home-hero-layout">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              זיכרון חי — ארכיון משפחתי לסיפורי חיים
            </p>

            <h1 className="home-title" id="home-title">
              <span>הסיפורים של המשפחה שלכם.</span>
              <span>במילים שלהם. בקול שלהם.</span>
            </h1>

            <p className="home-lead">
              שומרים סיפורי חיים, הקלטות ותמונות בארכיון משפחתי אחד,
              כדי שתוכלו לחזור לסיפורים ולשתף אותם גם עם הדורות הבאים.
              מתחילים בזיכרון אחד, ומוסיפים עוד עם הזמן.
            </p>

            <p className="home-trust-line">
              <span aria-hidden="true">✓</span>
              אתם בוחרים מה לאשר ואת מי לשתף.
            </p>

            <div className="home-actions">
              <Link
                className="primary-button"
                to={primaryAction.to}
                data-aura-tooltip={primaryAction.tooltip}
              >
                {primaryAction.label}
              </Link>

              <a
                className="secondary-button"
                href="#how-it-works"
                data-aura-tooltip="לעבור להסבר על תהליך התיעוד"
              >
                איך זה עובד
              </a>
            </div>

            {!user && !pilotInviteOnly && (
              <Link
                className="home-account-link"
                to="/login"
                data-aura-tooltip="להתחבר לחשבון קיים"
              >
                כבר יש לכם חשבון? כניסה לחשבון
              </Link>
            )}

            {pilotInviteOnly && (
              <p className="home-pilot-notice">
                זיכרון חי פועל כעת בפיילוט פרטי ומצומצם.
                ההצטרפות בהזמנה בלבד.
              </p>
            )}

            {(initializing || startupError) && (
              <p
                className={
                  startupError
                    ? 'development-status status-error'
                    : 'development-status'
                }
                aria-live="polite"
              >
                <span aria-hidden="true" />
                {startupError || 'בודקים אם קיים חיבור פעיל'}
              </p>
            )}
          </div>

          <aside
            className="home-archive-preview"
            aria-label="המחשה של ארכיון משפחתי"
          >
            <div className="home-preview-heading">
              <span>ארכיון משפחתי</span>
              <span aria-hidden="true">01</span>
            </div>

            <div className="home-preview-story">
              <span className="home-preview-label">סיפור חיים</span>
              <strong>הזיכרון נשמר עם הפרטים שנותנים לו משמעות</strong>
              <span className="home-preview-lines" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="home-preview-source">
              <span className="home-preview-play" aria-hidden="true">
                ▶
              </span>
              <span>
                <strong>הקלטה מקורית</strong>
                <small>נשמרת לצד התמלול המאושר</small>
              </span>
              <span className="home-preview-wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="home-preview-footer">
              <span>סיפורים</span>
              <span>הקלטות</span>
              <span>תמונות</span>
              <span>שאלות</span>
            </div>
          </aside>
        </div>

        <aside className="home-advanced-preview">
          <span className="home-advanced-mark" aria-hidden="true">
            AI
          </span>
          <p>
            בהמשך אפשר יהיה גם לשאול על הזיכרונות שנשמרו,
            ולבחור לשמוע תשובות בקול מלאכותי מותאם
            או לחוות את השיחה באמצעות אווטאר.
          </p>
        </aside>
      </section>

      <section
        className="home-section"
        aria-labelledby="archive-section-title"
      >
        <div className="home-section-intro">
          <div>
            <p className="home-section-label">הארכיון המשפחתי</p>
            <h2 id="archive-section-title">הסיפור שמאחורי התמונות</h2>
            <p className="home-section-lead">
              זיכרון חי הוא ארכיון משפחתי שבו שומרים את סיפורי החיים,
              הזיכרונות והקול של בני המשפחה, כדי שאפשר יהיה לחזור אליהם
              ולהעביר אותם לדורות הבאים.
            </p>
          </div>

          <p className="home-section-support">
            לצד תמונה אפשר לשמור מי מופיע בה ומה קרה באותו יום.
            לצד סיפור כתוב — את ההקלטה שבה סופר.
            כך נשמרים גם הפרטים שנותנים לזיכרון את המשמעות שלו.
          </p>
        </div>

        <ol className="archive-items">
          {archiveItems.map((item, index) => (
            <li key={item.title}>
              <span className="home-item-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-section process-section"
        id="how-it-works"
        tabIndex={-1}
        aria-labelledby="process-section-title"
      >
        <div className="home-centered-intro">
          <p className="home-section-label">תהליך פשוט ומתמשך</p>
          <h2 id="process-section-title">מתחילים מסיפור אחד</h2>
          <p>
            אין צורך לתעד חיים שלמים בבת אחת.
            אפשר להתחיל משאלה, מתמונה או מזיכרון שעולה בשיחה.
          </p>
        </div>

        <ol className="process-steps">
          {processSteps.map((step, index) => (
            <li key={step.title}>
              <span className="process-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-section experience-section"
        aria-labelledby="experience-section-title"
      >
        <div className="experience-glow" aria-hidden="true" />
        <div className="experience-intro">
          <p className="experience-label">שיחה, קול מותאם ואווטאר</p>
          <h2 id="experience-section-title">
            <span>לשאול על הסיפורים.</span>
            <span>לשמוע אותם בדרך נוספת.</span>
          </h2>
          <p>
            הארכיון נועד להיות גם בסיס לשיחה על מה שתועד.
            ככל שנשמרים בו סיפורים ומקורות מאושרים,
            אפשר לבנות חוויה שבה שואלים שאלות בשפה טבעית
            ומקבלים תשובות המבוססות על החומרים שנשמרו.
          </p>
        </div>

        <ul className="conversation-prompts" aria-label="דוגמאות לשאלות">
          <li>איך נראו החיים בבית שבו גדלו?</li>
          <li>מה הם סיפרו על הילדות?</li>
          <li>מה עמד מאחורי החלטה משפחתית חשובה?</li>
        </ul>

        <div className="experience-features">
          {conversationFeatures.map((feature, index) => (
            <article key={feature.title}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>

        <aside className="experience-disclosure" aria-label="הבהרה חשובה">
          <span className="experience-disclosure-mark" aria-hidden="true">
            AI
          </span>
          <p>
            <strong>
              הקול המלאכותי והאווטאר הם ייצוגים שנוצרים באמצעות בינה מלאכותית,
              ולא האדם עצמו.
            </strong>
            אפשר לשמור, לקרוא ולהקשיב לסיפורים גם בלעדיהם.
          </p>
        </aside>
      </section>

      <section
        className="home-section"
        aria-labelledby="trust-section-title"
      >
        <div className="home-centered-intro">
          <p className="home-section-label">בחירה, אישור ומקור</p>
          <h2 id="trust-section-title">הסיפור קודם לטכנולוגיה</h2>
        </div>

        <ol className="trust-principles">
          {trustPrinciples.map((principle, index) => (
            <li key={principle.title}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{principle.title}</h3>
              <p>{principle.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-section final-cta-section"
        aria-labelledby="final-cta-title"
      >
        <div className="final-cta-copy">
          <p className="home-section-label">הצעד הראשון</p>
          <h2 id="final-cta-title">איזה סיפור תרצו לשמור ראשון?</h2>
          <p>
            סיפור מהילדות, זיכרון משפחתי
            או השאלה שתמיד רציתם לשאול.
            אפשר להתחיל משם.
          </p>

          {pilotInviteOnly && (
            <p className="final-pilot-note">
              זיכרון חי נמצא כעת בפיילוט פרטי ומצומצם.
              ההצטרפות בהזמנה בלבד.
            </p>
          )}

          {!user && pilotInviteOnly && (
            <p className="final-login-hint">
              יש לכם הזמנה? התחברו לחשבון כדי להתחיל.
            </p>
          )}
        </div>

        <Link
          className="primary-button final-cta-button"
          to={primaryAction.to}
          data-aura-tooltip={primaryAction.tooltip}
        >
          {primaryAction.label}
        </Link>
      </section>

      <PublicFooter />
    </PageShell>
  )
}

function AuthPage({
  mode,
  onAuthenticated,
}) {
  const isRegistration =
    mode === 'register'

  const navigate = useNavigate()
  const location = useLocation()
  const redirectSearchParams =
    new URLSearchParams(location.search)
  const hasGoogleRedirectRecovery =
    redirectSearchParams.get(
      'googleRecovery',
    ) === '1'
  const googleRedirectErrorCode =
    redirectSearchParams.get('googleError') ?? ''
  const [redirectContext, setRedirectContext] =
    useState(null)
  const [isRestoringGoogleRedirect, setIsRestoringGoogleRedirect] =
    useState(hasGoogleRedirectRecovery)
  const returnTo = getSafeReturnTo(
    location.state?.returnTo ??
      redirectContext?.returnTo,
  )
  const registrationTokenCandidate =
    location.state?.invitationToken ??
    redirectContext?.invitationToken
  const invitationToken =
    typeof registrationTokenCandidate ===
    'string'
      ? registrationTokenCandidate
      : ''

  const [formData, setFormData] = useState({
    displayName: '',
    email:
      typeof location.state?.email === 'string'
        ? location.state.email
        : '',
    password: '',
  })

  const [errorMessage, setErrorMessage] =
    useState('')

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const [isGoogleSubmitting, setIsGoogleSubmitting] =
    useState(false)

  const [googleErrorMessage, setGoogleErrorMessage] =
    useState(() =>
      getGoogleRedirectErrorMessage(
        googleRedirectErrorCode,
      ),
    )

  const googleSubmissionRef = useRef(false)

  const registrationCompleted =
    mode === 'login' &&
    location.state?.registrationCompleted ===
      true

  useEffect(() => {
    if (!hasGoogleRedirectRecovery) {
      return undefined
    }

    let isActive = true

    resolveGoogleRedirectState()
      .then((context) => {
        if (!isActive) {
          return
        }

        setRedirectContext(context)
        setIsRestoringGoogleRedirect(false)
        navigate(location.pathname, {
          replace: true,
          state: {
            ...location.state,
            returnTo: context.returnTo,
            invitationToken:
              context.invitationToken,
          },
        })
      })
      .catch((error) => {
        if (!isActive) {
          return
        }

        setGoogleErrorMessage((current) =>
          current || getErrorMessage(error),
        )
        setIsRestoringGoogleRedirect(false)
        navigate(location.pathname, {
          replace: true,
          state: location.state,
        })
      })
    return () => {
      isActive = false
    }
  }, [
    hasGoogleRedirectRecovery,
    location.pathname,
    location.state,
    navigate,
  ])

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      if (isRegistration) {
        await registerAccount({
          displayName: formData.displayName,
          email: formData.email,
          password: formData.password,
          invitationToken:
            invitationToken || undefined,
        })

        navigate('/login', {
          replace: true,
          state: {
            registrationCompleted: true,
            email: formData.email.trim(),
            returnTo,
          },
        })

        return
      }

      const authentication =
        await loginAccount({
          email: formData.email,
          password: formData.password,
        })

      onAuthenticated(authentication)

      navigate(returnTo, {
        replace: true,
      })
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleCredential = useCallback(
    async (credential) => {
      if (googleSubmissionRef.current) {
        return
      }

      googleSubmissionRef.current = true
      setGoogleErrorMessage('')
      setIsGoogleSubmitting(true)

      try {
        const authentication =
          await loginWithGoogle({
            credential,
            invitationToken:
              invitationToken || undefined,
          })

        onAuthenticated(authentication)

        navigate(returnTo, {
          replace: true,
        })
      } catch (error) {
        setGoogleErrorMessage(
          getErrorMessage(error),
        )
      } finally {
        googleSubmissionRef.current = false
        setIsGoogleSubmitting(false)
      }
    },
    [
      invitationToken,
      navigate,
      onAuthenticated,
      returnTo,
    ],
  )

  const handleGoogleUnavailable = useCallback(
    () => {
      setGoogleErrorMessage(
        'הכניסה באמצעות Google אינה זמינה כרגע. אפשר להמשיך עם אימייל וסיסמה.',
      )
    },
    [],
  )

  if (isRestoringGoogleRedirect) {
    return <LoadingScreen />
  }

  if (
    isRegistration &&
    pilotInviteOnly &&
    !invitationToken
  ) {
    return (
      <PageShell className="auth-page-shell">
        <section
          className="surface-card auth-card registration-closed-card"
          aria-labelledby="auth-title"
        >
          <AuthFrame />

          <Link
            className="back-link"
            to="/"
            data-aura-tooltip="לחזור לעמוד הפתיחה"
          >
            חזרה לעמוד הראשי
          </Link>

          <BrandLogo className="auth-brand-logo" compact />
          <p className="eyebrow">פיילוט פרטי</p>
          <h1 className="auth-title" id="auth-title">
            ההרשמה נפתחת בהזמנה בלבד
          </h1>
          <p className="auth-description">
            כדי ליצור חשבון חדש יש לפתוח את קישור
            ההזמנה האישי שקיבלתם ממנהל הארכיון
            המשפחתי. אם כבר נרשמתם, אפשר להתחבר.
          </p>
          <Link
            className="primary-button"
            to="/login"
            data-aura-tooltip="להתחבר לחשבון קיים"
          >
            כניסה לחשבון קיים
          </Link>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell className="auth-page-shell">
      <section
        className={`surface-card auth-card ${
          isRegistration
            ? 'auth-card-registration'
            : 'auth-card-login'
        }`}
        aria-labelledby="auth-title"
      >
        <AuthFrame />

        <Link
          className="back-link"
          to="/"
          data-aura-tooltip="לחזור לעמוד הפתיחה"
        >
          חזרה לעמוד הראשי
        </Link>

        <BrandLogo className="auth-brand-logo" compact />

        <h1
          className="auth-title"
          id="auth-title"
        >
          {isRegistration
            ? 'יצירת חשבון חדש'
            : 'כניסה לחשבון'}
        </h1>

        <p className="auth-description">
          {isRegistration
            ? 'החשבון יאפשר לכם ליצור ולנהל מספר זיכרונות משפחתיים פרטיים.'
            : 'התחברו כדי להמשיך אל הזיכרונות והסיפורים המשפחתיים שלכם.'}
        </p>

        {registrationCompleted && (
          <p
            className="form-notice"
            role="status"
          >
            החשבון נוצר בהצלחה. כעת אפשר
            להתחבר.
          </p>
        )}

        {googleClientId && (
          <>
            <div
              className="auth-google-section"
              aria-busy={isGoogleSubmitting}
            >
              <GoogleIdentityButton
                clientId={googleClientId}
                invitationToken={
                  invitationToken
                }
                mode={mode}
                disabled={isGoogleSubmitting}
                onCredential={
                  handleGoogleCredential
                }
                onUnavailable={
                  handleGoogleUnavailable
                }
                returnTo={returnTo}
              />

              {isGoogleSubmitting && (
                <p
                  className="auth-google-status"
                  role="status"
                >
                  מאמתים את החשבון מול Google...
                </p>
              )}

              {googleErrorMessage && (
                <p
                  className="form-error auth-google-error"
                  role="alert"
                >
                  {googleErrorMessage}
                </p>
              )}
            </div>

            <div
              className="auth-provider-separator"
              aria-hidden="true"
            >
              <span>או</span>
            </div>
          </>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          {isRegistration && (
            <label className="form-field">
              <span>שם להצגה</span>

              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                minLength={2}
                maxLength={80}
                autoComplete="name"
                autoFocus
                required
              />
            </label>
          )}

          <label className="form-field">
            <span>כתובת אימייל</span>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              maxLength={254}
              autoComplete="email"
              autoFocus={!isRegistration}
              dir="ltr"
              required
            />
          </label>

          <label className="form-field">
            <span>סיסמה</span>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              minLength={
                isRegistration ? 15 : 1
              }
              maxLength={128}
              autoComplete={
                isRegistration
                  ? 'new-password'
                  : 'current-password'
              }
              dir="ltr"
              required
            />

            {isRegistration && (
              <small>
                יש להשתמש בסיסמה באורך
                15 תווים לפחות.
              </small>
            )}
          </label>

          {!isRegistration && (
            <Link
              className="auth-forgot-link"
              to="/forgot-password"
              state={{
                email: formData.email.trim(),
              }}
              data-aura-tooltip="לעבור לאיפוס הסיסמה"
            >
              שכחתם את הסיסמה?
            </Link>
          )}

          {errorMessage && (
            <p
              className="form-error"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <button
            className="primary-button submit-button"
            type="submit"
            disabled={
              isSubmitting ||
              isGoogleSubmitting
            }
          >
            {isSubmitting
              ? 'מתבצע...'
              : isRegistration
                ? 'יצירת החשבון'
                : 'כניסה'}
          </button>
        </form>

        {(!pilotInviteOnly || isRegistration) && (
          <p className="auth-switch">
            {isRegistration
              ? 'כבר יש לכם חשבון?'
              : 'עדיין אין לכם חשבון?'}

            <Link
              to={
                isRegistration
                  ? '/login'
                  : '/register'
              }
              state={{
                returnTo,
                invitationToken,
              }}
              data-aura-tooltip={
                isRegistration
                  ? 'לעבור לכניסה לחשבון קיים'
                  : 'לעבור ליצירת חשבון חדש'
              }
            >
              {isRegistration
                ? 'כניסה לחשבון'
                : 'יצירת חשבון'}
            </Link>
          </p>
        )}
      </section>
    </PageShell>
  )
}

function PasswordRecoveryCard({
  title,
  description,
  children,
}) {
  return (
    <PageShell className="auth-page-shell">
      <section
        className="surface-card auth-card auth-recovery-card"
        aria-labelledby="auth-recovery-title"
        aria-live="polite"
      >
        <AuthFrame />

        <Link
          className="back-link"
          to="/login"
          data-aura-tooltip="לחזור לכניסה לחשבון"
        >
          חזרה לכניסה
        </Link>

        <BrandLogo className="auth-brand-logo" compact />

        <h1
          className="auth-title"
          id="auth-recovery-title"
        >
          {title}
        </h1>

        <p className="auth-description">
          {description}
        </p>

        {children}
      </section>
    </PageShell>
  )
}

function ForgotPasswordPage() {
  const location = useLocation()
  const [email, setEmail] = useState(
    typeof location.state?.email === 'string'
      ? location.state.email
      : '',
  )
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [isSubmitted, setIsSubmitted] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await requestPasswordReset({ email })
      setIsSubmitted(true)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PasswordRecoveryCard
      title="איפוס סיסמה"
      description="הזינו את כתובת האימייל שאיתה נרשמתם לזיכרון חי."
    >
      {isSubmitted ? (
        <div className="auth-recovery-result">
          <p
            className="form-notice"
            role="status"
          >
            אם קיים חשבון עם כתובת האימייל הזאת,
            שלחנו אליו קישור לאיפוס הסיסמה.
          </p>
          <Link
            className="primary-button"
            to="/login"
            data-aura-tooltip="לחזור לכניסה לחשבון"
          >
            חזרה לכניסה לחשבון
          </Link>
        </div>
      ) : (
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          <label className="form-field">
            <span>כתובת אימייל</span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
              }}
              maxLength={254}
              autoComplete="email"
              autoFocus
              dir="ltr"
              required
            />
          </label>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="primary-button submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'שולחים...'
              : 'שלחו לי קישור לאיפוס הסיסמה'}
          </button>
        </form>
      )}
    </PasswordRecoveryCard>
  )
}

function ResetPasswordPage({
  onAuthenticationChange,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() =>
    new URLSearchParams(
      location.search,
    ).get('token') ?? '',
  )
  const [password, setPassword] =
    useState('')
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('')
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [isComplete, setIsComplete] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState('')
  const hasValidTokenShape =
    /^[A-Za-z0-9_-]{43}$/.test(token)

  useEffect(() => {
    if (location.search.includes('token=')) {
      navigate('/reset-password', {
        replace: true,
      })
    }
  }, [location.search, navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (password !== passwordConfirmation) {
      setErrorMessage('הסיסמאות אינן זהות.')
      return
    }

    setIsSubmitting(true)

    try {
      await submitNewPassword({
        token,
        password,
      })
      onAuthenticationChange(null)
      setIsComplete(true)
      setPassword('')
      setPasswordConfirmation('')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!hasValidTokenShape) {
    return (
      <PasswordRecoveryCard
        title="קישור איפוס לא תקין"
        description="קישור איפוס הסיסמה אינו תקף או שפג תוקפו. בקשו קישור חדש."
      >
        <div className="auth-recovery-links">
          <Link
            className="primary-button"
            to="/forgot-password"
          >
            בקשת קישור חדש
          </Link>
          <Link
            className="secondary-button"
            to="/login"
          >
            כניסה לחשבון
          </Link>
        </div>
      </PasswordRecoveryCard>
    )
  }

  if (isComplete) {
    return (
      <PasswordRecoveryCard
        title="הסיסמה עודכנה בהצלחה"
        description="כעת אפשר להיכנס לחשבון באמצעות הסיסמה החדשה."
      >
        <div className="auth-recovery-links">
          <Link
            className="primary-button"
            to="/login"
            data-aura-tooltip="להיכנס באמצעות הסיסמה החדשה"
          >
            כניסה לחשבון
          </Link>
        </div>
      </PasswordRecoveryCard>
    )
  }

  return (
    <PasswordRecoveryCard
      title="בחירת סיסמה חדשה"
      description="בחרו סיסמה חדשה לחשבון. הסיסמה צריכה להכיל 15 תווים לפחות."
    >
      <form
        className="auth-form"
        onSubmit={handleSubmit}
        aria-busy={isSubmitting}
      >
        <label className="form-field">
          <span>סיסמה חדשה</span>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
            minLength={15}
            maxLength={128}
            autoComplete="new-password"
            autoFocus
            dir="ltr"
            required
          />
        </label>

        <label className="form-field">
          <span>אימות הסיסמה החדשה</span>
          <input
            type="password"
            value={passwordConfirmation}
            onChange={(event) => {
              setPasswordConfirmation(
                event.target.value,
              )
            }}
            minLength={15}
            maxLength={128}
            autoComplete="new-password"
            dir="ltr"
            required
          />
        </label>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="primary-button submit-button"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'מעדכנים...'
            : 'עדכון הסיסמה'}
        </button>
      </form>
    </PasswordRecoveryCard>
  )
}

function App() {
  const [
    authentication,
    setAuthentication,
  ] = useState(null)

  const [initializing, setInitializing] =
    useState(true)

  const [startupError, setStartupError] =
    useState('')

  useEffect(() => {
    let isActive = true

    async function restoreSession() {
      try {
        const restoredAuthentication =
          await refreshSession()

        if (isActive) {
          setAuthentication(
            restoredAuthentication,
          )
        }
      } catch (error) {
        if (
          isActive &&
          error instanceof ApiError &&
          error.code !==
            'INVALID_REFRESH_TOKEN'
        ) {
          setStartupError(
            getErrorMessage(error),
          )
        }
      } finally {
        if (isActive) {
          setInitializing(false)
        }
      }
    }

    restoreSession()

    return () => {
      isActive = false
    }
  }, [])

  const memoryChatPage = (
    <MemoryChatPage
      authentication={authentication}
      onAuthenticationChange={
        setAuthentication
      }
    />
  )

  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            user={authentication?.user}
            initializing={initializing}
            startupError={startupError}
          />
        }
      />

      <Route
        path="/privacy"
        element={<PrivacyPage />}
      />

      <Route
        path="/terms"
        element={<TermsPage />}
      />

      <Route
        path="/login"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <Navigate
              to="/app"
              replace
            />
          ) : (
            <AuthPage
              key="login"
              mode="login"
              onAuthenticated={
                setAuthentication
              }
            />
          )
        }
      />

      <Route
        path="/register"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <Navigate
              to="/app"
              replace
            />
          ) : (
            <AuthPage
              key="register"
              mode="register"
              onAuthenticated={
                setAuthentication
              }
            />
          )
        }
      />

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />

      <Route
        path="/reset-password"
        element={
          <ResetPasswordPage
            onAuthenticationChange={
              setAuthentication
            }
          />
        }
      />

      <Route
        path="/invitation"
        element={
          initializing ? (
            <LoadingScreen />
          ) : (
            <InvitationAcceptPage
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          )
        }
      />

      <Route
        path="/app"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryDashboard
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/admin"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user?.systemRole ===
            'admin' ? (
            <AdminDashboard
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : authentication?.user ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryProfilePage
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/family"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <FamilyAccessPage
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/pilot"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryPilotPage
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/pricing-pilot"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryPricingPilotPage
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/chat"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            memoryChatPage
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/chat/:conversationId"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            memoryChatPage
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  )
}

export default App
