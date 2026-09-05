import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { Pressable, type PressableProps } from 'react-native'

import { cn } from '../../lib/utils'

const buttonVariants = cva('min-h-touch flex-row items-center justify-center gap-2 rounded-md px-4 active:opacity-80 focus:border focus:border-ring disabled:opacity-45', {
  variants: {
    variant: { default: 'bg-primary', destructive: 'bg-destructive', outline: 'border border-input bg-surface', secondary: 'bg-secondary', success: 'bg-success', ghost: 'bg-transparent' },
    size: { default: 'min-h-touch px-4', lg: 'min-h-[52px] px-5', icon: 'h-touch w-touch px-0' },
  },
  defaultVariants: { size: 'default', variant: 'default' },
})

export type ButtonProps = PressableProps & VariantProps<typeof buttonVariants> & { className?: string }

export const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ accessibilityRole = 'button', accessibilityState, className, disabled, size, variant, ...props }, ref) => (
    <Pressable accessibilityRole={accessibilityRole} accessibilityState={{ ...accessibilityState, disabled: disabled || accessibilityState?.disabled }} className={cn(buttonVariants({ size, variant }), className)} disabled={disabled} ref={ref} {...props} />
  ),
)

Button.displayName = 'Button'
