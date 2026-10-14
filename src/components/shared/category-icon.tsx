'use client'

import * as React from 'react'
import {
  Laptop,
  Camera,
  Wrench,
  PartyPopper,
  Mountain,
  Car,
  Home,
  Gamepad2,
  Music,
  Shirt,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  Laptop,
  Camera,
  Wrench,
  PartyPopper,
  Mountain,
  Car,
  Home,
  Gamepad2,
  Music,
  Shirt,
}

export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  const Icon = (name && MAP[name]) || HelpCircle
  return <Icon className={className} />
}

export const ICON_NAMES = Object.keys(MAP)
