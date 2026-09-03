const BRAND_LOGO_URL = '/assets/brand/zikaron-hai-logo.png'

export default function BrandLogo({
  className = '',
  compact = false,
}) {
  const classes = [
    'brand-logo',
    compact ? 'brand-logo-compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <img
      className={classes}
      src={BRAND_LOGO_URL}
      alt="זיכרון חי — שומרים סיפורי חיים לדורות"
    />
  )
}
