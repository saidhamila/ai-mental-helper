"use client"

import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react" // Import delete icon
import { Button } from "@/components/ui/button" // Import Button
interface ChatHistoryProps {
  history: {
    id: number
    title: string
    date: string
  }[]
  darkMode: boolean
  onSelectChat: (id: number) => void
  onDeleteChat: (id: number) => void // Add delete handler prop
}

export default function ChatHistory({ history, darkMode, onSelectChat, onDeleteChat }: ChatHistoryProps) {
  return (
    <div className="space-y-2 text-sm">
      {history.map((chat) => (
        <div
          key={chat.id}
          title={chat.title} // Add title attribute for hover tooltip
          className={cn(
            "p-2 rounded cursor-pointer hover:bg-opacity-80 flex flex-col", // Use flex column
            darkMode ? "hover:bg-gray-800" : "hover:bg-gray-200",
          )}
          // Move main click handler here, delete button will stop propagation
          onClick={() => onSelectChat(chat.id)}
        >
          <div className="flex items-center justify-between w-full"> {/* Flex row for title and delete */}
            <div className="flex-1 mr-1">{chat.title}</div> {/* Removed truncate, rely on flex and tooltip */}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 shrink-0" // Make button small
              onClick={(e) => {
                e.stopPropagation() // Prevent triggering onSelectChat
                onDeleteChat(chat.id)
              }}
            >
              <Trash2 size={12} /> {/* Smaller icon */}
            </Button>
          </div>
          <div className={cn("text-xs mt-1", darkMode ? "text-gray-400" : "text-gray-500")}> {/* Date below */}
            {new Date(chat.date).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  )
}
