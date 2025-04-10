"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useCallback } from "react"

interface ModelSelectorProps {
  selectedModel: string
  onSelectModel: (model: string) => void
  darkMode?: boolean
}

export default function ModelSelector({ selectedModel, onSelectModel, darkMode = false }: ModelSelectorProps) {
  // Use useCallback to prevent recreation of the handler on each render
  const handleValueChange = useCallback(
    (value: string) => {
      if (value !== selectedModel) {
        onSelectModel(value)
      }
    },
    [onSelectModel, selectedModel],
  )

  return (
    <div>
      <p className={cn("text-sm mb-2", darkMode ? "text-gray-300" : "")}>Choose AI Model:</p>
      <Tabs defaultValue={selectedModel} onValueChange={handleValueChange} className="w-full">
        <TabsList className={cn("grid grid-cols-3", darkMode ? "bg-gray-800" : "")}>
          <TabsTrigger
            value="openai"
            className={darkMode && selectedModel !== "openai" ? "data-[state=inactive]:text-gray-400" : ""}
          >
            OpenAI
          </TabsTrigger>
          <TabsTrigger
            value="gemini"
            className={darkMode && selectedModel !== "gemini" ? "data-[state=inactive]:text-gray-400" : ""}
          >
            Gemini
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className={darkMode && selectedModel !== "custom" ? "data-[state=inactive]:text-gray-400" : ""}
          >
            Custom
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
