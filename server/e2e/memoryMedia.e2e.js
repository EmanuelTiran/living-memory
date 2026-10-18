import { expect, test } from '@playwright/test'

const MEMORY_ID = '507f1f77bcf86cd799439020'
const PATH = `/app/memories/${MEMORY_ID}`
const API = `/api/memories/${MEMORY_ID}`
const SAMPLE_URL = 'https://www.youtube.com/watch?v=rCY43S8GGAY&t=55s'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7foAAAAASUVORK5CYII=', 'base64')

async function installApi(page, { role = 'contributor', assets = [], externalVideos = [] } = {}) {
  const state = { assets: [...assets], externalVideos: [...externalVideos] }
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method(), path = url.pathname
    if (!path.startsWith('/api/')) { await route.continue(); return }
    let data = {}, status = 200
    if (path === '/api/auth/refresh') data = {
      accessToken: 'media-e2e-token', user: { id: '507f1f77bcf86cd799439021', displayName: 'Family member', email: 'media@example.test', systemRole: 'user' },
    }
    else if (path === `/api/family-access/memories/${MEMORY_ID}`) data = { memoryProfile: {
      id: MEMORY_ID, subjectName: 'סבתא', relationship: 'סבתא', subjectGender: 'female', description: '',
      portraitAssetId: null, authorization: { role, accessType: 'membership', permission: 'view' },
    } }
    else if (path.endsWith('/assets/external-videos') && method === 'POST') {
      const input = req.postDataJSON()
      const video = { id: '507f1f77bcf86cd799439024', memoryId: MEMORY_ID,
        displayName: input.displayName, description: input.description, provider: 'youtube',
        canonicalUrl: SAMPLE_URL, externalId: 'rCY43S8GGAY', startSeconds: 55, lifecycleStatus: 'active' }
      state.externalVideos.unshift(video); data = { externalVideo: video }; status = 201
    }
    else if (path.endsWith('/assets/external-videos')) data = { externalVideos: state.externalVideos }
    else if (/\/external-videos\/[a-f0-9]+$/.test(path)) {
      const id = path.split('/').at(-1)
      const video = state.externalVideos.find(item => item.id === id)
      if (method === 'DELETE') state.externalVideos = state.externalVideos.filter(item => item.id !== id)
      if (method === 'PATCH') Object.assign(video, req.postDataJSON())
      data = { externalVideo: video }
    }
    else if (path === `${API}/assets` && method === 'POST') {
      const asset = { id: '507f1f77bcf86cd799439025', displayName: 'Photo of Grandma', assetType: 'image',
        mimeType: 'image/png', originalFileName: 'grandma.png', description: '', sizeBytes: png.length, processingStatus: 'completed' }
      state.assets.unshift(asset); data = { asset }; status = 201
    }
    else if (path === `${API}/assets`) data = { assets: state.assets }
    else if (path.endsWith('/access-link')) data = { access: { url: '/api/media-test-preview', expiresAt: '2099-01-01', disposition: 'inline' } }
    else if (path === '/api/media-test-preview') {
      await route.fulfill({ status: 200, contentType: 'image/png', body: png }); return
    }
    else if (path.endsWith('/stories')) data = { memoryStories: [], stories: [] }
    else if (path.endsWith('/recordings')) data = { recordings: [] }
    else if (path.endsWith('/family-questions')) data = { familyQuestions: [] }
    else if (path.endsWith('/biography/questionnaire')) data = { questionnaire: { answers: [], progress: { completedCount: 0 } } }
    else if (path.endsWith('/archive-search')) data = { search: { results: [], total: 0, limit: 30 } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  return state
}

test('contributor discovers video from Today, saves timestamp and sees a safe archive preview beside existing PDF', async ({ page }) => {
  const youtubeRequests = []
  page.on('request', req => { if (new URL(req.url()).hostname.endsWith('youtube.com')) youtubeRequests.push(req.url()) })
  await installApi(page, { assets: [{ id: 'pdf-1', displayName: 'Family document', assetType: 'document', mimeType: 'application/pdf', originalFileName: 'family.pdf', sizeBytes: 100, processingStatus: 'completed' }] })
  await page.goto(PATH)
  await expect(page.getByRole('heading', { name: 'איך תרצו לתעד היום?', exact: true })).toBeVisible()
  const videoAction = page.getByRole('link', { name: 'הוספת וידאו', exact: true }).filter({ visible: true })
  await videoAction.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/tab=archive.*archiveView=assets#memory-external-video-url$/)
  const form = page.getByRole('form', { name: 'הוספת סרטון מקישור' })
  await expect(form.getByLabel('קישור לסרטון YouTube')).toBeFocused()
  await form.getByLabel('קישור לסרטון YouTube').fill(SAMPLE_URL)
  await form.getByLabel('כותרת הסרטון').fill('סבתא מספרת')
  await form.getByLabel('תיאור הסרטון').fill('<img src=x onerror=alert(1)>')
  await form.getByRole('button', { name: 'שמירת הסרטון בארכיון' }).click()
  const card = page.getByRole('article', { name: 'סבתא מספרת' })
  await expect(card).toBeVisible()
  await expect(card.getByText('מתחיל בשנייה 55', { exact: false })).toBeVisible()
  await expect(card.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible()
  await expect(card.locator('img')).toHaveCount(0)
  await expect(card.getByRole('link', { name: 'צפייה ב־YouTube' })).toHaveAttribute('href', SAMPLE_URL)
  await expect(card.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(card.getByRole('link')).toHaveAttribute('referrerpolicy', 'no-referrer')
  await expect(card.getByRole('button', { name: 'עריכת פרטי הסרטון' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Family document' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('article', { name: 'סבתא מספרת' })).toBeVisible()
  expect(youtubeRequests).toEqual([])
})

test('photo shortcut opens the existing upload even in an empty archive; voice and story actions still navigate', async ({ page }) => {
  await installApi(page)
  await page.goto(PATH)
  await page.getByRole('link', { name: 'העלאת תמונה', exact: true }).filter({ visible: true }).click()
  await expect(page.locator('#memory-asset-upload-input')).toBeFocused()
  await page.locator('#memory-asset-upload-input').setInputFiles({ name: 'grandma.png', mimeType: 'image/png', buffer: png })
  const upload = page.locator('form').filter({ has: page.locator('#memory-asset-upload-input') })
  await upload.getByLabel('שם שיוצג בזיכרון').fill('Photo of Grandma')
  await upload.getByRole('button', { name: 'העלאת הקובץ', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Photo of Grandma' })).toBeVisible()
  await page.getByRole('tab', { name: 'היום', exact: true }).click()
  await page.getByRole('link', { name: 'הקלטת קול', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/archiveView=recordings#recordings-title$/)
  await expect(page.getByRole('heading', { name: /הקלטות/ }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'היום', exact: true }).click()
  await page.getByRole('link', { name: 'הוספת סיפור', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/tab=documentation.*#stories-title$/)
  await expect(page.locator('#stories-title')).toBeVisible()
})

test('viewer can watch family video but has no creation, editing or archive controls', async ({ page }) => {
  await installApi(page, { role: 'viewer', externalVideos: [{ id: 'video-1', displayName: 'Family video', canonicalUrl: SAMPLE_URL, provider: 'youtube', startSeconds: 55 }] })
  await page.goto(PATH)
  await expect(page.getByRole('link', { name: 'הוספת וידאו', exact: true })).toHaveCount(0)
  await page.goto(`${PATH}?tab=archive&archiveView=assets#memory-assets-title`)
  await expect(page.getByRole('article', { name: 'Family video' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'צפייה ב־YouTube' })).toBeVisible()
  await expect(page.getByRole('form', { name: 'הוספת סרטון מקישור' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'עריכת פרטי הסרטון' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'העברה לארכיון' })).toHaveCount(0)
})

test('mobile documentation offers media actions; editor can update and archive a video', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installApi(page, { role: 'editor', externalVideos: [{ id: '507f1f77bcf86cd799439024', displayName: 'Family video', canonicalUrl: SAMPLE_URL, provider: 'youtube' }] })
  await page.goto(`${PATH}?tab=documentation`)
  await expect(page.getByRole('link', { name: 'העלאת תמונה', exact: true }).filter({ visible: true })).toBeVisible()
  await page.getByRole('link', { name: 'הוספת קישור', exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('form', { name: 'הוספת סרטון מקישור' })).toBeVisible()
  await page.getByRole('button', { name: 'עריכת פרטי הסרטון' }).click()
  await page.getByRole('tab', { name: 'היום', exact: true }).click()
  await page.getByRole('link', { name: 'הוספת וידאו', exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole('form', { name: 'הוספת סרטון מקישור' }).getByLabel('קישור לסרטון YouTube')).toBeFocused()
  await page.getByRole('button', { name: 'עריכת פרטי הסרטון' }).click()
  const edit = page.getByRole('form', { name: 'עריכת פרטי הסרטון' })
  await edit.getByLabel('כותרת הסרטון').fill('Updated family video')
  await edit.getByRole('button', { name: 'שמירת פרטי הסרטון' }).click()
  await expect(page.getByRole('article', { name: 'Updated family video' })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'העברה לארכיון', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Updated family video' })).toHaveCount(0)
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true)
})
