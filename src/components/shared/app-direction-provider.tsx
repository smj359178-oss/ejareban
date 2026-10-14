'use client'

/**
 * Client boundary for Radix's DirectionProvider so the server root layout
 * can enable RTL for every Radix primitive (Tabs, Select, Dialog,
 * DropdownMenu…) without pulling server-incompatible context code.
 */
import { DirectionProvider as RadixDirectionProvider } from '@radix-ui/react-direction'

export function AppDirectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <RadixDirectionProvider dir="rtl">{children}</RadixDirectionProvider>
}
