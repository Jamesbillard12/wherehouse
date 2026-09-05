import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type LocationPathSegment = {
  id?: string
  label: string
}

export function locationPathSegments(path?: string | null): LocationPathSegment[] {
  return path?.split(/\s*(?:>|\/)\s*/).map((label) => label.trim()).filter(Boolean).map((label) => ({ label })) ?? []
}

export function LocationPath({ className, emptyLabel = 'Unplaced', label = 'Location', onNavigate, segments, separator = ' > ', variant = 'text' }: {
  className?: string
  emptyLabel?: ReactNode
  label?: string
  onNavigate?: (segment: LocationPathSegment, index: number) => void
  separator?: string
  segments: LocationPathSegment[]
  variant?: 'breadcrumb' | 'text'
}) {
  if (!segments.length) return <span className={className}>{emptyLabel}</span>

  if (variant === 'text') {
    return <span aria-label={`${label}: ${segments.map((segment) => segment.label).join(', ')}`} className={className}>{segments.map((segment) => segment.label).join(separator)}</span>
  }

  return (
    <nav aria-label={label} className={cn('container-path', className)}>
      {segments.map((segment, index) => {
        const current = index === segments.length - 1
        return <span className="path-segment" key={segment.id ?? `${segment.label}-${index}`}>{index ? <ChevronRight aria-hidden="true" /> : null}{!current && onNavigate ? <Button onClick={() => onNavigate(segment, index)} type="button">{segment.label}</Button> : current ? <strong aria-current="location">{segment.label}</strong> : <span>{segment.label}</span>}</span>
      })}
    </nav>
  )
}
