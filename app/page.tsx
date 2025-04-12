"use client";

import React, { useState, useRef, useEffect, memo } from "react" // Add memo import
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  MoonIcon,
  SunIcon,
  Settings,
  User,
  HistoryIcon,
  Mic,
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  PanelLeftClose, // Icon for collapsing sidebar (LTR)
  PanelRightClose, // Icon for collapsing sidebar (RTL)
  PanelLeftOpen, // Icon for opening sidebar (LTR)
  PanelRightOpen, // Icon for opening sidebar (RTL)
} from "lucide-react"
import { cn } from "@/lib/utils" // Ensure cn is imported
import AvatarDisplay from "@/components/avatar-display"
import LanguageSelector from "@/components/language-selector"
import { useTranslation } from "@/hooks/use-translation"
import ChatHistory from "@/components/chat-history"
import SettingsPage from "./settings-page"
import { useSettings } from "@/hooks/use-settings"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip" // Import Tooltip
import { avatarStore, avatarActions } from "@/store/avatarStore" // Import Valtio store and actions

// Define message type
interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

// Chat history interface
interface ChatHistoryItem {
  id: number
  title: string
  date: string
}

// Load and sort chat history from localStorage (newest first)
const loadChatHistory = (): ChatHistoryItem[] => {
  try {
    const savedChatsJson = localStorage.getItem("chatHistory")
    if (savedChatsJson) {
      const chats: ChatHistoryItem[] = JSON.parse(savedChatsJson)
      return chats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
  } catch (error) {
    console.error("Failed to load chat history:", error)
  }
  return [];
}

// --- Define AvatarPanelComponent OUTSIDE Home ---
interface AvatarPanelProps {
  layoutDirection: 'ltr' | 'rtl';
  darkMode: boolean;
}

const AvatarPanelComponent = memo(({ layoutDirection, darkMode }: AvatarPanelProps) => (
  // Remove justify-center, add h-full to ensure it takes full height
  <div className={cn(
      "w-80 flex-shrink-0 flex-col hidden md:flex h-full", // Removed items-center
      // Conditional border based on layout direction
      layoutDirection === 'ltr' ? 'border-l' : 'border-r',
      darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
    )}
  >
    {/* Make intermediate container a full-height flex column */}
    <div className="flex flex-col h-full text-center p-4">
      {/* Updated Title */}
      <h2 className="text-lg font-semibold mb-2 text-black dark:text-white">
        <span className="text-yellow-500">Emma</span> Mental Health Assistant
      </h2>
      {/* Remove fixed height, add flex-grow to fill available space */}
      <div className="mt-4 border rounded flex-grow w-full overflow-hidden relative bg-gray-200 dark:bg-gray-700">
        {/* AvatarDisplay will get state directly from store */}
        <AvatarDisplay />
      </div>
    </div>
  </div>
));
AvatarPanelComponent.displayName = 'AvatarPanelComponent'; // Add display name for memoized component
// --- End AvatarPanelComponent Definition ---

export default function Home() {
  // Settings and state
  const { settings, updateSettings, saveSettings: saveSettingsToContext, isInitialized } = useSettings() // Add isInitialized
  const [darkMode, setDarkMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState("english")
  const [layoutDirection, setLayoutDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Default to visible
  const [showSettings, setShowSettings] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState(true) // Keep history toggle separate
  const [savedChats, setSavedChats] = useState<ChatHistoryItem[]>([]) // Initialize as empty

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<number | null>(null)
  // Removed local state for avatar, now managed by Valtio store

  // Notifications
  const [showApiWarning, setShowApiWarning] = useState(false)
  const [apiWarningMessage, setApiWarningMessage] = useState("")

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null); // Ref for silence timer

  // Translation
  const { t } = useTranslation(selectedLanguage)

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages]);
 
  // Load chat history only on the client-side after mount
  useEffect(() => {
    setSavedChats(loadChatHistory());
  }, []); // Empty dependency array ensures this runs once on mount

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Function to save updates to an existing chat
  const saveUpdatedChat = (chatId: number, updatedMessages: Message[]) => {
    try {
      const messagesToStore = updatedMessages.filter(m => m.role !== 'system');
      localStorage.setItem(`chat_${chatId}`, JSON.stringify(messagesToStore));
      setSavedChats(prevChats => {
         const updatedHistory = prevChats.map(chat =>
           chat.id === chatId ? { ...chat, date: new Date().toISOString() } : chat
         );
         updatedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
         localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
         return updatedHistory;
      });
    } catch (error) {
      console.error("Failed to update chat:", error);
      showWarning("Failed to update chat history.");
    }
  };

  // Function to handle Text-to-Speech generation using Valtio store
  // Re-add key/voiceId arguments
  // Revert to reading key/voiceId from settings inside the function
  const handleTextToSpeech = async (text: string) => {
    // Get key and voiceId from settings context
    const elevenlabsApiKey = settings.elevenlabsApiKey; // Correct casing
    const voiceId = settings.voiceId;
    avatarActions.stopAudio(); // Clear previous audio/sync data using action (this also clears lipSyncData in the store)
    console.log('Settings in handleTextToSpeech:', settings); // Add logging

    // Check for API key from settings
    if (!elevenlabsApiKey) { // Correct casing
      showWarning("ElevenLabs API Key is missing in settings.");
      avatarActions.setAnimation("Idle"); // Revert to Idle if TTS can't proceed
      setIsLoading(false); // Stop loading indicator
      return;
    }

    try {
      // Animation is set to Talking within playAudio action
      // avatarActions.setAnimation("Talking"); // Optionally set thinking/processing animation here

      console.log("Sending text to /api/tts:", text);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          apiKey: elevenlabsApiKey, // Pass key from settings (Correct casing)
          voiceId: voiceId || '2Lb1en5ujrODDIqmp7F3', // Pass voiceId from settings or use default
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS API error: ${response.status} - ${errorData.error || 'Unknown TTS error'}`);
      }

      const data = await response.json();
      console.log("Received TTS data:", data);

      // Expect audioUrl and potentially animationData from the backend
      if (data.audioUrl) {
        console.log("Received animationData from backend:", data.animationData);
        // Pass audioUrl and the new animationData (which might be null) to the store action
        avatarActions.playAudio(data.audioUrl, data.animationData || null);
        // Animation state is handled by the store/R3FAvatar component
      } else {
        throw new Error("TTS API did not return an audioUrl.");
      }

    } catch (error) {
      console.error("TTS error:", error);
      showWarning(`TTS failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      avatarActions.stopAudio(); // Revert to Idle on error using action
      // avatarActions.setAnimation("Idle"); // Already handled by stopAudio
      setIsLoading(false); // Stop loading indicator if TTS fails
    }
    // Note: setIsLoading(false) is removed from here; it should happen *after* audio plays or if TTS fails.
    // We need a way for R3FAvatar to signal completion back up, or manage loading state differently.
    // For now, let's assume loading stops when TTS data is received. We'll refine this.
    setIsLoading(false); // TEMPORARY: Stop loading after TTS API call completes
  };


  // Extracted function to handle the core logic of submitting a message and getting a response
  const submitChatMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return; // Prevent empty/multiple submissions

    const modelName = settings.selectedModel;

    // Validate settings needed for chat FIRST
    if (!modelName) {
      showWarning(t("modelNotSelected"));
      setIsLoading(false); // Ensure loading stops if validation fails
      return;
    }
    const apiKey = getApiKeyForModel(modelName); // Now safe to call
    const apiUrl = settings.apiUrl || getDefaultApiUrl(modelName); // Now safe to call

     if (!apiKey) {
      showWarning(t("apiKeyMissing").replace("{model}", modelName.toUpperCase()));
       setIsLoading(false);
      return;
    }
     if (!apiUrl) {
        showWarning(t("apiUrlMissing"));
        setIsLoading(false);
        return;
     }

    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: messageContent };
    let currentMessages = [...messages, userMessage]; // Use a local variable to track messages for this submission

    // Add system prompt if it's the first message (excluding system)
    if (messages.filter(m => m.role !== 'system').length === 0 && settings.predefinedPrompt) {
      const systemMessage: Message = { id: `system-${Date.now()}`, role: "system", content: settings.predefinedPrompt };
      currentMessages = [systemMessage, ...currentMessages];
    }

    setMessages(currentMessages); // Update UI with user message
    setIsLoading(true);
    avatarActions.stopAudio(); // Clear previous audio/sync data & set default animation

    try {
      const assistantMessagePlaceholder: Message = { id: `assistant-${Date.now()}`, role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMessagePlaceholder]); // Add placeholder for assistant response
      currentMessages = [...currentMessages, assistantMessagePlaceholder]; // Add placeholder to local tracking

      console.log(`Sending ${currentMessages.length} messages to /api/chat for model ${modelName}`);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages, model: modelName, apiKey, apiUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status}${errorData.error ? ` - ${errorData.error.message || errorData.error}` : ""}`);
      }

      const data = await response.json();
      if (data.error) { throw new Error(data.error); }

      const assistantText = data.text || "I'm sorry, I couldn't generate a response.";

      // Update the placeholder message with the actual content
      setMessages((prevMessages) => {
        const updatedMessages = prevMessages.map(msg =>
          msg.id === assistantMessagePlaceholder.id ? { ...msg, content: assistantText } : msg
        );
        // Save updated chat history if applicable
        if (currentChatId !== null) { saveUpdatedChat(currentChatId, updatedMessages); }
        return updatedMessages;
      });

      // Generate speech for the received text
      if (assistantText) {
        await handleTextToSpeech(assistantText); // This will eventually set isLoading=false
      } else {
        // If no text, stop loading and reset animation
        setIsLoading(false);
        avatarActions.stopAudio(); // Ensure default state
      }

    } catch (error) {
      console.error("Chat/TTS error:", error);
      const errorMessage = `Error: ${error instanceof Error ? error.message : "Unknown error"}. Check settings.`;
      // Update the *last* assistant message with the error, as placeholder might not exist
       setMessages((prevMessages) => {
         const lastIndex = prevMessages.length - 1;
         if (lastIndex >= 0 && prevMessages[lastIndex].role === 'assistant') {
            const updatedMessages = [...prevMessages];
            updatedMessages[lastIndex] = { ...updatedMessages[lastIndex], content: errorMessage };
            if (currentChatId !== null) { saveUpdatedChat(currentChatId, updatedMessages); }
            return updatedMessages;
         }
         // If no assistant message exists (shouldn't happen often), just return previous state
         return prevMessages;
       });
      showWarning(errorMessage);
      setIsLoading(false); // Stop loading on error
      avatarActions.stopAudio(); // Reset animation and clear audio state on error
    }
    // Loading state is now handled within the try/catch and handleTextToSpeech
  };

  // Simplified handler for text input form submission
  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const textInput = input.trim(); // Get current input value
    if (!textInput || isLoading) return; // Prevent empty/multiple submissions

    setInput(""); // Clear input field immediately
    await submitChatMessage(textInput); // Call the core logic
  };

  // Get default API URL based on model
  const getDefaultApiUrl = (model: string): string => {
    switch (model) {
      case "openai": return "https://api.openai.com/v1"
      case "gemini": return "https://generativelanguage.googleapis.com/v1"
      case "anthropic": return "https://api.anthropic.com/v1"
      case "deepseek": return "https://api.deepseek.com/v1"
      default: return "https://api.openai.com/v1"
    }
  }

  // --- Speech Recognition Logic ---
  // Modified handler for when recording stops (manually or via timer)
  const handleStopRecording = async () => {
    const audioBlob = audioChunksRef.current.length > 0
      ? new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' })
      : null; // Create blob only if chunks exist

    audioChunksRef.current = []; // Clear chunks regardless

    if (!audioBlob) {
      console.log("Silence detected or no audio recorded.");
      // Submit "*silence*" message
      await submitChatMessage("*silence*");
      return;
    }

    // --- Process recorded audio ---
    setIsLoading(true); // Set loading specifically for STT processing
    showWarning("Processing speech..."); // Keep this warning

    const deepgramApiKey = settings.deepgramApiKey;
    const deepgramApiUrl = settings.deepgramApiUrl || "https://api.deepgram.com/v1/listen";

    if (!deepgramApiKey) {
      showWarning("Deepgram API Key is missing in settings.");
      setIsLoading(false); // Stop STT loading
      avatarActions.stopAudio(); // Ensure default state
      return;
    }

    let transcription = ""; // Initialize transcription
    try {
      console.log(`Attempting to fetch Deepgram URL: ${deepgramApiUrl}`); // Log the URL
      console.log(`Sending audio to Deepgram: ${deepgramApiUrl}`);
      const response = await fetch(deepgramApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': audioBlob.type,
        },
        body: audioBlob,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Deepgram API error: ${response.status} - ${errorData.message || errorData.err_msg || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log("Received Deepgram transcription data:", data);
      transcription = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""; // Get transcription or empty string

    } catch (error) {
      console.error("Speech recognition error:", error);
      showWarning(`Speech recognition failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      // Don't submit if STT fails, just reset loading state
      setIsLoading(false);
      setShowApiWarning(false);
      avatarActions.stopAudio(); // Ensure default state
      return; // Exit function
    }

    // Determine message content and submit
    const messageToSend = transcription.trim() || "*silence*";
    console.log(`Submitting transcribed/silence message: "${messageToSend}"`);
    setShowApiWarning(false); // Clear "Processing" warning
    // setIsLoading is handled by submitChatMessage
    await submitChatMessage(messageToSend);
  };
  const startRecording = async () => {
    if (!settings.deepgramApiKey) { showWarning(t("apiKeyMissing").replace("{model}", "Deepgram Speech-to-Text")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm;codecs=opus' };
      let recorder: MediaRecorder;
      try { recorder = new MediaRecorder(stream, options); }
      catch (err) { console.warn("Requested mimeType not supported, trying default."); recorder = new MediaRecorder(stream); }
      mediaRecorderRef.current = recorder; audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Got audio data, cancel the initial silence timer
          clearTimeout(silenceTimerRef.current!);
          silenceTimerRef.current = null; // Clear the ref
          audioChunksRef.current.push(event.data);
        }
        // No longer resetting a timer here
      };
      recorder.onstop = handleStopRecording;
      recorder.start();
      setIsListening(true);
      console.log("Recording started with mimeType:", recorder.mimeType);
      // Start initial silence timer (5 seconds)
      clearTimeout(silenceTimerRef.current!); // Clear any lingering timer
      silenceTimerRef.current = setTimeout(() => {
        console.log("Initial 5s silence detected, stopping recording...");
        // Check if still listening - user might have stopped manually just before timer fired
        if (isListening) {
            stopRecording(); // Automatically stop if 5s pass with no data
        }
        silenceTimerRef.current = null;
      }, 5000); // 5 seconds
    } catch (error) { console.error("Error accessing microphone:", error); showWarning("Could not access microphone."); setIsListening(false); }
  };
  // Modified stopRecording to clear the timer
  const stopRecording = () => {
    clearTimeout(silenceTimerRef.current!); // Clear silence timer
    silenceTimerRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsListening(false); console.log("Recording stopped");
    }
  };
  const toggleSpeechRecognition = () => { if (isListening) { stopRecording(); } else { startRecording(); } };
  // --- End Speech Recognition Logic ---

  // Language handling
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    setLayoutDirection(language === 'arabic' ? 'rtl' : 'ltr');
  }

  // Navigation
  const navigateToSettings = () => setShowSettings(true)
  const navigateBack = () => setShowSettings(false)
  const toggleHistoryExpanded = () => setHistoryExpanded(!historyExpanded)
  const toggleSidebarVisibility = () => setIsSidebarVisible(!isSidebarVisible); // Toggle function

  // Chat management
  const handleNewChat = () => {
    const messagesToSave = messages.filter((m) => m.role !== "system")
    if (currentChatId === null && messagesToSave.length > 0) { saveChat(messagesToSave) }
    setMessages([]); setCurrentChatId(null);
  }
  const saveChat = async (messagesToSave: Message[]) => {
    if (messagesToSave.length === 0) return
    const newChatId = Date.now()
    const placeholderTitle = "Generating title..."
    const newChatPlaceholder = { id: newChatId, title: placeholderTitle, date: new Date().toISOString() }
    setSavedChats((prev) => [newChatPlaceholder, ...prev])
    localStorage.setItem(`chat_${newChatId}`, JSON.stringify(messagesToSave))
    const historyWithPlaceholder = [newChatPlaceholder, ...savedChats]
    localStorage.setItem("chatHistory", JSON.stringify(historyWithPlaceholder))
    let finalTitle = `Chat ${newChatId}`
    try {
      const modelName = settings.selectedModel || "openai"
      const apiKey = getApiKeyForModel(modelName)
      const apiUrl = settings.apiUrl || getDefaultApiUrl(modelName)
      if (apiKey) {
        const titleResponse = await fetch("/api/generate-title", {
          method: "POST", headers: { "Content-Type": "application/json" },
          // Remove model and apiUrl as the backend route now always uses DeepSeek
          body: JSON.stringify({ messages: messagesToSave }),
        })
        if (titleResponse.ok) { const titleData = await titleResponse.json(); finalTitle = titleData.title || finalTitle }
        else { console.error("Failed to generate chat title:", await titleResponse.text()) }
      } else { console.warn("API key missing for title generation, using default title.") }
    } catch (error) { console.error("Error calling title generation API:", error) }
    setSavedChats((prev) => prev.map((chat) => chat.id === newChatId ? { ...chat, title: finalTitle } : chat))
    const finalHistory = savedChats.map((chat) => chat.id === newChatId ? { ...chat, title: finalTitle } : chat)
    finalHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    localStorage.setItem("chatHistory", JSON.stringify(finalHistory))
  }
  const handleSelectChat = (chatId: number) => {
    const messagesToSave = messages.filter((m) => m.role !== "system")
    if (currentChatId === null && messagesToSave.length > 0) { saveChat(messagesToSave) }
    setShowSettings(false); setCurrentChatId(chatId);
    try {
      const chatJson = localStorage.getItem(`chat_${chatId}`)
      if (!chatJson) { showWarning("Could not find chat content."); return }
      const parsedMessages: Message[] = JSON.parse(chatJson)
      const messagesToSet = settings.predefinedPrompt ? [{ id: `system-${Date.now()}`, role: "system" as const, content: settings.predefinedPrompt }, ...parsedMessages] : parsedMessages
      setMessages(messagesToSet)
    } catch (error) { console.error("Failed to load chat:", error); showWarning("Failed to load chat") }
  }
  const handleDeleteChat = (chatId: number) => {
    try {
      const updatedChats = savedChats.filter((chat) => chat.id !== chatId)
      setSavedChats(updatedChats)
      localStorage.removeItem(`chat_${chatId}`)
      localStorage.setItem("chatHistory", JSON.stringify(updatedChats))
    } catch (error) { console.error("Failed to delete chat:", error); showWarning("Failed to delete chat") }
  }

  // Helper functions
  const getApiKeyForModel = (model: string): string => {
    switch (model) {
      case "openai": return settings.openaiApiKey || ""
      case "gemini": return settings.geminiApiKey || ""
      case "deepseek": return settings.deepseekApiKey || ""
      case "anthropic": return settings.anthropicApiKey || ""
      case "custom": return settings.customApiKey || ""
      default: return ""
    }
  }
  const showWarning = (message: string) => { setApiWarningMessage(message); setShowApiWarning(true); }
  const saveSettings = (newSettings: any) => {
    try {
      Object.keys(newSettings).forEach((key) => { updateSettings(key as keyof typeof settings, newSettings[key]) })
      saveSettingsToContext(); showWarning(t("settingsSaved"));
    } catch (error) { console.error("Failed to save settings:", error); showWarning("Failed to save settings") }
  }
  useEffect(() => {
    if (apiWarningMessage) { const timer = setTimeout(() => setShowApiWarning(false), 5000); return () => clearTimeout(timer); }
  }, [apiWarningMessage])

