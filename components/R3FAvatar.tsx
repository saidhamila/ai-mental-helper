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

    // --- A2F Animation Logic (Placeholder) ---
    if (snap.isPlayingAudio && audioRef.current && snap.animationData) {
      const currentTime = audioRef.current.currentTime;

      // TODO: Parse snap.animationData (the A2F gRPC response)
      // The structure is unknown, but we expect blendshape values over time.
      // Example structure might be: snap.animationData.frames[frameIndex].blendshapes = { mouthOpen: 0.8, ... }
      // Or it might be a continuous stream of values.

      // TODO: Find the correct blendshape values for the current audio time (currentTime).
      // This might involve finding the closest frame in the animationData or interpolating between frames.
      // Example placeholder:
      const currentBlendshapes = getCurrentA2FBlendshapes(snap.animationData, currentTime); // Placeholder function

      // TODO: Apply the found blendshape values to the model's morph targets.
      // Iterate through the blendshapes received from A2F for the current time.
      if (currentBlendshapes) {
        Object.entries(currentBlendshapes).forEach(([name, value]) => {
          // We need a mapping from A2F blendshape names (name) to the model's morph target names.
          // For now, assume they match or use a placeholder mapping.
          const morphTargetName = name; // Placeholder: Assume direct mapping
          lerpMorphTarget(morphTargetName, value as number, 0.2); // Adjust interpolation speed as needed
        });
      }

      // TODO: Reset morph targets not included in the current A2F frame?
      // This depends on whether A2F provides all blendshapes per frame or only active ones.
      // If only active ones, we need to reset others.
      // Example:
      // const allModelMorphTargets = Object.keys(nodes.Wolf3D_Head.morphTargetDictionary);
      // allModelMorphTargets.forEach(targetName => {
      //   if (!currentBlendshapes || !(targetName in currentBlendshapes)) {
      //      // Don't reset blinking or facial expressions managed elsewhere
      //      if (targetName !== 'eyeBlinkLeft' && targetName !== 'eyeBlinkRight' /* && other expression targets */) {
      //         lerpMorphTarget(targetName, 0, 0.2);
      //      }
      //   }
      // });

    } else {
      // If not playing audio or no animation data, reset facial animation morph targets (except expressions/blinking).
      // TODO: Define the list of morph targets controlled by A2F and reset them here.
      // Example placeholder - reset common lip-sync targets:
      const lipSyncTargets = ["viseme_PP", "viseme_FF", "viseme_kk", "viseme_DD", "viseme_nn", "viseme_SS", "viseme_TH", "viseme_CH", "viseme_RR", "viseme_I", "viseme_E", "viseme_AA", "viseme_O", "viseme_U", "jawOpen", "mouthOpen"]; // Add actual A2F targets
      lipSyncTargets.forEach(targetName => {
         lerpMorphTarget(targetName, 0, 0.2);
      });
    }
  });

// Placeholder function - replace with actual logic based on A2F response structure
function getCurrentA2FBlendshapes(animationData: any, currentTime: number): Record<string, number> | null {
  // console.log("Attempting to get blendshapes for time:", currentTime, "from data:", animationData);
  // This needs to parse the specific gRPC response format from NVIDIA A2F.
  // It might involve finding the frame closest to currentTime.
  // Example: If animationData has { frames: [{ time: 0.1, blendshapes: {...} }, ...] }
  // Find the frame where frame.time <= currentTime and potentially interpolate.
  return null; // Return null until implemented
}

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