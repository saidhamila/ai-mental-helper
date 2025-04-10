"use client"

import { cn } from "@/lib/utils"
import type React from "react"

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
  darkMode: boolean
  className?: string
}

export default function SettingsSection({ title, children, darkMode, className = "" }: SettingsSectionProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
        className,
      )}
    >
      <h2 className="text-lg font-medium mb-4">{title}</h2>
      {children}
    </div>
  )
}
