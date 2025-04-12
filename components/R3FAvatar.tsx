"use client"

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState, memo } from "react"; // Import memo
import { useSnapshot } from 'valtio/react'; // Import useSnapshot
import { avatarStore, avatarActions } from '@/store/avatarStore'; // Import store and actions
import * as THREE from "three";

// Removed props interface R3FAvatarProps
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

// --- A2F Blendshape Handling (Placeholder) ---
// We will need to know the names of the blendshapes provided by A2F
// and how they map to the morph targets in the GLB model (nodes.Wolf3D_Head.morphTargetDictionary).
// Example potential A2F blendshape names (replace with actual names):
// const a2fBlendshapeNames = ["mouthOpen", "jawOpen", "mouthSmile", "eyesClosed", ...];

// Update component signature
// Update component signature
// Update component signature - remove props
// Wrap component definition
const R3FAvatarComponent = (props: any) => { // Keep generic props for position etc.
  // Get state snapshot from Valtio store
  const snap = useSnapshot(avatarStore);
  const group = useRef<THREE.Group>(null);
  const { nodes, materials, scene } = useGLTF(
    "/models/64f1a714fe61576b46f27ca2.glb"
  ) as any; // Use 'as any' for GLTF result type for now

  const { animations } = useGLTF("/models/animations.glb") as any; // Use 'as any' for GLTF result type for now

  const { actions } = useAnimations(animations, group); // Removed mixer as it wasn't used directly

  // Audio playback ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Remove isPlayingAudio state, use snap.isPlayingAudio instead
  // Update the useEffect hook to use props.animationName
  useEffect(() => {
    // Use props.animationName directly
    const currentAction = actions[snap.animationName]; // Use state from snapshot
    if (currentAction) {
      // Fade out previous animation if any is playing
      // Note: This simple fade out might need refinement for smoother transitions
      Object.values(actions).forEach(action => {
        if (action && action !== currentAction && action.isRunning()) {
          action.fadeOut(0.5);
        }
      });

      // Fade in and play the new animation
      currentAction
        .reset()
        .fadeIn(0.5)
        .play();

      // No cleanup needed here to fade out, as the next effect will handle it
    } else {
      console.warn(`Animation "${snap.animationName}" not found.`);
      // Optionally play a default animation like Idle if the provided one doesn't exist
      if (actions["Idle"]) {
         actions["Idle"].reset().fadeIn(0.5).play();
      }
    }
  }, [snap.animationName, actions]); // Depend on state from snapshot

  // Audio playback effect
  useEffect(() => { // Audio playback effect - use snap.audioUrl
    if (snap.audioUrl) { // Use state from snapshot
      console.log("R3FAvatar: Received audioUrl:", snap.audioUrl);
      // Ensure previous audio is stopped and cleaned up
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null; // Remove previous listener
        audioRef.current = null;
      }

      const audio = new Audio(snap.audioUrl);
      audioRef.current = audio;

      audio.oncanplaythrough = () => {
        console.log("R3FAvatar: Audio ready, playing...");
        audio.play().catch(e => console.error("Audio play failed:", e));
        // No need to setIsPlayingAudio, store action handles it
        // isPlayingAudio state is set by the playAudio action
      };

      audio.onended = () => {
        console.log("R3FAvatar: Audio ended.");
        // Call action to update store state (sets isPlaying=false, animation=Idle, etc.)
        avatarActions.stopAudio();
      };

      audio.onerror = (e) => {
        console.error("R3FAvatar: Audio error:", e);
        avatarActions.stopAudio(); // Also stop on error
        // Handle error, maybe signal parent
      };

      // Cleanup function
      return () => {
        console.log("R3FAvatar: Cleaning up audio effect.");
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onended = null;
          audioRef.current = null; // Release reference
        }
        // isPlayingAudio state is handled by stopAudio action
      };
    } else {
      // If audioUrl becomes null, ensure cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
      }
      // isPlayingAudio state is handled by stopAudio action
    }
  }, [snap.audioUrl]); // Depend on state from snapshot
  const lerpMorphTarget = (target: string, value: number, speed = 0.1) => {
    scene.traverse((child: any) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[target];
        if (
          index === undefined ||
          !child.morphTargetInfluences || // Check if morphTargetInfluences exists
          child.morphTargetInfluences[index] === undefined
        ) {
          return;
        }
        child.morphTargetInfluences[index] = THREE.MathUtils.lerp(
          child.morphTargetInfluences[index],
          value,
          speed
        );
      }
    });
  };

  const [blink, setBlink] = useState(false);
  const [facialExpression] = useState("default"); // Keep default for now

  // TODO: Add refs or state needed to manage A2F animation timing and interpolation if necessary
  useFrame(() => {
    // Apply facial expressions (simplified)
    Object.keys(nodes.EyeLeft.morphTargetDictionary).forEach((key) => {
      const mapping = (facialExpressions as any)[facialExpression];
      if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") {
        return; // eyes wink/blink are handled separately
      }
      if (mapping && mapping[key]) {
        lerpMorphTarget(key, mapping[key], 0.1);
      } else {
        lerpMorphTarget(key, 0, 0.1);
      }
    });

    // Apply blinking
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    // --- A2F Animation Logic ---
    const animData = snap.animationData; // Shortcut

    if (snap.isPlayingAudio && audioRef.current && animData && animData.names && animData.timecourse && animData.timecourse.length > 0) {
      const currentTime = audioRef.current.currentTime;
      // --- DEBUG LOGGING START ---
      console.log(`Current Time: ${currentTime.toFixed(3)}`);

      // Find the current frame index based on time
      let frameIndex = animData.timecourse.findIndex((frame: any) => frame.time_code >= currentTime);

      // Handle edge cases: before first frame or after last frame
      if (frameIndex === -1) { // After last frame
        frameIndex = animData.timecourse.length - 1;
      }
      if (frameIndex === 0 && currentTime < animData.timecourse[0].time_code) { // Before first frame
         // Use first frame directly
      }

      const prevFrame = animData.timecourse[frameIndex === 0 ? 0 : frameIndex - 1];
      const nextFrame = animData.timecourse[frameIndex];

      if (!prevFrame || !nextFrame) {
        // Should not happen if timecourse has data, but good to check
        return;
      }

      // Calculate interpolation factor (t)
      let t = 0;
      const timeDiff = nextFrame.time_code - prevFrame.time_code;
      if (timeDiff > 0) { // Avoid division by zero if frames have same timecode
        t = (currentTime - prevFrame.time_code) / timeDiff;
        t = Math.max(0, Math.min(1, t)); // Clamp t between 0 and 1
      } else if (currentTime >= nextFrame.time_code) {
         t = 1; // If current time is at or past the next frame, use next frame's values
       }
       console.log(`Frame Indices: Prev=${frameIndex === 0 ? 0 : frameIndex - 1}, Next=${frameIndex}, t=${t.toFixed(2)}`);
      // Misplaced closing brace removed from here


      // Apply interpolated values to morph targets
      animData.names.forEach((name: string, i: number) => {
        const prevValue = prevFrame.values[i] ?? 0; // Default to 0 if value missing
        const nextValue = nextFrame.values[i] ?? 0; // Default to 0 if value missing

        // Interpolate using THREE.MathUtils.lerp for clarity
        const interpolatedValue = THREE.MathUtils.lerp(prevValue, nextValue, t);

        // Apply the interpolated value (use a slightly faster speed for lip sync)
        lerpMorphTarget(name, interpolatedValue, 0.5);
        // Log one specific blendshape value for debugging
        if (name === 'JawOpen' || name === 'mouthOpen') { // Check common names
           console.log(`  ${name}: ${interpolatedValue.toFixed(3)} (Prev: ${prevValue.toFixed(3)}, Next: ${nextValue.toFixed(3)}, t: ${t.toFixed(2)})`);
        }
        // --- DEBUG LOGGING END ---
      }); // End animData.names.forEach

    } // <--- Correct closing brace for the main 'if (snap.isPlayingAudio && ...)' block

    else {
      // If not playing audio or no valid animation data, reset A2F-controlled morph targets to 0
      if (animData && animData.names) {
        animData.names.forEach((name: string) => {
          // Don't reset blinking targets if they are managed separately
          if (name !== 'eyeBlinkLeft' && name !== 'eyeBlinkRight') {
             lerpMorphTarget(name, 0, 0.2); // Reset speed
          }
        });
      } else {
         // Fallback: If names are missing, maybe reset known common targets? (Less ideal)
         const commonTargets = ["jawOpen", "mouthOpen", "mouthSmileLeft", "mouthSmileRight", "viseme_PP", "viseme_FF", "viseme_kk", "viseme_DD", "viseme_nn", "viseme_SS", "viseme_TH", "viseme_CH", "viseme_RR", "viseme_I", "viseme_E", "viseme_AA", "viseme_O", "viseme_U"];
         commonTargets.forEach(name => lerpMorphTarget(name, 0, 0.2));
      }
    }
  });

