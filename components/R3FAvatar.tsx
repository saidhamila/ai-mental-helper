"use client"

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState, memo } from "react"; // Import memo
import { useSnapshot } from 'valtio/react'; // Import useSnapshot
import { avatarStore, avatarActions } from '@/store/avatarStore'; // Import store and actions
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

const R3FAvatarComponent = (props: any) => { // Keep generic props for position etc.
  // Get state snapshot from Valtio store
  const snap = useSnapshot(avatarStore);
  const group = useRef<THREE.Group>(null);
  // Load the main model GLB, which now includes animations
  const { nodes, materials, scene, animations } = useGLTF(
    "/models/64f1a714fe61576b46f27ca2.glb"
  ) as any; // Use 'as any' for GLTF result type for now

  // Use animations from the main model GLB, targeting the group ref
  const { actions } = useAnimations(animations, group);

  // Log available animation names once
  useEffect(() => {
    if (animations && animations.length > 0) {
      console.log("Available animation names:", JSON.stringify(animations.map((a: THREE.AnimationClip) => a.name)));
    }
  }, [animations]);

  // Audio playback ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Body animation effect
  useEffect(() => {
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
  }, [snap.animationName, actions]);

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

  // Modified lerpMorphTarget to find meshes by name during traversal
  const lerpMorphTarget = (targetName: string, value: number, speed = 0.1) => {
    if (!scene) return; // Ensure scene is loaded

    scene.traverse((child: any) => {
      // Log all skinned mesh names found
      if (child.isSkinnedMesh) {
        // console.log(`Found SkinnedMesh: ${child.name}`); // Uncomment for verbose logging
      }
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
          // Optional: Warn if a target name from A2F doesn't exist on the mesh
          // else if (index === undefined && value > 0.01) { // Only warn if trying to apply non-zero value
          //   console.warn(`Morph target "${targetName}" not found on mesh "${child.name}"`);
          // }
        }
      }
    });
  };

  const [blink, setBlink] = useState(false);
  // Helper state to prevent excessive logging
  const [loggedMorphTargets, setLoggedMorphTargets] = useState<Record<string, boolean>>({});
  // const [facialExpression] = useState("default"); // Keep default for now - Commented out as it's not used

  useFrame(() => {
    // Apply blinking
    // Need to ensure 'eyeBlinkLeft' and 'eyeBlinkRight' are valid target names from A2F data or model
    lerpMorphTarget("EyeBlinkLeft", blink ? 1 : 0, 0.5); // Assuming A2F uses 'EyeBlinkLeft'
    lerpMorphTarget("EyeBlinkRight", blink ? 1 : 0, 0.5); // Assuming A2F uses 'EyeBlinkRight'

    // --- A2F Animation Logic ---
    const animData = snap.animationData; // Shortcut

    if (snap.isPlayingAudio && audioRef.current && animData?.names && animData?.timecourse && animData.timecourse.length > 0) {
      // console.log("useFrame: Applying A2F animation frame..."); // Uncomment for verbose logging
      const currentTime = audioRef.current.currentTime;

      // Find the current frame index based on time
      let frameIndex = animData.timecourse.findIndex((frame: any) => frame.time_code >= currentTime);

      // Handle edge cases
      if (frameIndex === -1) { frameIndex = animData.timecourse.length - 1; }
      if (frameIndex === 0 && currentTime < animData.timecourse[0].time_code) { /* Use first frame */ }

      const prevFrame = animData.timecourse[frameIndex === 0 ? 0 : frameIndex - 1];
      const nextFrame = animData.timecourse[frameIndex];

      if (!prevFrame || !nextFrame) { return; }

      // Calculate interpolation factor (t)
      let t = 0;
      const timeDiff = nextFrame.time_code - prevFrame.time_code;
      if (timeDiff > 0) {
        t = (currentTime - prevFrame.time_code) / timeDiff;
        t = Math.max(0, Math.min(1, t));
      } else if (currentTime >= nextFrame.time_code) {
         t = 1;
       }
       // console.log(`Frame Indices: Prev=${frameIndex === 0 ? 0 : frameIndex - 1}, Next=${frameIndex}, t=${t.toFixed(2)}`);

      // Apply interpolated values to morph targets
      animData.names.forEach((name: string, i: number) => {
        // Skip blinking targets if they are handled separately by the blink state
        if (name === 'EyeBlinkLeft' || name === 'EyeBlinkRight') {
            return;
        }
        const prevValue = prevFrame.values[i] ?? 0;
        const nextValue = nextFrame.values[i] ?? 0;
        const interpolatedValue = THREE.MathUtils.lerp(prevValue, nextValue, t);
        lerpMorphTarget(name, interpolatedValue, 0.5); // Apply A2F data

        // Log one specific blendshape value for debugging
        // if (name === 'JawOpen' || name === 'mouthOpen') {
        //    console.log(`  ${name}: ${interpolatedValue.toFixed(3)} (Prev: ${prevValue.toFixed(3)}, Next: ${nextValue.toFixed(3)}, t: ${t.toFixed(2)})`);
        // }
      });

    } else {
      // If not playing audio or no valid animation data, reset A2F-controlled morph targets to 0
      if (animData?.names) { // Use optional chaining
        animData.names.forEach((name: string) => {
          // Don't reset blinking targets if they are managed separately
          if (name !== 'EyeBlinkLeft' && name !== 'EyeBlinkRight') {
             lerpMorphTarget(name, 0, 0.2); // Reset speed
          }
        });
      } else if (!animData?.names && snap.animationName !== 'W_2') {
         // If animation data is missing BUT we are not in the default state
         // (e.g., after an error during A2F), explicitly reset common targets.
         // This prevents the face from freezing in the last animated state.
         const commonTargets = animData?.names || ["jawOpen", "mouthOpen", "mouthSmileLeft", "mouthSmileRight", "viseme_PP", "viseme_FF", "viseme_kk", "viseme_DD", "viseme_nn", "viseme_SS", "viseme_TH", "viseme_CH", "viseme_RR", "viseme_I", "viseme_E", "viseme_AA", "viseme_O", "viseme_U", "EyeBlinkLeft", "EyeBlinkRight"]; // Use A2F names if available, else fallback
         commonTargets.forEach((name: string) => {
             if (name !== 'EyeBlinkLeft' && name !== 'EyeBlinkRight') { // Check again here
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
        setBlink(true); // Use the state setter
        setTimeout(() => {
          setBlink(false); // Use the state setter
          nextBlink();
        }, 200); // Blink duration
      }, THREE.MathUtils.randInt(1000, 5000)); // Time between blinks
    };
    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []); // Empty dependency array ensures this runs once on mount

  // Return structure with primitive
  return (
    <group {...props} dispose={null} ref={group}>
      {/* Render the entire loaded scene */}
      {/* The useAnimations hook needs the group ref to target animations within this scene */}
      <primitive object={scene} />
    </group>
  );
};

// Export the memoized component
export const R3FAvatar = memo(R3FAvatarComponent);

// Preload assets
useGLTF.preload("/models/64f1a714fe61576b46f27ca2.glb");
// Remove preload for the separate animations file