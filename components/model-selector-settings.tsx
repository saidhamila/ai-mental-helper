"use client"

import { useState, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/hooks/use-translation"

interface ModelSelectorSettingsProps {
  selectedModel: string
  onSelectModel: (model: string) => void
  apiKey: string
  onApiKeyChange: (key: string) => void
  apiUrl: string
  onApiUrlChange: (url: string) => void
  darkMode?: boolean
  language: string
}

export default function ModelSelectorSettings({
  selectedModel,
  onSelectModel,
  apiKey,
  onApiKeyChange,
  apiUrl,
  onApiUrlChange,
  darkMode = false,
  language,
}: ModelSelectorSettingsProps) {
  const { t } = useTranslation(language)
  const [modelDetails] = useState<{ [key: string]: { name: string; url: string } }>({
    openai: { name: "OpenAI", url: "https://api.openai.com/v1" },
    gemini: { name: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1" },
    deepseek: { name: "DeepSeek", url: "https://api.deepseek.com/v1" },
    anthropic: { name: "Anthropic Claude", url: "https://api.anthropic.com/v1" },
    custom: { name: "Custom Model", url: "" },
  })

  // Handle model selection with auto-filling of API URL
  const handleModelSelect = useCallback(
    (model: string) => {
      onSelectModel(model)

      // Only auto-fill URL if it's a known model and the URL field is empty or matches another model's default
      if (
        modelDetails[model] &&
        (!apiUrl ||
          Object.values(modelDetails).some((detail) => detail.url === apiUrl && detail.url !== modelDetails[model].url))
      ) {
        onApiUrlChange(modelDetails[model].url)
      }
    },
    [modelDetails, onSelectModel, onApiUrlChange, apiUrl],
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-1 text-sm">{t("selectAiModel")}</label>
        <Select value={selectedModel} onValueChange={handleModelSelect}>
          <SelectTrigger className={cn(darkMode ? "bg-gray-900 border-gray-800" : "")}>
            <SelectValue placeholder={t("selectModel")} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(modelDetails).map(([key, model]) => (
              <SelectItem key={key} value={key}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block mb-1 text-sm">{t("apiKey")}</label>
        <Input
          type="password"
          placeholder={`${selectedModel.toUpperCase()} API Key`}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          className={darkMode ? "bg-gray-900 border-gray-800" : ""}
        />
      </div>

      <div>
        <label className="block mb-1 text-sm">{t("apiUrl")}</label>
        <Input
          placeholder="API URL"
          value={apiUrl}
          onChange={(e) => onApiUrlChange(e.target.value)}
          className={darkMode ? "bg-gray-900 border-gray-800" : ""}
        />
      </div>
    </div>
  )
}
