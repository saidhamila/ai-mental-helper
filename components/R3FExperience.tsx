"use client"

import {
  CameraControls,
  ContactShadows,
  Environment,
  useGLTF, // Moved useGLTF here
} from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react"; // Added useState
import { R3FAvatar } from "./R3FAvatar";
import * as THREE from "three"; // Import THREE

export const R3FExperience = () => {
  const cameraControls = useRef<CameraControls | null>(null);
  const targetBoneRef = useRef<THREE.Object3D | null>(null); // Ref to store the target bone

  // Load the model within this component
  const { scene, animations } = useGLTF(
    "/models/64f1a714fe61576b46f27ca2.glb",
    "/draco/" // Keep Draco path
  ) as any; // Use 'as any' for now

  // Find the target bone when the scene is loaded/changed
  useEffect(() => {
    if (scene) {
      targetBoneRef.current = null; // Reset on scene change
      scene.traverse((object: THREE.Object3D) => { // Added type annotation
        if (object.name === "CC_Base_L_Breast_074") {
          console.log("Found target bone:", object.name);
          targetBoneRef.current = object;
        }
      });
      if (!targetBoneRef.current) {
          console.warn("Target bone 'CC_Base_L_Breast_074' not found in the scene graph.");
      }
    }
  }, [scene]); // Re-run if the scene object changes

  // Update camera target when controls and bone are ready
  useEffect(() => {
    // Check if refs have current values before accessing them
    const controls = cameraControls.current;
    const bone = targetBoneRef.current;

    if (controls && bone) {
      const targetPosition = new THREE.Vector3();
      bone.getWorldPosition(targetPosition); // Get bone's world position

      // Keep the previous camera offset (Y=3.3 relative to origin, Z=-6.0 relative to origin)
      // We need to calculate the camera position based on the *new* target (the bone)
      // Let's maintain the relative height and distance from the *bone*
      // Keep camera Y level with bone Y, maintain Z distance
      const cameraPosition = new THREE.Vector3(
          targetPosition.x - 2.0, // Increased negative X offset to shift camera further left
          targetPosition.y,      // Align Y with bone
          targetPosition.z - 6.0 // Position behind the bone at Z=-6.0 distance (as per last setting)
      );

      console.log("Setting camera lookAt based on bone:", cameraPosition, targetPosition);
      controls.setLookAt(
        cameraPosition.x, cameraPosition.y, cameraPosition.z, // Camera position
        targetPosition.x, targetPosition.y, targetPosition.z, // Target position (bone)
        true // Enable smooth transition
      );
    } else if (controls && !bone) {
        // Fallback if bone not found - use previous settings
        console.log("Target bone not found, using fallback camera settings.");
        // Revert to a reasonable default like face view if bone fails
        controls.setLookAt(0, 1.7, 1.0, 0, 1.65, 0, true);
    }
    // Ensure dependencies are stable refs or primitive values if possible
    // Using targetBoneRef.current directly might cause re-runs if the object reference changes internally
    // but for now, let's keep it simple. Scene dependency ensures we re-run if the model reloads.
  }, [scene]); // Re-run camera logic if the scene changes (model reloads)

  return (
    <>
      <CameraControls ref={cameraControls} smoothTime={0.4} /> {/* Slightly slower transition */}
      <Environment preset="sunset" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={0.2} />

      <Suspense fallback={null}>
        {/* Pass scene and animations down to R3FAvatar */}
        {/* Ensure scene and animations are loaded before rendering R3FAvatar */}
        {scene && animations && <R3FAvatar scene={scene} animations={animations} />}
      </Suspense>

      <ContactShadows opacity={0.7} blur={2} />
    </>
  );
};