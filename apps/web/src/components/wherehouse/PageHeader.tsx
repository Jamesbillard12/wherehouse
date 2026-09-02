import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PageHeader({ actions, className, description, eyebrow, id, title }: {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  eyebrow?: ReactNode
  id?: string
  title: ReactNode
}) {
  return (
    <header className={cn('page-header', className)} id={id}>
      <div className="page-header-copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  )
}
