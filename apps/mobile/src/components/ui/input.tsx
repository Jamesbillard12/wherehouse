import * as React from 'react'
import { TextInput, type TextInputProps } from 'react-native'

import { cn } from '../../lib/utils'

export const Input = React.forwardRef<TextInput, TextInputProps & { className?: string; invalid?: boolean }>(
  ({ className, editable = true, invalid = false, ...props }, ref) => (
    <TextInput accessibilityState={{ disabled: !editable }} className={cn('min-h-[48px] rounded-md border border-input bg-surface px-3.5 text-base text-foreground focus:border-ring disabled:opacity-45', invalid && 'border-destructive', className)} editable={editable} placeholderTextColor="#98a2b3" ref={ref} {...props} />
  ),
)

Input.displayName = 'Input'
