import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  getBiographyQuestion,
} from '../src/modules/memories/biographyQuestionCatalog.js'
import {
  personalizeBiographyQuestion,
  personalizeSubjectText,
} from '../src/modules/memories/subjectLanguage.js'

describe('subject-aware Hebrew language', () => {
  it('uses the selected name and feminine grammar in biography questions', () => {
    const question =
      personalizeBiographyQuestion(
        getBiographyQuestion(
          'school_attitude',
        ),
        {
          subjectName: 'אורה',
          subjectGender: 'female',
        },
      )

    expect(question.question).toBe(
      'מה הייתה הגישה הכללית שלה לבית הספר?',
    )

    expect(question.options[0].label).toBe(
      'אהבה ללמוד ולהגיע לבית הספר',
    )
  })

  it('keeps unrelated words intact while applying feminine grammar', () => {
    expect(
      personalizeSubjectText(
        'שלווה וסיפוק אישי',
        {
          subjectName: 'אורה',
          subjectGender: 'female',
        },
      ),
    ).toBe('שלווה וסיפוק אישי')

    expect(
      personalizeBiographyQuestion(
        getBiographyQuestion(
          'birth_place_type',
        ),
        {
          subjectName: 'אורה',
          subjectGender: 'female',
        },
      ).question,
    ).toBe('באיזה סוג מקום נולדה אורה?')
  })

  it('keeps masculine wording for a male subject', () => {
    expect(
      personalizeSubjectText(
        'כיצד היה רוצה שיזכרו אותו?',
        {
          subjectName: 'דוד',
          subjectGender: 'male',
        },
      ),
    ).toBe(
      'כיצד היה רוצה שיזכרו אותו?',
    )
  })

  it('replaces the generic subject label with the archive name', () => {
    const question =
      personalizeBiographyQuestion(
        getBiographyQuestion(
          'birth_place_type',
        ),
        {
          subjectName: 'דוד',
          subjectGender: 'male',
        },
      )

    expect(question.question).toBe(
      'באיזה סוג מקום נולד דוד?',
    )
  })
})
