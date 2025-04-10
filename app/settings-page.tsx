"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import SettingsSection from "@/components/settings-section"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/hooks/use-translation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SettingsPageProps {
  darkMode: boolean
  onBack: () => void
  selectedLanguage: string
  initialSettings: any
  onSaveSettings: (settings: any) => void
}

export default function SettingsPage({
  darkMode,
  onBack,
  selectedLanguage,
  initialSettings,
  onSaveSettings,
}: SettingsPageProps) {
  const [settings, setSettings] = useState({ ...initialSettings })
  const { t } = useTranslation(selectedLanguage)
  const [showSavedMessage, setShowSavedMessage] = useState(false)

  // Update settings when initialSettings change
  useEffect(() => {
    setSettings({ ...initialSettings })
  }, [initialSettings])

  const handleSaveSettings = () => {
    onSaveSettings(settings)
    setShowSavedMessage(true)
  }

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (showSavedMessage) {
      timer = setTimeout(() => setShowSavedMessage(false), 3000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [showSavedMessage])

  const updateSettings = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleModelChange = (model: string) => {
    updateSettings("selectedModel", model)
  }

  const handleApiKeyChange = (key: string) => {
    // Update the API key for the selected model
    switch (settings.selectedModel) {
      case "openai":
        updateSettings("openaiApiKey", key)
        break
      case "gemini":
        updateSettings("geminiApiKey", key)
        break
      case "deepseek":
        updateSettings("deepseekApiKey", key)
        break
      case "anthropic":
        updateSettings("anthropicApiKey", key)
        break
      case "custom":
        updateSettings("customApiKey", key)
        break
    }
  }

  const getApiKeyForCurrentModel = () => {
    switch (settings.selectedModel) {
      case "openai":
        return settings.openaiApiKey || ""
      case "gemini":
        return settings.geminiApiKey || ""
      case "deepseek":
        return settings.deepseekApiKey || ""
      case "anthropic":
        return settings.anthropicApiKey || ""
      case "custom":
        return settings.customApiKey || ""
      default:
        return ""
    }
  }; // Ensure this brace is standard

  return ( // Ensure this is standard
    <div className={cn("flex-1 overflow-y-auto custom-scrollbar", darkMode ? "bg-gray-900" : "bg-gray-100")}>
      <div className="p-4 md:p-6">
        <div className="flex items-center mb-4 md:mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className={darkMode ? "hover:bg-gray-800" : ""}>
            <ArrowLeft />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold ml-2">{t("settings")}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* AI Model Settings */}
          <SettingsSection title={t("aiModelSettings")} darkMode={darkMode}>
            <div>
              <label className="block mb-1 text-sm">{t("selectAiModel")}</label>
              <Select value={settings.selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className={cn(darkMode ? "bg-gray-900 border-gray-800" : "")}>
                  <SelectValue placeholder={t("selectModel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="custom">Custom Model</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <label className="block mb-1 text-sm">{t("apiKey")}</label>
              <Input
                type="password"
                placeholder={`${settings.selectedModel?.toUpperCase()} API Key`}
                value={getApiKeyForCurrentModel()}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className={darkMode ? "bg-gray-900 border-gray-800" : ""}
              />
            </div>
            <div className="mt-4">
              <label className="block mb-1 text-sm">{t("apiUrl")}</label>
              <Input
                placeholder="API URL"
                value={settings.apiUrl || ""}
                onChange={(e) => updateSettings("apiUrl", e.target.value)}
                className={darkMode ? "bg-gray-900 border-gray-800" : ""}
              />
            </div>
            <div className="mt-4">
              <label className="block mb-1 text-sm">{t("systemPrompt")}</label>
              <textarea
                className={cn(
                  "w-full p-2 rounded border min-h-[200px]",
                  darkMode ? "bg-gray-900 border-gray-800" : "border-gray-300",
                )}
                value={settings.predefinedPrompt || ""}
                onChange={(e) => updateSettings("predefinedPrompt", e.target.value)}
                placeholder={t("systemPromptPlaceholder")}
              ></textarea>
            </div>
          </SettingsSection>

          {/* Voice Settings (ElevenLabs) */}
          <SettingsSection title={t("voiceSettings")} darkMode={darkMode}>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm">{t("elevenlabsApiKey")}</label>
                <Input
                  type="password"
                  placeholder="..."
                  value={settings.elevenlabsApiKey || ""}
                  onChange={(e) => updateSettings("elevenlabsApiKey", e.target.value)}
                  className={darkMode ? "bg-gray-900 border-gray-800" : ""}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">{t("apiUrl")}</label>
                <Input
                  placeholder="https://api.elevenlabs.io/v1"
                  value={settings.elevenlabsApiUrl || "https://api.elevenlabs.io/v1"}
                  onChange={(e) => updateSettings("elevenlabsApiUrl", e.target.value)}
                  className={darkMode ? "bg-gray-900 border-gray-800" : ""}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">{t("voiceId")}</label>
                <Input
                  placeholder="2Lb1en5ujrODDIqmp7F3" // Use the default as placeholder
                  value={settings.voiceId || ""}
                  onChange={(e) => updateSettings("voiceId", e.target.value)}
                  className={darkMode ? "bg-gray-900 border-gray-800" : ""}
                />
              </div>
            </div>
          </SettingsSection>

          {/* Speech-to-Text Settings (Deepgram) */}
          <SettingsSection title={t("speechToTextSettings")} darkMode={darkMode}>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm">Deepgram API Key</label>
                <Input
                  type="password"
                  placeholder="..."
                  value={settings.deepgramApiKey || ""}
                  onChange={(e) => updateSettings("deepgramApiKey", e.target.value)}
                  className={darkMode ? "bg-gray-900 border-gray-800" : ""}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Deepgram API URL</label>
                <Input
                  placeholder="https://api.deepgram.com/v1/listen"
                  value={settings.deepgramApiUrl || "https://api.deepgram.com/v1/listen"}
                  onChange={(e) => updateSettings("deepgramApiUrl", e.target.value)}
                  className={darkMode ? "bg-gray-900 border-gray-800" : ""}
                />
              </div>
            </div>
          </SettingsSection>
        </div>

        {/* Save Button */}
        <div className="mt-6 mb-12">
          <Button className="bg-yellow-400 hover:bg-yellow-500 text-black" onClick={handleSaveSettings}>
            {t("saveSettings")}
          </Button>
          {showSavedMessage && <span className="ml-4 text-green-500">{t("settingsSaved")}</span>}
        </div>
      </div>
    </div>
  );
}
