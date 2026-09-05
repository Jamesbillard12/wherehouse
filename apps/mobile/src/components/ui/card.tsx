import * as React from 'react'
import { View, type ViewProps } from 'react-native'

import { cn } from '../../lib/utils'

export const Card = React.forwardRef<View, ViewProps & { className?: string }>(
  ({ className, ...props }, ref) => <View className={cn('rounded-lg border border-border bg-surface p-5', className)} ref={ref} {...props} />,
)

Card.displayName = 'Card'
