# Emma - AI Mental Health Assistant

[![Developer](https://img.shields.io/badge/Developer-saidhamila-blueviolet)](https://github.com/saidhamila) <!-- Optional: Link to GitHub profile -->

[![Watch on YouTube](https://img.youtube.com/vi/0RjKeU40hDU/0.jpg)](https://youtu.be/0RjKeU40hDU)

> ⚠️ **Inspection Only:** This project is provided solely for inspection purposes. Any use, modification, or distribution is strictly prohibited.

A conversational AI assistant designed to provide a safe, empathetic space for users to explore their mental and emotional well-being. Emma utilizes advanced AI models for chat, text-to-speech, and facial animation to create a more engaging and supportive experience.

---

## Features

*   **Empathetic AI Chat:** Powered by configurable LLMs (DeepSeek, OpenAI, Gemini, Anthropic, Custom) with a focus on therapeutic conversation.
*   **Text-to-Speech (TTS):** Realistic voice output using ElevenLabs API.
*   **Animated Avatar:** Lifelike avatar (Emma) with facial animations driven by NVIDIA Audio2Face (A2F) technology, synchronized with TTS audio.
*   **Configurable Settings:** Easily manage API keys, select AI models, and adjust voice settings through a dedicated UI.
*   **Chat History:** Save and revisit previous conversations.
*   **Speech Recognition:** (Optional) Use your voice to interact with Emma via Deepgram integration.
*   **Customizable Prompting:** Define Emma's core personality and objectives through a detailed system prompt.
*   **Responsive UI:** Built with Next.js, React, Tailwind CSS, and shadcn/ui.

---

## Installation

Follow these steps to set up the project locally:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/BilBini/VIKINGS.git # Replace with your actual repo URL if different
    cd VIKINGS # Or your repository directory name
    ```

2.  **Install dependencies:**
    This project uses `pnpm` as the package manager.
    ```bash
    pnpm install
    ```
    *(If you don't have pnpm, install it first: `npm install -g pnpm`)*

3.  **Set up Environment Variables / API Keys:**
    *   The application requires API keys for various services (AI Models, ElevenLabs, NVIDIA A2F, Deepgram).
    *   There is no `.env` file checked into the repository for security. You will need to configure the necessary API keys through the application's **Settings UI** after launching it for the first time.

4.  **Run the development server:**
    ```bash
    pnpm dev
    ```

5.  **Access the application:**
    Open your browser and navigate to `http://localhost:3000`.

6.  **Configure Settings:**
    *   Click the **Settings** icon in the application.
    *   Enter your API keys for the desired AI model (e.g., DeepSeek), ElevenLabs, NVIDIA A2F, and Deepgram (if using speech-to-text).
    *   Select your preferred AI model and ElevenLabs voice ID.
    *   Click **Save Settings**.

---

## Usage

1.  **Start Chatting:** Type your message in the input box at the bottom and press Enter or click the Send button.
2.  **Voice Input (Optional):** Click the Microphone icon to start recording your voice. Click it again to stop recording and transcribe the audio using Deepgram.
3.  **Listen to Emma:** Emma's responses will be converted to speech using ElevenLabs and played automatically. The avatar's face will animate in sync using NVIDIA A2F data.
4.  **Manage History:** Use the sidebar (toggle visibility with the panel icon) to start new chats, view past conversations, or delete chats.
5.  **Adjust Settings:** Access the Settings page via the gear icon in the sidebar to update API keys, change the AI model, select a different voice, etc.

---

## Developer

This application was developed by **Saïd Hamila**.

---
