// mental-health-ai/store/avatarStore.ts
import { proxy } from 'valtio'

interface AvatarState {
  animationName: string;
  audioUrl: string | null;
  animationData: any | null; // Changed from lipSyncData, placeholder type
  isPlayingAudio: boolean;
  // Add other avatar-specific states if needed later
}

export const avatarStore = proxy<AvatarState>({
  animationName: 'W_2', // Default animation (Updated from Idle)
  audioUrl: null,
  animationData: null, // Changed from lipSyncData
  isPlayingAudio: false,
});

// Optional: Define actions to modify the state (good practice)
export const avatarActions = {
  setAnimation: (name: string) => {
    avatarStore.animationName = name;
  },
  playAudio: (url: string, animData: any) => { // Changed param name
    avatarStore.audioUrl = url;
    avatarStore.animationData = animData; // Changed state property
    avatarStore.isPlayingAudio = true;
    // Keep body animation Idle while talking, as 'Talking' animation doesn't exist
    // Facial animation is handled by blendshapes
    avatarStore.animationName = 'W_2'; // Keep playing default body animation (Updated from Idle)
  },
  stopAudio: () => {
    avatarStore.audioUrl = null;
    avatarStore.animationData = null; // Changed state property
    avatarStore.isPlayingAudio = false;
    avatarStore.animationName = 'W_2'; // Revert to default animation when stopped (Updated from Idle)
  },
  // Add more actions as needed
};