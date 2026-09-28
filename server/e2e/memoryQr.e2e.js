/* global document, window, getComputedStyle */
import { test, expect } from '@playwright/test'
import QRCode from 'qrcode'

const memoryId = '507f1f77bcf86cd799439020'
const token = 'A7K9P2abcdefghijklmnopqrstuvwxyz'
const sourceId = '507f1f77bcf86cd799439022'
const version = 'a'.repeat(64)
const publicPath = `/q/${token}`
const publicMemory = {
  subjectName: 'אורה לוי',
  description: 'אורה ידעה להפוך כל ארוחה למפגש משפחתי. הבית שלה היה מלא בסיפורים, בצחוק ובאהבה.\n\nכאן נשמרו כמה מהרגעים שבחרה המשפחה לשתף.',
  stories: [{ title: 'ארוחות השבת בבית', content: 'בכל יום שישי התאספה המשפחה סביב השולחן. אורה הקשיבה לכולם, והוסיפה סיפור קטן משלה. '.repeat(14), occurredOn: '1978-05-12' },
    { title: 'הגינה הקטנה', content: 'בגינה ליד הבית צמחו ורדים ונענע. לכל נכד ונכדה חיכה עציץ קטן משלהם.', occurredOn: '' }],
  // Existing application imagery used only in the intercepted browser fixture.
  photos: [{ title: 'תמונת בדיקה', description: '', url: '/assets/emanuel-living-memory-avatar.png', portrait: true },
    { title: 'זיכרון בתמונה', description: 'תמונה שנבחרה על ידי המשפחה.', url: '/assets/image.png', portrait: false }],
}

async function mockApi(page, { role = 'owner', publicStatus = 200, publicationStatus = 'current' } = {}) {
  const actions = []
  const url = `http://127.0.0.1:4173${publicPath}`
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 4 })
  const state = {
    url, svg, enabled: true, published: true, publicationStatus, needsReview: publicationStatus === 'pending', profileVersion: version,
    profile: { subjectName: publicMemory.subjectName, description: publicMemory.description },
    stories: [{ sourceId, version, title: publicMemory.stories[0].title, content: publicMemory.stories[0].content, selected: true }], photos: [], truncated: false,
  }
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()
    let data = {}
    let status = 200
    if (pathname === '/api/auth/refresh') data = { accessToken: 'test-only', user: { id: sourceId, displayName: 'בדיקת QR', email: 'qr@example.test' } }
    else if (pathname.startsWith('/api/public/memories/')) { data = publicMemory; status = publicStatus }
    else if (pathname === `/api/memories/${memoryId}/qr`) {
      if (route.request().method() === 'POST') {
        const action = route.request().postDataJSON()
        actions.push(action)
        if (action.action === 'set_enabled') { state.enabled = action.enabled; state.publicationStatus = action.enabled ? 'current' : 'disabled' }
        if (action.action === 'unpublish') { state.published = false; state.publicationStatus = 'not_published' }
        if (action.action === 'publish') { state.published = true; state.publicationStatus = 'current' }
      }
      data = state
    } else if (pathname === `/api/family-access/memories/${memoryId}`) data = { memoryProfile: {
      id: memoryId, subjectName: publicMemory.subjectName, description: publicMemory.description, subjectGender: 'female',
      portraitAssetId: null, createdAt: '2026-08-01T09:00:00Z', authorization: { role },
    } }
    else if (pathname.endsWith('/stories')) data = { memoryStories: [], stories: [] }
    else if (pathname.endsWith('/assets')) data = { assets: [] }
    else if (pathname.endsWith('/recordings')) data = { recordings: [] }
    else if (pathname.endsWith('/archive-search')) data = { search: { results: [], total: 0, limit: 30 } }
    else if (pathname.endsWith('/family-questions')) data = { familyQuestions: [] }
    else if (pathname.endsWith('/questionnaire')) data = { questionnaire: { progress: { completedCount: 0, isComplete: false }, answers: [] } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { code: 'PUBLIC_MEMORY_UNAVAILABLE' } }) })
  })
  return actions
}

