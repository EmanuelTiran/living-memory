import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  SPEECH_CHUNK_FIRST_TARGET_LENGTH,
  SPEECH_CHUNK_MAX_COUNT,
  SPEECH_CHUNK_MAX_LENGTH,
  splitSpeechText,
} from '../src/modules/voice/speechChunking.js'

describe('Speech chunking', () => {
  it('keeps a short answer in one chunk', () => {
    expect(
      splitSpeechText(
        'זהו משפט קצר וברור.',
      ),
    ).toEqual([
      'זהו משפט קצר וברור.',
    ])
  })

  it('starts a long Hebrew answer with a small natural chunk', () => {
    const text = [
      'זהו המשפט הראשון וקצר יחסית.',
      'כאן מתחיל המשפט השני והוא מוסיף פרטים חשובים על הזיכרון.',
      'המשפט השלישי ממשיך את הסיפור ומסביר מה קרה לאחר מכן בצורה ברורה ונעימה.',
      'לבסוף מגיע משפט מסכם שמחזיר אותנו לנקודה המרכזית של הסיפור.',
      'אחריו נוסף פרט קצר שמבטיח שהתשובה אכן ארוכה מספיק לחלוקה.',
    ].join(' ')

    const chunks = splitSpeechText(text)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].length).toBeLessThanOrEqual(
      SPEECH_CHUNK_FIRST_TARGET_LENGTH,
    )
    expect(chunks.join(' ')).toBe(text)
  })

  it('limits very long answers to safe provider chunks', () => {
    const text = 'מילה '.repeat(820).trim()
    const chunks = splitSpeechText(text)

    expect(chunks.length).toBeLessThanOrEqual(
      SPEECH_CHUNK_MAX_COUNT,
    )
    expect(
      chunks.every(
        (chunk) =>
          chunk.length <=
          SPEECH_CHUNK_MAX_LENGTH,
      ),
    ).toBe(true)
    expect(chunks.join(' ')).toBe(text)
  })

  it('normalizes whitespace and rejects non-string input', () => {
    expect(
      splitSpeechText(
        '  משפט   ראשון.\nמשפט שני.  ',
      ),
    ).toEqual([
      'משפט ראשון. משפט שני.',
    ])

    expect(() => splitSpeechText(null))
      .toThrow(TypeError)
  })
})
