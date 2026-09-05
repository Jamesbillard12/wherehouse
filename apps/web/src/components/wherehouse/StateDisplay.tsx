import { AlertCircle, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type StateActions = {
  action?: ReactNode
  secondaryAction?: ReactNode
}

type StateCopy = {
  description?: ReactNode
  title: ReactNode
}

export function EmptyState({ action, className, description, icon: Icon, secondaryAction, title }: StateActions & StateCopy & {
  className?: string
  icon?: LucideIcon
}) {
  return (
    <div className={cn('state-display empty-state', className)}>
      {Icon ? <div className="state-display-icon"><Icon aria-hidden="true" /></div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action || secondaryAction ? <div className="state-display-actions">{secondaryAction}{action}</div> : null}
    </div>
  )
}

export function LoadingState({ className, label }: { className?: string; label: ReactNode }) {
  return (
    <div aria-live="polite" className={cn('state-display loading-state', className)} role="status">
      <LoaderCircle aria-hidden="true" className="state-display-spinner" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ action, className, description, secondaryAction, title }: StateActions & StateCopy & { className?: string }) {
  return (
    <div className={cn('state-display error-state', className)} role="alert">
      <div className="state-display-icon"><AlertCircle aria-hidden="true" /></div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action || secondaryAction ? <div className="state-display-actions">{secondaryAction}{action}</div> : null}
    </div>
  )
}

export function StatusMessage({ children, className, tone = 'info' }: {
  children: ReactNode
  className?: string
  tone?: 'error' | 'info' | 'success' | 'warning'
}) {
  return <div className={cn('status-message', `status-message-${tone}`, className)} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
