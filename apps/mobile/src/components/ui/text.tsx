import * as React from 'react'
import { Text as NativeText, type TextProps } from 'react-native'

import { cn } from '../../lib/utils'

export type TextVariant = 'body' | 'caption' | 'error' | 'heading' | 'label' | 'muted'

const variantClasses: Record<TextVariant, string> = {
  body: 'text-base leading-6 text-foreground',
  caption: 'text-xs leading-4 text-muted-foreground',
  error: 'text-sm leading-5 text-destructive',
  heading: 'text-xl font-extrabold text-foreground',
  label: 'text-sm font-extrabold text-foreground',
  muted: 'text-base leading-6 text-muted-foreground',
}

export const Text = React.forwardRef<NativeText, TextProps & { className?: string; variant?: TextVariant }>(
  ({ className, variant = 'body', ...props }, ref) => (
    <NativeText className={cn(variantClasses[variant], className)} ref={ref} {...props} />
  ),
)

Text.displayName = 'Text'
