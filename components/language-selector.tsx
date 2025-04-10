"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCallback } from "react"

interface LanguageSelectorProps {
  selectedLanguage: string
  onSelectLanguage: (language: string) => void
  darkMode?: boolean
}

export default function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  darkMode = false,
}: LanguageSelectorProps) {
  // Use useCallback to prevent recreation of the handler on each render
  const handleValueChange = useCallback(
    (value: string) => {
      if (value !== selectedLanguage) {
        onSelectLanguage(value)
      }
    },
    [onSelectLanguage, selectedLanguage],
  )

  return (
    <Tabs defaultValue={selectedLanguage} onValueChange={handleValueChange} className="w-full">
      <TabsList className={cn("grid grid-cols-3", darkMode ? "bg-gray-800" : "")}>
        {/* English First */}
        <TabsTrigger
          value="english"
          className={cn(
            "flex items-center gap-1",
            darkMode && selectedLanguage !== "english" ? "data-[state=inactive]:text-gray-400" : "",
          )}
        >
          <Globe size={14} />
          <span>English</span>
        </TabsTrigger>
        {/* French Second */}
        <TabsTrigger
          value="francais"
          className={cn(
            "flex items-center gap-1",
            darkMode && selectedLanguage !== "francais" ? "data-[state=inactive]:text-gray-400" : "",
          )}
        >
          <Globe size={14} />
          <span>Français</span>
        </TabsTrigger>
        {/* Arabic Third */}
        <TabsTrigger
          value="arabic"
          className={cn(
            "flex items-center gap-1",
            darkMode && selectedLanguage !== "arabic" ? "data-[state=inactive]:text-gray-400" : "",
          )}
        >
          <Globe size={14} />
          <span>العربية</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
