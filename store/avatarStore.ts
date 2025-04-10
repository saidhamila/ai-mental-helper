// mental-health-ai/store/avatarStore.ts
import { proxy } from 'valtio'

interface AvatarState {
  animationName: string;
  audioUrl: string | null;
  lipSyncData: any | null; // Placeholder type, refine later
  isPlayingAudio: boolean;
  // Add other avatar-specific states if needed later
}

export const avatarStore = proxy<AvatarState>({
  animationName: 'Idle', // Default animation
  audioUrl: null,
  lipSyncData: null,
  isPlayingAudio: false,
});

// Optional: Define actions to modify the state (good practice)
export const avatarActions = {
  setAnimation: (name: string) => {
    avatarStore.animationName = name;
  },
  playAudio: (url: string, lipSync: any) => {
    avatarStore.audioUrl = url;
    avatarStore.lipSyncData = lipSync;
    avatarStore.isPlayingAudio = true;
    avatarStore.animationName = 'Talking'; // Assume talking animation when audio plays
  },
  stopAudio: () => {
    avatarStore.audioUrl = null;
    avatarStore.lipSyncData = null;
    avatarStore.isPlayingAudio = false;
    avatarStore.animationName = 'Idle'; // Revert to idle when stopped
  },
  // Add more actions as needed
};