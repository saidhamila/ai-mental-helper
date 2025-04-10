"use client"

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
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

// --- Viseme Mapping ---
// Example mapping - adjust based on actual ElevenLabs viseme labels
const visemeMapping: { [key: string]: string } = {
  p: "viseme_PP", b: "viseme_PP", m: "viseme_PP",
  f: "viseme_FF", v: "viseme_FF",
  k: "viseme_kk", g: "viseme_kk",
  t: "viseme_DD", d: "viseme_DD", n: "viseme_nn",
  s: "viseme_SS", z: "viseme_SS",
  T: "viseme_TH", D: "viseme_TH", // th sounds
  S: "viseme_CH", Z: "viseme_CH", // sh, zh sounds
  r: "viseme_RR", l: "viseme_RR",
  i: "viseme_I", I: "viseme_I",   // ee, ih
  e: "viseme_E", E: "viseme_E",   // eh, ae
  a: "viseme_AA", A: "viseme_AA", // ah
  O: "viseme_O", o: "viseme_O",   // oh, aw
  u: "viseme_U", U: "viseme_U",   // oo, book
  sil: "viseme_sil", // Silence - map to a specific target or handle separately
};
const allVisemeMorphNames = [...new Set(Object.values(visemeMapping))]; // Unique morph names used

// Update component signature
// Update component signature
// Update component signature - remove props
export function R3FAvatar(props: any) { // Keep generic props for position etc.
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

  // Store the current viseme target
  const currentViseme = useRef<string | null>(null);

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

    // --- Lip Sync Logic ---
    let activeMorphTarget: string | null = null;

    if (snap.isPlayingAudio && audioRef.current && snap.lipSyncData?.visemes?.length > 0) {
      const currentTime = audioRef.current.currentTime;

      // Find the current viseme based on timestamp
      // Assumes snap.lipSyncData.visemes is sorted: [ [viseme_label, timestamp], ... ]
      let foundVisemeLabel = 'sil'; // Default to silence
      for (let i = snap.lipSyncData.visemes.length - 1; i >= 0; i--) {
        const [label, timestamp] = snap.lipSyncData.visemes[i];
        if (currentTime >= timestamp) {
          foundVisemeLabel = label;
          break;
        }
      }

      // Map the found label to our morph target name
      activeMorphTarget = visemeMapping[foundVisemeLabel] || null; // Map label to morph target
      if (foundVisemeLabel === 'sil') {
          activeMorphTarget = null; // Don't activate any morph for silence
      }
      currentViseme.current = activeMorphTarget; // Store for interpolation

    } else {
      // If not playing, reset target
      currentViseme.current = null;
    }

    // Apply interpolation to all viseme morph targets
    allVisemeMorphNames.forEach((name) => {
      if (name === 'viseme_sil') return; // Skip explicit silence target if handled by resetting others

      if (name === currentViseme.current) {
        lerpMorphTarget(name, 1, 0.4); // Interpolate active viseme to 1 (adjust speed)
      } else {
        lerpMorphTarget(name, 0, 0.4); // Interpolate inactive visemes to 0 (adjust speed)
      }
      }); // End of forEach loop
// The forEach loop correctly handles the case where currentViseme.current is null (audio not playing)
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
}

// Preload assets
useGLTF.preload("/models/64f1a714fe61576b46f27ca2.glb");
useGLTF.preload("/models/animations.glb");