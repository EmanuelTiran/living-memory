import { Link, useLocation } from 'react-router'
import { createMemoryArchiveViewSearch } from './memoryArchiveViews.js'
import { createMemoryProfileTabSearch } from './memoryProfileTabs.js'
import './MemoryMediaActions.css'

function MemoryMediaActions({ includeStory = false }) {
  const location = useLocation()
  const actions = [
    ...(includeStory ? [{ label: 'הוספת סיפור', hash: '#stories-title', tab: 'documentation' }] : []),
    { label: 'העלאת תמונה', hash: '#memory-asset-upload-input', view: 'assets' },
    { label: 'הקלטת קול', hash: '#recordings-title', view: 'recordings' },
    { label: 'הוספת וידאו', hash: '#memory-external-video-url', view: 'assets' },
    { label: 'הוספת קישור', hash: '#memory-external-video-url', view: 'assets' },
  ]
  return (
    <nav className="memory-media-actions" aria-label="הוספת סיפור ומדיה לזיכרון" dir="rtl">
      {actions.map(action => (
        <Link key={action.label} className="secondary-button" to={{
          pathname: location.pathname,
          search: action.view
            ? createMemoryArchiveViewSearch(location.search, action.view)
            : createMemoryProfileTabSearch(location.search, action.tab),
          hash: action.hash,
        }} state={{}}>{action.label}</Link>
      ))}
    </nav>
  )
}

export default MemoryMediaActions
