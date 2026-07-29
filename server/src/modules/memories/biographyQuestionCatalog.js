export const BIOGRAPHY_QUESTION_BATCH_SIZE = 5

function defineQuestion(
  key,
  category,
  question,
  options,
) {
  if (options.length !== 4) {
    throw new TypeError(
      `Biography question "${key}" must contain exactly four options.`,
    )
  }

  return Object.freeze({
    key,
    category,
    question,
    options: Object.freeze(
      options.map(
        ([optionKey, label]) =>
          Object.freeze({
            key: optionKey,
            label,
          }),
      ),
    ),
  })
}

export const BIOGRAPHY_QUESTIONS =
  Object.freeze([
    defineQuestion(
      'birth_place_type',
      'background',
      'באיזה סוג מקום נולד האדם?',
      [
        ['large_city', 'עיר גדולה'],
        ['small_town', 'עיר או עיירה קטנה'],
        ['village', 'מושב, קיבוץ או כפר'],
        ['rural_area', 'אזור כפרי או מרוחק'],
      ],
    ),
    defineQuestion(
      'childhood_environment',
      'background',
      'באיזו סביבה עברו רוב שנות הילדות?',
      [
        ['urban', 'סביבה עירונית'],
        ['suburban', 'שכונה שקטה בפרברי עיר'],
        ['rural', 'סביבה כפרית'],
        ['changing', 'כמה מקומות וסביבות שונות'],
      ],
    ),
    defineQuestion(
      'home_language',
      'background',
      'איזה תיאור מתאים לשפות שנשמעו בבית?',
      [
        ['one_language', 'דיברו בעיקר בשפה אחת'],
        ['two_languages', 'דיברו בשתי שפות'],
        ['many_languages', 'דיברו בכמה שפות'],
        ['language_changed', 'השפה המרכזית השתנתה עם השנים'],
      ],
    ),
    defineQuestion(
      'sibling_position',
      'background',
      'מה היה מקומו בין האחים והאחיות?',
      [
        ['oldest', 'הבכור או הבכורה'],
        ['middle', 'באמצע המשפחה'],
        ['youngest', 'הצעיר או הצעירה'],
        ['only_child', 'בן או בת יחידים'],
      ],
    ),
    defineQuestion(
      'family_home_atmosphere',
      'background',
      'איזו אווירה אפיינה בדרך כלל את בית הילדות?',
      [
        ['warm_lively', 'חמה ומלאת חיים'],
        ['quiet_ordered', 'שקטה ומסודרת'],
        ['traditional', 'מסורתית ומשפחתית'],
        ['busy_dynamic', 'עמוסה ומשתנה'],
      ],
    ),
    defineQuestion(
      'childhood_community',
      'background',
      'עד כמה הקהילה הייתה חלק מחיי המשפחה?',
      [
        ['central', 'הקהילה הייתה חלק מרכזי מאוד'],
        ['regular', 'הייתה מעורבות קבועה'],
        ['occasional', 'הייתה מעורבות מדי פעם'],
        ['private_family', 'החיים התמקדו בעיקר במשפחה הפרטית'],
      ],
    ),
    defineQuestion(
      'family_tradition_strength',
      'background',
      'איזה מקום תפסו מסורות משפחתיות בבית?',
      [
        ['very_strong', 'המסורות היו מרכזיות מאוד'],
        ['regular', 'נשמרו מסורות קבועות'],
        ['selected', 'נשמרו רק מסורות מסוימות'],
        ['flexible', 'המסורות השתנו לפי התקופה'],
      ],
    ),
    defineQuestion(
      'childhood_home_style',
      'background',
      'איזה תיאור מתאים ביותר לבית שבו גדל?',
      [
        ['open_home', 'בית פתוח לאורחים'],
        ['private_home', 'בית משפחתי ופרטי'],
        ['busy_home', 'בית עמוס באנשים ובפעילות'],
        ['calm_home', 'בית שקט ורגוע'],
      ],
    ),
    defineQuestion(
      'childhood_moves',
      'background',
      'כיצד נראו המעברים בין מקומות מגורים בילדות?',
      [
        ['same_home', 'גדל בעיקר באותו בית'],
        ['same_area', 'עבר דירה בתוך אותו אזור'],
        ['several_places', 'עבר בין כמה מקומות'],
        ['major_move', 'חווה מעבר משמעותי לאזור או למדינה אחרת'],
      ],
    ),
    defineQuestion(
      'early_family_identity',
      'background',
      'מה היה המרכיב המרכזי בזהות המשפחתית?',
      [
        ['extended_family', 'המשפחה המורחבת'],
        ['faith_tradition', 'אמונה ומסורת'],
        ['community', 'קהילה ומקום מגורים'],
        ['work_achievement', 'עבודה, לימודים והישגים'],
      ],
    ),

    defineQuestion(
      'childhood_social_style',
      'childhood',
      'כיצד התנהג בדרך כלל בחברה בילדות?',
      [
        ['quiet_observer', 'שקט ומתבונן'],
        ['social_active', 'חברותי ופעיל'],
        ['small_circle', 'העדיף מעגל חברים קטן'],
        ['changed_by_setting', 'התנהג אחרת בכל מסגרת'],
      ],
    ),
    defineQuestion(
      'favorite_childhood_activity',
      'childhood',
      'איזה סוג פעילות אהב במיוחד בילדות?',
      [
        ['outdoor_play', 'משחקים ופעילות בחוץ'],
        ['creative_play', 'יצירה, ציור או מוזיקה'],
        ['reading_learning', 'קריאה ולמידה'],
        ['social_games', 'משחקים עם חברים ומשפחה'],
      ],
    ),
    defineQuestion(
      'childhood_responsibility',
      'childhood',
      'איזו אחריות הייתה לו בדרך כלל בילדות?',
      [
        ['home_tasks', 'עזרה בעבודות הבית'],
        ['siblings', 'טיפול או עזרה לאחים'],
        ['family_work', 'עזרה בעסק או בעבודת המשפחה'],
        ['few_duties', 'מעט אחריות קבועה'],
      ],
    ),
    defineQuestion(
      'school_attitude',
      'childhood',
      'מה הייתה הגישה הכללית שלו לבית הספר?',
      [
        ['loved_school', 'אהב ללמוד ולהגיע לבית הספר'],
        ['social_focus', 'אהב בעיקר את הצד החברתי'],
        ['specific_subjects', 'התחבר רק למקצועות מסוימים'],
        ['school_challenging', 'בית הספר היה עבורו אתגר'],
      ],
    ),
    defineQuestion(
      'childhood_curiosity',
      'childhood',
      'כיצד באה לידי ביטוי הסקרנות שלו?',
      [
        ['many_questions', 'שאל הרבה שאלות'],
        ['hands_on', 'פירק, בנה וניסה בעצמו'],
        ['books_stories', 'חיפש תשובות בספרים ובסיפורים'],
        ['people_observation', 'למד מהתבוננות באנשים'],
      ],
    ),
    defineQuestion(
      'childhood_challenge_response',
      'childhood',
      'כיצד התמודד בדרך כלל עם קושי בילדות?',
      [
        ['persistent', 'התעקש עד שהצליח'],
        ['asked_help', 'ביקש עזרה מאדם קרוב'],
        ['thought_quietly', 'התרחק וחשב בשקט'],
        ['adapted_quickly', 'הסתגל ושינה כיוון'],
      ],
    ),
    defineQuestion(
      'childhood_free_time',
      'childhood',
      'עם מי בילה בדרך כלל את זמנו הפנוי?',
      [
        ['family', 'בעיקר עם המשפחה'],
        ['close_friends', 'עם כמה חברים קרובים'],
        ['large_group', 'עם קבוצת חברים גדולה'],
        ['often_alone', 'לעיתים קרובות לבד'],
      ],
    ),
    defineQuestion(
      'childhood_friendship',
      'childhood',
      'מה אפיין את החברויות שלו בילדות?',
      [
        ['long_term', 'חברויות עמוקות וארוכות'],
        ['many_friends', 'הרבה חברים ומכרים'],
        ['one_best_friend', 'חבר או חברה קרובים במיוחד'],
        ['changing_friends', 'חברויות שהשתנו בין מסגרות'],
      ],
    ),
    defineQuestion(
      'childhood_memory_tone',
      'childhood',
      'איזה רגש עולה בעיקר מסיפורי הילדות?',
      [
        ['joy', 'שמחה וחופש'],
        ['belonging', 'משפחה ושייכות'],
        ['challenge', 'מאמץ והתמודדות'],
        ['adventure', 'הרפתקה וגילוי'],
      ],
    ),
    defineQuestion(
      'childhood_dream',
      'childhood',
      'איזה סוג חלום היה לו לגבי העתיד?',
      [
        ['help_people', 'לעזור לאנשים'],
        ['create_build', 'ליצור או לבנות משהו'],
        ['lead_succeed', 'להוביל ולהצליח'],
        ['explore_world', 'לגלות מקומות ורעיונות חדשים'],
      ],
    ),

    defineQuestion(
      'learning_style',
      'education_work',
      'כיצד למד בצורה הטובה ביותר?',
      [
        ['reading', 'קריאה ולימוד עצמאי'],
        ['listening', 'הקשבה והסבר בעל פה'],
        ['practice', 'תרגול והתנסות מעשית'],
        ['discussion', 'שיחה וחשיבה עם אחרים'],
      ],
    ),
    defineQuestion(
      'education_path',
      'education_work',
      'איזה מסלול לימודים אפיין אותו?',
      [
        ['academic', 'לימודים עיוניים או אקדמיים'],
        ['professional', 'הכשרה מקצועית'],
        ['self_taught', 'למידה עצמית מתוך ניסיון'],
        ['mixed_path', 'שילוב של כמה מסלולים'],
      ],
    ),
    defineQuestion(
      'strongest_school_area',
      'education_work',
      'באיזה תחום לימודי בלט במיוחד?',
      [
        ['language_humanities', 'שפות, ספרות ומדעי הרוח'],
        ['science_math', 'מדעים ומתמטיקה'],
        ['arts', 'אמנות, מוזיקה ויצירה'],
        ['practical_social', 'תחומים מעשיים או חברתיים'],
      ],
    ),
    defineQuestion(
      'work_field_style',
      'education_work',
      'איזה סוג עבודה התאים לו במיוחד?',
      [
        ['people_service', 'עבודה עם אנשים ושירות'],
        ['technical_practical', 'עבודה טכנית או מעשית'],
        ['creative', 'עבודה יצירתית'],
        ['management_business', 'ניהול, ארגון או עסקים'],
      ],
    ),
    defineQuestion(
      'work_motivation',
      'education_work',
      'מה הניע אותו בעיקר בעבודה?',
      [
        ['helping', 'היכולת לעזור לאחרים'],
        ['stability', 'יציבות וביטחון'],
        ['achievement', 'הצלחה והתקדמות'],
        ['interest', 'עניין, סקרנות ומשמעות'],
      ],
    ),
    defineQuestion(
      'workplace_role',
      'education_work',
      'איזה תפקיד לקח בדרך כלל בתוך צוות?',
      [
        ['leader', 'הוביל וקיבל החלטות'],
        ['organizer', 'ארגן ודאג לפרטים'],
        ['expert', 'היה מקור לידע מקצועי'],
        ['supporter', 'תמך וחיבר בין האנשים'],
      ],
    ),
    defineQuestion(
      'problem_solving_style',
      'education_work',
      'כיצד ניגש בדרך כלל לבעיה מורכבת?',
      [
        ['planned', 'תכנן שלב אחר שלב'],
        ['intuitive', 'פעל לפי תחושת בטן וניסיון'],
        ['consulted', 'התייעץ עם אנשים'],
        ['experimented', 'ניסה כמה פתרונות עד שהצליח'],
      ],
    ),
    defineQuestion(
      'career_stability',
      'education_work',
      'כיצד נראתה הדרך המקצועית שלו?',
      [
        ['one_field', 'נשאר לאורך זמן בתחום אחד'],
        ['related_roles', 'עבר בין תפקידים קרובים'],
        ['many_fields', 'עבד בכמה תחומים שונים'],
        ['work_changed_by_life', 'העבודה השתנתה לפי נסיבות החיים'],
      ],
    ),
    defineQuestion(
      'work_relationships',
      'education_work',
      'מה היה חשוב לו ביחסים במקום העבודה?',
      [
        ['trust', 'אמון ונאמנות'],
        ['professionalism', 'מקצועיות ואחריות'],
        ['warmth', 'יחסים חמים ומשפחתיים'],
        ['independence', 'עצמאות ומרחב אישי'],
      ],
    ),
    defineQuestion(
      'professional_pride',
      'education_work',
      'במה היה גאה במיוחד בעשייה המקצועית שלו?',
      [
        ['quality', 'באיכות העבודה'],
        ['people_impact', 'בהשפעה על אנשים'],
        ['persistence', 'בהתמדה לאורך השנים'],
        ['innovation', 'ברעיונות ובפתרונות חדשים'],
      ],
    ),

    defineQuestion(
      'family_role',
      'relationships',
      'איזה תפקיד מילא בדרך כלל במשפחה?',
      [
        ['leader', 'מוביל ומקבל החלטות'],
        ['caregiver', 'מטפל ודואג'],
        ['mediator', 'מחבר ומפשר'],
        ['joy_creator', 'מכניס שמחה ואווירה טובה'],
      ],
    ),
    defineQuestion(
      'affection_expression',
      'relationships',
      'כיצד הביע בדרך כלל אהבה וחיבה?',
      [
        ['words', 'במילים ובמחמאות'],
        ['actions', 'במעשים ובעזרה'],
        ['time', 'בזמן משותף ובהקשבה'],
        ['gifts_food', 'במתנות, אוכל ומחוות'],
      ],
    ),
    defineQuestion(
      'communication_style',
      'relationships',
      'כיצד נהג לתקשר עם אנשים קרובים?',
      [
        ['direct', 'ישירות ובפתיחות'],
        ['gentle', 'בעדינות וברמזים'],
        ['humorous', 'באמצעות הומור'],
        ['reserved', 'במעט מילים ובמעשים'],
      ],
    ),
    defineQuestion(
      'conflict_style',
      'relationships',
      'כיצד נהג להתמודד עם מחלוקת?',
      [
        ['talk_immediately', 'דיבר מיד כדי לפתור'],
        ['calm_first', 'חיכה להירגע ואז דיבר'],
        ['compromise', 'חיפש פשרה'],
        ['avoided_conflict', 'העדיף להימנע מעימות'],
      ],
    ),
    defineQuestion(
      'hosting_style',
      'relationships',
      'כיצד נראתה הכנסת האורחים שלו?',
      [
        ['large_meals', 'ארוחות גדולות ושפע'],
        ['personal_attention', 'יחס אישי והקשבה'],
        ['spontaneous', 'אירוח פשוט וספונטני'],
        ['rare_formal', 'אירוח נדיר ומתוכנן'],
      ],
    ),
    defineQuestion(
      'support_style',
      'relationships',
      'כיצד תמך באדם שעבר תקופה קשה?',
      [
        ['listened', 'הקשיב ונתן מקום'],
        ['practical_help', 'הציע עזרה מעשית'],
        ['advice', 'נתן עצה וכיוון'],
        ['encouraged', 'עודד וחיזק את התקווה'],
      ],
    ),
    defineQuestion(
      'parenting_style',
      'relationships',
      'איזו גישה אפיינה אותו כהורה או כדמות מטפלת?',
      [
        ['warm_protective', 'חמה ומגוננת'],
        ['structured', 'מסודרת ובעלת גבולות'],
        ['encouraging', 'מעודדת עצמאות וניסיון'],
        ['example_based', 'חינוך בעיקר באמצעות דוגמה אישית'],
      ],
    ),
    defineQuestion(
      'grandparenting_style',
      'relationships',
      'כיצד התנהג עם ילדים צעירים במשפחה?',
      [
        ['playful', 'שיחק וצחק איתם'],
        ['storyteller', 'סיפר סיפורים ולימד'],
        ['pampering', 'פינק ודאג להם'],
        ['calm_presence', 'העניק נוכחות שקטה ובטוחה'],
      ],
    ),
    defineQuestion(
      'family_contact_frequency',
      'relationships',
      'איזה קשר העדיף לשמור עם המשפחה?',
      [
        ['daily', 'קשר יומיומי'],
        ['weekly', 'מפגשים או שיחות שבועיות'],
        ['events', 'בעיקר בשבתות, חגים ואירועים'],
        ['independent', 'קשר אוהב עם הרבה עצמאות'],
      ],
    ),
    defineQuestion(
      'relationship_priority',
      'relationships',
      'מה היה חשוב לו ביותר בקשר קרוב?',
      [
        ['loyalty', 'נאמנות'],
        ['honesty', 'כנות'],
        ['understanding', 'הבנה והקשבה'],
        ['shared_time', 'זמן וחוויות משותפות'],
      ],
    ),

    defineQuestion(
      'social_energy',
      'personality',
      'מאין קיבל בדרך כלל אנרגיה?',
      [
        ['people', 'ממפגש עם אנשים'],
        ['quiet', 'משקט וזמן אישי'],
        ['small_group', 'ממפגש עם אנשים קרובים'],
        ['balanced', 'משילוב בין חברה לשקט'],
      ],
    ),
    defineQuestion(
      'decision_style',
      'personality',
      'כיצד קיבל בדרך כלל החלטות?',
      [
        ['logical', 'לאחר ניתוח הגיוני'],
        ['intuitive', 'לפי תחושת בטן'],
        ['consultative', 'לאחר התייעצות'],
        ['careful_time', 'לאחר זמן רב של מחשבה'],
      ],
    ),
    defineQuestion(
      'daily_pace',
      'personality',
      'איזה קצב חיים התאים לו?',
      [
        ['fast', 'מהיר ומלא פעילות'],
        ['steady', 'קבוע ומאוזן'],
        ['calm', 'רגוע וללא לחץ'],
        ['variable', 'משתנה לפי התקופה'],
      ],
    ),
    defineQuestion(
      'optimism_style',
      'personality',
      'כיצד הביט בדרך כלל על העתיד?',
      [
        ['very_optimistic', 'באופטימיות ובביטחון'],
        ['realistic_positive', 'בחיוביות מציאותית'],
        ['careful', 'בזהירות ובתכנון'],
        ['worried_but_active', 'בדאגה, אך המשיך לפעול'],
      ],
    ),
    defineQuestion(
      'humor_style',
      'personality',
      'איזה סוג הומור אפיין אותו?',
      [
        ['warm', 'הומור חם ומשפחתי'],
        ['witty', 'שנינות ומשחקי מילים'],
        ['storytelling', 'סיפורים מצחיקים'],
        ['quiet_smile', 'חיוך והומור עדין'],
      ],
    ),
    defineQuestion(
      'order_style',
      'personality',
      'מה היה היחס שלו לסדר ולתכנון?',
      [
        ['very_ordered', 'מסודר ומתוכנן מאוד'],
        ['generally_ordered', 'מסודר ברוב הדברים'],
        ['flexible', 'גמיש ולא צמוד לתוכניות'],
        ['spontaneous', 'ספונטני ומאלתר'],
      ],
    ),
    defineQuestion(
      'change_response',
      'personality',
      'כיצד הגיב בדרך כלל לשינוי?',
      [
        ['welcomed', 'קיבל שינוי בהתלהבות'],
        ['adapted', 'הסתגל לאחר זמן קצר'],
        ['needed_preparation', 'נזקק להכנה ולוודאות'],
        ['preferred_familiar', 'העדיף את המוכר והקבוע'],
      ],
    ),
    defineQuestion(
      'leadership_style',
      'personality',
      'איזה סוג הנהגה אפיין אותו?',
      [
        ['decisive', 'החלטי וברור'],
        ['collaborative', 'משתף ומתייעץ'],
        ['quiet_example', 'מוביל בשקט ובדוגמה אישית'],
        ['supportive', 'מעצים אחרים מאחורי הקלעים'],
      ],
    ),
    defineQuestion(
      'emotional_expression',
      'personality',
      'כיצד ביטא בדרך כלל רגשות?',
      [
        ['open', 'בפתיחות ובמילים'],
        ['actions', 'בעיקר באמצעות מעשים'],
        ['close_people', 'רק עם אנשים קרובים'],
        ['private', 'שמר את רגשותיו לעצמו'],
      ],
    ),
    defineQuestion(
      'patience_style',
      'personality',
      'באילו מצבים גילה את מירב הסבלנות?',
      [
        ['people', 'כלפי אנשים'],
        ['work', 'בעבודה ובמשימות'],
        ['teaching', 'בהסבר ובהוראה'],
        ['challenges', 'בתקופות של קושי'],
      ],
    ),

    defineQuestion(
      'preferred_time_of_day',
      'preferences',
      'איזו שעה ביום אהב במיוחד?',
      [
        ['morning', 'בוקר'],
        ['afternoon', 'צהריים'],
        ['evening', 'ערב'],
        ['night', 'לילה'],
      ],
    ),
    defineQuestion(
      'preferred_season',
      'preferences',
      'איזו עונה התאימה לו במיוחד?',
      [
        ['spring', 'אביב'],
        ['summer', 'קיץ'],
        ['autumn', 'סתיו'],
        ['winter', 'חורף'],
      ],
    ),
    defineQuestion(
      'preferred_environment',
      'preferences',
      'באיזו סביבה הרגיש בנוח במיוחד?',
      [
        ['home', 'בבית'],
        ['nature', 'בטבע'],
        ['city', 'בעיר ובמקומות פעילים'],
        ['community', 'במפגש משפחתי או קהילתי'],
      ],
    ),
    defineQuestion(
      'music_preference',
      'preferences',
      'איזה סוג מוזיקה או צליל אהב במיוחד?',
      [
        ['traditional', 'מוזיקה מסורתית'],
        ['popular', 'מוזיקה פופולרית'],
        ['classical', 'מוזיקה קלאסית או אינסטרומנטלית'],
        ['quiet_no_music', 'שקט או מעט מאוד מוזיקה'],
      ],
    ),
    defineQuestion(
      'food_preference',
      'preferences',
      'איזה סוג אוכל אהב במיוחד?',
      [
        ['home_cooking', 'אוכל ביתי מסורתי'],
        ['simple_food', 'אוכל פשוט ומוכר'],
        ['new_flavors', 'טעמים ומאכלים חדשים'],
        ['sweets_baking', 'מתוקים ומאפים'],
      ],
    ),
    defineQuestion(
      'travel_preference',
      'preferences',
      'איזה סוג טיול התאים לו?',
      [
        ['nature_trip', 'טיול בטבע'],
        ['city_culture', 'ערים, תרבות ואתרים'],
        ['family_visit', 'ביקור אצל משפחה'],
        ['home_preference', 'העדיף להישאר קרוב לבית'],
      ],
    ),
    defineQuestion(
      'leisure_preference',
      'preferences',
      'כיצד אהב לבלות זמן פנוי?',
      [
        ['family_time', 'עם המשפחה'],
        ['hobby', 'בעיסוק בתחביב'],
        ['friends', 'עם חברים'],
        ['rest', 'במנוחה ובשקט'],
      ],
    ),
    defineQuestion(
      'reading_media_preference',
      'preferences',
      'איזה תוכן עניין אותו במיוחד?',
      [
        ['news_history', 'חדשות והיסטוריה'],
        ['stories', 'סיפורים וספרות'],
        ['practical_learning', 'ידע מעשי ולימודי'],
        ['entertainment', 'בידור ותוכניות קלילות'],
      ],
    ),
    defineQuestion(
      'celebration_preference',
      'preferences',
      'כיצד אהב לציין אירועים מיוחדים?',
      [
        ['large_gathering', 'מפגש משפחתי גדול'],
        ['small_gathering', 'מפגש מצומצם ואישי'],
        ['meal', 'ארוחה חגיגית'],
        ['simple_marking', 'ציון פשוט ללא אירוע גדול'],
      ],
    ),
    defineQuestion(
      'personal_style',
      'preferences',
      'איזה סגנון אישי אפיין אותו?',
      [
        ['classic', 'קלאסי ומסודר'],
        ['practical', 'מעשי ונוח'],
        ['colorful', 'צבעוני ובולט'],
        ['simple', 'פשוט וצנוע'],
      ],
    ),

    defineQuestion(
      'central_value',
      'values',
      'איזה ערך היה מרכזי במיוחד בחייו?',
      [
        ['family', 'משפחה'],
        ['faith', 'אמונה ומסורת'],
        ['kindness', 'חסד ועזרה לאחרים'],
        ['responsibility', 'אחריות ועבודה'],
      ],
    ),
    defineQuestion(
      'faith_role',
      'values',
      'איזה מקום תפסה האמונה בחייו?',
      [
        ['central_daily', 'מרכזית בחיי היום־יום'],
        ['traditional', 'חלק מהמסורת והמשפחה'],
        ['personal', 'קשר אישי ושקט'],
        ['changing', 'השתנתה בתקופות שונות'],
      ],
    ),
    defineQuestion(
      'giving_style',
      'values',
      'כיצד נהג לתת ולעזור לאחרים?',
      [
        ['quietly', 'בסתר וללא פרסום'],
        ['practical', 'בעזרה מעשית'],
        ['emotionally', 'בהקשבה ובתמיכה'],
        ['community', 'באמצעות פעילות קהילתית'],
      ],
    ),
    defineQuestion(
      'honesty_style',
      'values',
      'כיצד ביטא את ערך הכנות?',
      [
        ['direct_truth', 'אמר את האמת באופן ישיר'],
        ['gentle_truth', 'אמר אמת בעדינות'],
        ['kept_promises', 'הקפיד לקיים הבטחות'],
        ['fair_actions', 'ביטא יושר בעיקר במעשיו'],
      ],
    ),
    defineQuestion(
      'community_contribution',
      'values',
      'כיצד תרם בדרך כלל לסביבתו?',
      [
        ['volunteering', 'התנדבות ופעילות ציבורית'],
        ['personal_help', 'עזרה אישית לאנשים'],
        ['professional_help', 'שימוש בידע המקצועי לטובת אחרים'],
        ['family_support', 'תמיכה במשפחה המורחבת'],
      ],
    ),
    defineQuestion(
      'money_attitude',
      'values',
      'איזו גישה הייתה לו לכסף ולרכוש?',
      [
        ['careful_saver', 'חסכונית וזהירה'],
        ['generous', 'נדיבה כלפי אחרים'],
        ['practical', 'מעשית ומאוזנת'],
        ['experience_focused', 'העדיף חוויות על פני רכוש'],
      ],
    ),
    defineQuestion(
      'tradition_and_change',
      'values',
      'כיצד שילב בין מסורת לשינוי?',
      [
        ['preserved_tradition', 'שמר בקפידה על המסורת'],
        ['adapted_tradition', 'התאים את המסורת לחיים המשתנים'],
        ['selected_traditions', 'בחר מסורות מסוימות'],
        ['welcomed_change', 'העדיף חידוש ושינוי'],
      ],
    ),
    defineQuestion(
      'success_definition',
      'values',
      'מה נחשב בעיניו להצלחה בחיים?',
      [
        ['good_family', 'משפחה טובה ומאוחדת'],
        ['meaningful_work', 'עשייה ועבודה בעלת משמעות'],
        ['helping_people', 'עזרה והשפעה על אחרים'],
        ['inner_peace', 'שלווה וסיפוק אישי'],
      ],
    ),
    defineQuestion(
      'desired_legacy',
      'values',
      'כיצד היה רוצה שיזכרו אותו?',
      [
        ['loving', 'כאדם אוהב ומשפחתי'],
        ['generous', 'כאדם טוב ונדיב'],
        ['strong', 'כאדם חזק ומתמיד'],
        ['wise', 'כאדם חכם ומלמד'],
      ],
    ),
    defineQuestion(
      'difficult_choice_anchor',
      'values',
      'מה בדרך כלל הנחה אותו בהחלטה קשה?',
      [
        ['principles', 'עקרונות ואמונה'],
        ['family_needs', 'טובת המשפחה'],
        ['practical_result', 'התוצאה המעשית'],
        ['trusted_advice', 'עצה של אדם שסמך עליו'],
      ],
    ),

    defineQuestion(
      'response_to_loss',
      'life_events',
      'מה עזר לו להתמודד עם אובדן או פרידה?',
      [
        ['family_support', 'תמיכת המשפחה'],
        ['faith', 'אמונה ותפילה'],
        ['routine_work', 'שגרה ועשייה'],
        ['private_time', 'זמן אישי ועיבוד שקט'],
      ],
    ),
    defineQuestion(
      'response_to_major_change',
      'life_events',
      'כיצד התמודד עם שינוי גדול בחיים?',
      [
        ['planned', 'תכנן והתכונן'],
        ['adapted_gradually', 'הסתגל בהדרגה'],
        ['leaned_on_people', 'נשען על אנשים קרובים'],
        ['acted_quickly', 'פעל במהירות והתקדם'],
      ],
    ),
    defineQuestion(
      'happiest_period',
      'life_events',
      'איזו תקופה נתפסה כאחת התקופות המאושרות בחייו?',
      [
        ['childhood', 'הילדות והנעורים'],
        ['young_adulthood', 'ראשית החיים הבוגרים'],
        ['raising_family', 'הקמת המשפחה וגידול הילדים'],
        ['later_years', 'השנים המאוחרות יותר'],
      ],
    ),
    defineQuestion(
      'proudest_achievement',
      'life_events',
      'באיזה סוג הישג היה גאה במיוחד?',
      [
        ['family', 'הישג משפחתי'],
        ['professional', 'הישג מקצועי'],
        ['personal_growth', 'התגברות או צמיחה אישית'],
        ['community', 'תרומה לאדם או לקהילה'],
      ],
    ),
    defineQuestion(
      'turning_point',
      'life_events',
      'איזה סוג אירוע שינה את מסלול חייו?',
      [
        ['relationship', 'היכרות או קשר משמעותי'],
        ['move', 'מעבר מקום או הגירה'],
        ['career', 'שינוי לימודי או מקצועי'],
        ['challenge', 'אתגר בריאותי או משפחתי'],
      ],
    ),
    defineQuestion(
      'resilience_source',
      'life_events',
      'מאין שאב כוח בתקופות קשות?',
      [
        ['family', 'מהמשפחה'],
        ['faith', 'מהאמונה'],
        ['inner_strength', 'מכוח הרצון והאופי'],
        ['friends_community', 'מחברים ומהקהילה'],
      ],
    ),
    defineQuestion(
      'important_place',
      'life_events',
      'איזה סוג מקום היה משמעותי במיוחד עבורו?',
      [
        ['childhood_home', 'בית הילדות'],
        ['family_home', 'הבית שהקים'],
        ['work_place', 'מקום העבודה או הלימודים'],
        ['community_place', 'בית כנסת או מקום קהילתי'],
      ],
    ),
    defineQuestion(
      'important_influence',
      'life_events',
      'מי השפיע במיוחד על הדרך שבה חי?',
      [
        ['parent', 'הורה או בן משפחה מבוגר'],
        ['partner', 'בן או בת זוג'],
        ['teacher', 'מורה, רב או מדריך'],
        ['friend_colleague', 'חבר או עמית'],
      ],
    ),
    defineQuestion(
      'life_lesson',
      'life_events',
      'איזה מסר חזר בסיפורים ובעצות שלו?',
      [
        ['family_first', 'לשמור על המשפחה'],
        ['work_hard', 'לעבוד ולהתמיד'],
        ['be_kind', 'להיות אדם טוב'],
        ['keep_faith', 'לשמור על אמונה ותקווה'],
      ],
    ),
    defineQuestion(
      'message_to_future',
      'life_events',
      'איזה מסר היה רוצה להעביר לדורות הבאים?',
      [
        ['stay_connected', 'הישארו מאוחדים ושמרו על קשר'],
        ['live_with_values', 'חיו לפי ערכים ועקרונות'],
        ['keep_learning', 'המשיכו ללמוד ולהתפתח'],
        ['enjoy_life', 'שמחו והעריכו את החיים'],
      ],
    ),
  ])

const questionByKey = new Map(
  BIOGRAPHY_QUESTIONS.map(
    (question) => [
      question.key,
      question,
    ],
  ),
)

if (
  questionByKey.size !==
  BIOGRAPHY_QUESTIONS.length
) {
  throw new TypeError(
    'Biography question keys must be unique.',
  )
}

export function getBiographyQuestion(
  questionKey,
) {
  return (
    questionByKey.get(questionKey) ??
    null
  )
}