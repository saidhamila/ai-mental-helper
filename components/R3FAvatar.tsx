"use client"

import { useAnimations, Html } from "@react-three/drei"; // Removed useGLTF
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState, memo } from "react";
import { useSnapshot } from 'valtio/react';
import { avatarStore, avatarActions } from '@/store/avatarStore';
import * as THREE from "three";

// Basic facial expressions (can be expanded later)
const facialExpressions = {
  default: {},
  smile: {
    browInnerUp: 0.17,
    eyeSquintLeft: 0.4,
    eyeSquintRight: 0.44,
    noseSneerLeft: 0.17,
    noseSneerRight: 0.14,
    mouthPressLeft: 0.61,
    mouthPressRight: 0.41,
  },
};

// Define props for the component
interface R3FAvatarProps {
  scene: THREE.Group; // Expect the loaded scene graph
  animations: THREE.AnimationClip[]; // Expect animations
  // Include other props passed from parent if any (like position, scale)
  [key: string]: any;
}

const R3FAvatarComponent = ({ scene, animations, ...props }: R3FAvatarProps) => {
  // Get state snapshot from Valtio store
  const snap = useSnapshot(avatarStore);
  const group = useRef<THREE.Group>(null);

  // Removed useGLTF hook - scene and animations are now passed as props

  // Use animations passed via props, targeting the group ref
  const { actions } = useAnimations(animations, group);

  // Log available animation names once (using prop)
  useEffect(() => {
    if (animations && animations.length > 0) {
      console.log("Available animation names (from props):", JSON.stringify(animations.map((a: THREE.AnimationClip) => a.name)));
    }
  }, [animations]);

  // Audio playback ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Body animation effect
  useEffect(() => {
    // Ensure actions are available (might take a frame after animations prop updates)
    if (!actions) return;
    const currentAction = actions[snap.animationName];
    if (currentAction) {
      Object.values(actions).forEach(action => {
        if (action && action !== currentAction && action.isRunning()) {
          action.fadeOut(0.5);
        }
      });
      currentAction.reset().fadeIn(0.5).play();
    } else {
      console.warn(`Animation "${snap.animationName}" not found.`);
      // Fallback to default animation "W_2"
      if (actions["W_2"]) {
         actions["W_2"].reset().fadeIn(0.5).play();
      } else {
         console.warn(`Default animation "W_2" also not found!`);
      }
    }
  }, [snap.animationName, actions]); // Depend on actions object as well

  // Audio playback effect
  useEffect(() => {
    if (snap.audioUrl) {
      console.log("R3FAvatar: Received audioUrl:", snap.audioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
      }
      const audio = new Audio(snap.audioUrl);
      audioRef.current = audio;
      audio.oncanplaythrough = () => {
        console.log("R3FAvatar: Audio ready, playing...");
        audio.play().catch(e => console.error("Audio play failed:", e));
      };
      audio.onended = () => {
        console.log("R3FAvatar: Audio ended.");
        avatarActions.stopAudio(); // Resets state including animation name to W_2
      };
      audio.onerror = (e) => {
        console.error("R3FAvatar: Audio error:", e);
        avatarActions.stopAudio();
      };
      return () => {
        console.log("R3FAvatar: Cleaning up audio effect.");
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onended = null;
          audioRef.current = null;
        }
      };
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
      }
    }
  }, [snap.audioUrl]);

  // Modified lerpMorphTarget to use the scene prop
  const lerpMorphTarget = (targetName: string, value: number, speed = 0.1) => {
    if (!scene) return; // Ensure scene prop is valid

    scene.traverse((child: any) => {
      // Apply to head, eyes, and teeth meshes if they exist and have morph targets
      if (child.isSkinnedMesh &&
          (child.name === "Wolf3D_Head" || child.name === "EyeLeft" || child.name === "EyeRight" || child.name === "Wolf3D_Teeth")) {

        if (child.morphTargetDictionary && child.morphTargetInfluences) {
          // Log the morph target names for the relevant meshes the first time we see them
          if (!loggedMorphTargets[child.name]) {
             console.log(`Morph Targets for ${child.name}:`, Object.keys(child.morphTargetDictionary));
             loggedMorphTargets[child.name] = true; // Log only once per mesh name
          }
          const index = child.morphTargetDictionary[targetName];
          if (index !== undefined && child.morphTargetInfluences[index] !== undefined) {
            child.morphTargetInfluences[index] = THREE.MathUtils.lerp(
              child.morphTargetInfluences[index],
              value,
              speed
            );
          }
        }
      }
    });
  };

  const [blink, setBlink] = useState(false);
  // Helper state to prevent excessive logging
  const [loggedMorphTargets, setLoggedMorphTargets] = useState<Record<string, boolean>>({});

  useFrame(() => {
    // Apply blinking
    lerpMorphTarget("EyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("EyeBlinkRight", blink ? 1 : 0, 0.5);

    // --- A2F Animation Logic ---
    const animData = snap.animationData;

    if (snap.isPlayingAudio && audioRef.current && animData?.names && animData?.timecourse && animData.timecourse.length > 0) {
      const currentTime = audioRef.current.currentTime;
      let frameIndex = animData.timecourse.findIndex((frame: any) => frame.time_code >= currentTime);
      if (frameIndex === -1) { frameIndex = animData.timecourse.length - 1; }
      if (frameIndex === 0 && currentTime < animData.timecourse[0].time_code) { /* Use first frame */ }
      const prevFrame = animData.timecourse[frameIndex === 0 ? 0 : frameIndex - 1];
      const nextFrame = animData.timecourse[frameIndex];
      if (!prevFrame || !nextFrame) { return; }
      let t = 0;
      const timeDiff = nextFrame.time_code - prevFrame.time_code;
      if (timeDiff > 0) {
        t = (currentTime - prevFrame.time_code) / timeDiff;
        t = Math.max(0, Math.min(1, t));
      } else if (currentTime >= nextFrame.time_code) {
         t = 1;
       }
      animData.names.forEach((name: string, i: number) => {
        if (name === 'EyeBlinkLeft' || name === 'EyeBlinkRight') { return; }
        const prevValue = prevFrame.values[i] ?? 0;
        const nextValue = nextFrame.values[i] ?? 0;
        const interpolatedValue = THREE.MathUtils.lerp(prevValue, nextValue, t);
        lerpMorphTarget(name, interpolatedValue, 0.5);
      });
    } else {
      if (animData?.names) {
        animData.names.forEach((name: string) => {
          if (name !== 'EyeBlinkLeft' && name !== 'EyeBlinkRight') {
             lerpMorphTarget(name, 0, 0.2);
          }
        });
      } else if (!animData?.names && snap.animationName !== 'W_2') {
         const commonTargets = animData?.names || ["jawOpen", "mouthOpen", "mouthSmileLeft", "mouthSmileRight", "viseme_PP", "viseme_FF", "viseme_kk", "viseme_DD", "viseme_nn", "viseme_SS", "viseme_TH", "viseme_CH", "viseme_RR", "viseme_I", "viseme_E", "viseme_AA", "viseme_O", "viseme_U", "EyeBlinkLeft", "EyeBlinkRight"];
         commonTargets.forEach((name: string) => {
             if (name !== 'EyeBlinkLeft' && name !== 'EyeBlinkRight') {
                 lerpMorphTarget(name, 0, 0.2);
             }
         });
      }
    }
  });

  // Blinking logic
  useEffect(() => {
    let blinkTimeout: NodeJS.Timeout;
    const nextBlink = () => {
      blinkTimeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          nextBlink();
        }, 200);
      }, THREE.MathUtils.randInt(1000, 5000));
    };
    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // Return structure with primitive, using the passed scene
  return (
    <group {...props} dispose={null} ref={group}>
      {/* Render the entire loaded scene passed via props */}
      <primitive object={scene} />
    </group>
  );
};

// Export the memoized component
export const R3FAvatar = memo(R3FAvatarComponent);

// Removed useGLTF.preload call