// Removed placeholder function getCurrentA2FBlendshapes

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

  // Simplified return structure
  return (
    <group {...props} dispose={null} ref={group}>
      <primitive object={nodes.Hips} />
      <skinnedMesh
        name="Wolf3D_Body"
        geometry={nodes.Wolf3D_Body.geometry}
        material={materials.Wolf3D_Body}
        skeleton={nodes.Wolf3D_Body.skeleton}
      />
      <skinnedMesh
        name="Wolf3D_Outfit_Bottom"
        geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
        material={materials.Wolf3D_Outfit_Bottom}
        skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
      />
      <skinnedMesh
        name="Wolf3D_Outfit_Footwear"
        geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
        material={materials.Wolf3D_Outfit_Footwear}
        skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
      />
      <skinnedMesh
        name="Wolf3D_Outfit_Top"
        geometry={nodes.Wolf3D_Outfit_Top.geometry}
        material={materials.Wolf3D_Outfit_Top}
        skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
      />
      <skinnedMesh
        name="Wolf3D_Hair"
        geometry={nodes.Wolf3D_Hair.geometry}
        material={materials.Wolf3D_Hair}
        skeleton={nodes.Wolf3D_Hair.skeleton}
      />
      <skinnedMesh
        name="EyeLeft"
        geometry={nodes.EyeLeft.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeLeft.skeleton}
        morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
      />
      <skinnedMesh
        name="EyeRight"
        geometry={nodes.EyeRight.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeRight.skeleton}
        morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
      />
      <skinnedMesh
        name="Wolf3D_Head"
        geometry={nodes.Wolf3D_Head.geometry}
        material={materials.Wolf3D_Skin}
        skeleton={nodes.Wolf3D_Head.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
      />
      <skinnedMesh
        name="Wolf3D_Teeth"
        geometry={nodes.Wolf3D_Teeth.geometry}
        material={materials.Wolf3D_Teeth}
        skeleton={nodes.Wolf3D_Teeth.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
      />
    </group>
  );
};

// Export the memoized component
export const R3FAvatar = memo(R3FAvatarComponent);

// Preload assets
useGLTF.preload("/models/64f1a714fe61576b46f27ca2.glb");
useGLTF.preload("/models/animations.glb");