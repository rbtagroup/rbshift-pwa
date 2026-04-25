import { cx } from '../utils'

export function StatusPill({ children, tone = 'neutral' }) {
  return <span className={cx('pill', `pill-${tone}`)}>{children}</span>
}
