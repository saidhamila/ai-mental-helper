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
  animationName: 'Idle', // Default animation
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
    avatarStore.animationName = 'Talking'; // Assume talking animation when audio plays
  },
  stopAudio: () => {
    avatarStore.audioUrl = null;
    avatarStore.animationData = null; // Changed state property
    avatarStore.isPlayingAudio = false;
    avatarStore.animationName = 'Idle'; // Revert to idle when stopped
  },
  // Add more actions as needed
};