for (const [name, width, height] of [['small-mobile', 320, 740], ['phone', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 1000]]) {
  test(`public QR opens directly and reads comfortably at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await mockApi(page)
    await page.goto(publicPath)
    await expect(page.getByRole('heading', { name: publicMemory.subjectName, exact: true })).toBeVisible()
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.getByRole('link', { name: 'אל הסיפורים' })).toBeVisible()
    await page.getByRole('link', { name: 'אל הסיפורים' }).click()
    const disclosure = page.getByText('לקריאת הסיפור המלא', { exact: false }).first()
    await disclosure.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.public-memory-story details')).toHaveAttribute('open', '')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const bodyStyle = await page.locator('.public-memory-story p').first().evaluate((element) => ({ fontSize: getComputedStyle(element).fontSize, lineHeight: getComputedStyle(element).lineHeight }))
    expect(parseFloat(bodyStyle.fontSize)).toBeGreaterThanOrEqual(16)
    expect(parseFloat(bodyStyle.lineHeight)).toBeGreaterThan(24)
    await expect(page.getByRole('button', { name: /עריכ|פרסום|השבת/ })).toHaveCount(0)
    await disclosure.click()
    await page.screenshot({ path: `test-results/qr-${name}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('owner can review, export, cancel and disable/reactivate without changing QR; tooltips use AURA', async ({ page }) => {
  // Match the established Admin tooltip fixture: Windows headless may report no mouse.
  await page.addInitScript(() => {
    const nativeMatchMedia = globalThis.matchMedia.bind(globalThis)
    globalThis.matchMedia = (query) => {
      const result = nativeMatchMedia(query)
      if (query !== '(hover: hover) and (pointer: fine)') return result
      return { matches: true, media: result.media, onchange: result.onchange,
        addListener: (listener) => result.addListener(listener), removeListener: (listener) => result.removeListener(listener),
        addEventListener: (...args) => result.addEventListener(...args), removeEventListener: (...args) => result.removeEventListener(...args),
        dispatchEvent: (event) => result.dispatchEvent(event) }
    }
  })
  const actions = await mockApi(page)
  await page.goto(`/app/memories/${memoryId}?tab=family`)
  const summary = page.getByText('קוד QR ושיתוף ציבורי', { exact: true })
  await summary.click()
  await expect(page.getByAltText(/קוד QR קבוע/)).toBeVisible()
  const url = await page.locator('output[aria-labelledby="memory-qr-url-label"]').textContent()
  const download = page.getByRole('link', { name: 'הורדת QR להדפסה' })
  await download.scrollIntoViewIfNeeded()
  await download.hover()
  await download.dispatchEvent('pointerover')
  await expect(page.getByRole('tooltip')).toBeVisible()
  await expect(page.getByRole('tooltip')).toContainText('SVG')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  // AuraTooltipLayer deliberately suppresses focus tooltips for 500ms after pointerdown.
  await page.waitForTimeout(550)
  await page.locator('.memory-qr-summary [role="status"]').focus()
  await page.keyboard.press('Tab')
  await expect(download).toBeFocused()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  const [file] = await Promise.all([page.waitForEvent('download'), download.click()])
  expect(file.suggestedFilename()).toBe('living-memory-qr.svg')
  await page.getByRole('button', { name: 'השבתת הקוד', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'ביטול', exact: true }).click()
  expect(actions).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'השבתת הקוד', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'השבתת הקוד', exact: true }).click()
  await page.getByRole('button', { name: 'אישור', exact: true }).click()
  await expect(page.getByRole('button', { name: 'הפעלת הקוד מחדש', exact: true })).toBeVisible()
  await expect(page.locator('.memory-qr-summary [role="status"]')).toContainText('קוד ה־QR מושבת · הדף אינו זמין')
  expect(actions[0]).toEqual({ action: 'set_enabled', enabled: false, confirmed: true })
  expect(await page.locator('output[aria-labelledby="memory-qr-url-label"]').textContent()).toBe(url)
  await page.getByRole('button', { name: 'הפעלת הקוד מחדש', exact: true }).click()
  await page.getByRole('button', { name: 'אישור', exact: true }).click()
  await expect(page.getByRole('button', { name: 'השבתת הקוד', exact: true })).toBeVisible()
  await page.getByLabel(/בדקתי את השם/).check()
  await page.getByRole('button', { name: 'אישור ופרסום הבחירה' }).click()
  await page.getByRole('button', { name: 'אישור', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(actions.at(-1)).toMatchObject({ action: 'publish', confirmed: true, stories: [{ sourceId, version }] })
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/qr-management-mobile.png', fullPage: true })
})

test('family members do not see publishing controls and unavailable QR reveals no memorial information', async ({ page }) => {
  await mockApi(page, { role: 'viewer', publicStatus: 404 })
  await page.goto(`/app/memories/${memoryId}?tab=family`)
  await expect(page.getByRole('tab', { name: 'שאלות ומשפחה' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('קוד QR ושיתוף ציבורי', { exact: true })).toHaveCount(0)
  await page.goto(publicPath)
  await expect(page.getByRole('heading', { name: 'הזיכרון אינו זמין לצפייה ציבורית' })).toBeVisible()
  await expect(page.getByText(publicMemory.subjectName, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('img', { name: /תמונת בדיקה/ })).toHaveCount(0)
})

for (const [publicationStatus, label, explanation] of [
  ['pending', 'פורסם · יש שינויים שטרם פורסמו', 'המבקרים עדיין רואים את הגרסה האחרונה שפרסמתם'],
  ['removed', 'פורסם · תוכן שהוסר אינו זמין למבקרים', 'תוכן שהוסר במפורש אינו זמין עוד למבקרים'],
  ['restricted', 'הגישה הציבורית הוגבלה · הדף אינו זמין', 'הגדרות פרטיות או בעלות השתנו'],
]) {
  test(`owner sees accurate ${publicationStatus} publication status`, async ({ page }) => {
    await mockApi(page, { publicationStatus })
    await page.goto(`/app/memories/${memoryId}?tab=family`)
    await page.getByText('קוד QR ושיתוף ציבורי', { exact: true }).click()
    await expect(page.locator('.memory-qr-summary [role="status"]')).toContainText(label)
    await expect(page.getByText(explanation, { exact: false })).toBeVisible()
  })
}

test('public page handles network errors and respects reduced motion', async ({ page }) => {
  await mockApi(page, { publicStatus: 503 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(publicPath)
  await expect(page.getByRole('button', { name: 'ניסיון נוסף' })).toBeVisible()
  await page.unrouteAll()
  await mockApi(page)
  await page.getByRole('button', { name: 'ניסיון נוסף' }).click()
  await expect(page.getByRole('heading', { name: publicMemory.subjectName, exact: true })).toBeVisible()
  expect(await page.locator('.public-memory-hero').evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
})