// --- Define AvatarPanelComponent OUTSIDE Home ---
// (Moved this entire block outside the Home component definition)

// --- Home Component ---
  // *** START OF REWRITTEN JSX ***
  return (
    <TooltipProvider> {/* Added TooltipProvider */}
      <div className={cn(
          "flex h-screen overflow-hidden",
          layoutDirection === 'rtl' && 'flex-row-reverse', // Apply reverse order for RTL
          darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
        )}
      >

        {/* Sidebar (Collapsible) */}
        <div
          className={cn(
            "flex-shrink-0 flex flex-col items-center p-4 transition-all duration-300",
            // Conditional width
            isSidebarVisible ? 'w-64' : 'w-16',
            // Conditional border
            layoutDirection === 'ltr' ? 'border-r' : 'border-l',
            darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between w-full mb-8">
             <div className={cn("font-bold text-xl", !isSidebarVisible && "hidden")}>VIKINGS</div>
             {/* Toggle Button */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" onClick={toggleSidebarVisibility} className={cn(isSidebarVisible ? "ml-2" : "mx-auto")}>
                   {isSidebarVisible
                     ? (layoutDirection === 'ltr' ? <PanelLeftClose size={16} /> : <PanelRightClose size={16} />)
                     : (layoutDirection === 'ltr' ? <PanelLeftOpen size={16} /> : <PanelRightOpen size={16} />)
                   }
                 </Button>
               </TooltipTrigger>
               <TooltipContent side={layoutDirection === 'ltr' ? 'right' : 'left'}>
                 <p>{isSidebarVisible ? t("collapseSidebar") : t("expandSidebar")}</p>
               </TooltipContent>
             </Tooltip>
          </div>

          {/* New Chat Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                className={cn(
                  "bg-yellow-400 hover:bg-yellow-500 text-black mb-4 w-full",
                  !isSidebarVisible && "p-0 justify-center h-10" // Icon only style when collapsed
                )}
                onClick={() => { handleNewChat(); setShowSettings(false); }}
              >
                <Plus size={16} className={cn(isSidebarVisible && "mr-2")}/>
                {isSidebarVisible && t("newChat")}
              </Button>
            </TooltipTrigger>
            {!isSidebarVisible && (
              <TooltipContent side={layoutDirection === 'ltr' ? 'right' : 'left'}>
                <p>{t("newChat")}</p>
              </TooltipContent>
            )}
          </Tooltip>

          {/* History Toggle/Button */}
          {isSidebarVisible ? (
            <Button variant="ghost" className="w-full flex justify-between items-center mb-2" onClick={toggleHistoryExpanded}>
              <span>{t("history")}</span>{historyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 mb-2" onClick={toggleHistoryExpanded}>
                  <HistoryIcon size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={layoutDirection === 'ltr' ? 'right' : 'left'}>
                <p>{historyExpanded ? t("collapseHistory") : t("expandHistory")}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* History List (Only if sidebar and history are expanded) */}
          {isSidebarVisible && historyExpanded && (
            <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2 w-full">
              <ChatHistory history={savedChats} darkMode={darkMode} onSelectChat={handleSelectChat} onDeleteChat={handleDeleteChat} />
            </div>
          )}

          {/* Bottom Buttons */}
          <div className={cn("mt-auto w-full space-y-2", !isSidebarVisible && "flex flex-col items-center")}>
            {/* Account Button */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button
                   variant="outline"
                   className={cn(
                     "flex items-center gap-2 justify-center text-black w-full",
                     darkMode ? "border-gray-700 hover:bg-gray-800" : "",
                     !isSidebarVisible && "p-0 h-10 w-10" // Icon only style
                   )}
                 >
                   <User size={16} />
                   {isSidebarVisible && <span>{t("account")}</span>}
                 </Button>
               </TooltipTrigger>
               {!isSidebarVisible && (
                 <TooltipContent side={layoutDirection === 'ltr' ? 'right' : 'left'}>
                   <p>{t("account")}</p>
                 </TooltipContent>
               )}
             </Tooltip>

            {/* Settings Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex items-center gap-2 justify-center text-black w-full",
                    darkMode ? "border-gray-700 hover:bg-gray-800" : "",
                     !isSidebarVisible && "p-0 h-10 w-10" // Icon only style
                  )}
                  onClick={navigateToSettings}
                >
                  <Settings size={16} />
                  {isSidebarVisible && <span>{t("settings")}</span>}
                </Button>
              </TooltipTrigger>
              {!isSidebarVisible && (
                <TooltipContent side={layoutDirection === 'ltr' ? 'right' : 'left'}>
                  <p>{t("settings")}</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Theme Toggle (Only if sidebar is expanded) */}
            {isSidebarVisible && (
              <div className="flex justify-center gap-4 mt-4">
                <Button variant="ghost" size="icon" onClick={() => setDarkMode(false)} className={!darkMode ? "bg-gray-200" : ""}> <SunIcon size={16} /> </Button>
                <Button variant="ghost" size="icon" onClick={() => setDarkMode(true)} className={darkMode ? "bg-gray-700" : ""}> <MoonIcon size={16} /> </Button>
              </div>
            )}
          </div>
        </div>

        {/* Center Chat UI (Flexible Width) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Main Chat/Settings Content */}
          {!showSettings ? (
            <div className="flex-1 p-4 md:p-6 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="mb-4 md:mb-6">
                <h1 dir={selectedLanguage === 'arabic' ? 'rtl' : 'ltr'} className="text-xl md:text-2xl font-bold text-yellow-400">{t("talkToYourAI")}</h1>
                <p dir={selectedLanguage === 'arabic' ? 'rtl' : 'ltr'} className={cn("text-sm md:text-base", darkMode ? "text-gray-400" : "text-gray-500")}>
                  {t("assistantDescription")}
                </p>
              </div>
              {/* Language Selector */}
              <div className="mb-4">
                <LanguageSelector selectedLanguage={selectedLanguage} onSelectLanguage={handleLanguageChange} darkMode={darkMode} />
              </div>
              {/* Message List */}
              <Card className={cn("flex-1 mb-4 overflow-hidden flex flex-col", darkMode ? "bg-gray-800 border-gray-700" : "bg-white")}>
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4 custom-scrollbar">
                  {messages.filter((m) => m.role !== "system").map((message) => (
                    <div key={message.id} className={cn("p-3 rounded-lg inline-block max-w-[80%]", message.role === "user" ? "bg-yellow-100 text-gray-900 dark:bg-yellow-900 dark:text-yellow-100 self-end" : darkMode ? "bg-gray-800 text-gray-100 self-start" : "bg-gray-100 text-gray-900 self-start")}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  ))}
                  {isLoading && (
                    <div className={cn("p-3 rounded-lg inline-block self-start", darkMode ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900")}>
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
              {/* Input Form */}
              <form onSubmit={handleChatSubmit} className="flex gap-2">
                <Input value={input} onChange={handleInputChange} placeholder={t("inputPlaceholder")} className={cn("flex-1", darkMode ? "bg-gray-900 border-gray-800" : "bg-white")} disabled={!isInitialized || isLoading} /> {/* Disable input */}
                <Button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-black" disabled={!isInitialized || isLoading || !input.trim()}><Send size={18} /></Button> {/* Disable button */}
                <Button type="button" onClick={toggleSpeechRecognition} className={cn("bg-yellow-400 hover:bg-yellow-500 text-black", isListening && "bg-red-500 hover:bg-red-600")}><Mic size={18} /></Button>
              </form>
            </div>
          ) : (
            // Settings Page
            <SettingsPage darkMode={darkMode} onBack={navigateBack} selectedLanguage={selectedLanguage} initialSettings={settings} onSaveSettings={saveSettings} />
          )}
        </div>

        {/* Avatar Panel */}
              {/* Avatar Panel (Use the memoized component) */}
              {/* Always render AvatarPanelComponent, hide with CSS */}
              {/* Make avatar container take full height with bottom padding */}
              {/* Remove bottom padding */}
              <div className={cn("flex flex-col h-full", showSettings && "hidden")}>
                <AvatarPanelComponent
                  // Props related to avatar state are removed, component will get state from Valtio store
                  layoutDirection={layoutDirection}
                  darkMode={darkMode}
                />
              </div>

        {/* API Warning Toast */}
        {showApiWarning && (
          <div className={cn("fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-sm z-50 border-l-4 border-yellow-500", darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900")}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3"><p className="text-sm">{apiWarningMessage}</p></div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider> // Close TooltipProvider
  )
  // *** END OF REWRITTEN JSX ***
}
