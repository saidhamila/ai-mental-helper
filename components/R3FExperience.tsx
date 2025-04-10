"use client"

import {
  CameraControls,
  ContactShadows,
  Environment,
} from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import { R3FAvatar } from "./R3FAvatar"; // Import the avatar component

// No props needed anymore, state comes from Valtio store
// interface R3FExperienceProps { ... }

// Update component signature
// Update component signature
export const R3FExperience = () => { // Removed props
  const cameraControls = useRef<CameraControls | null>(null); // Ref for camera controls

  // Initial camera setup
  useEffect(() => {
    if (cameraControls.current) {
      // Zoomed in for half-body shot
      cameraControls.current.setLookAt(0, 1.6, 1.5, 0, 1.4, 0); // Adjusted camera height and target
    }
  }, []);

  // Add camera zoom logic later if needed based on interaction state

  return (
    <>
      <CameraControls ref={cameraControls} smoothTime={0.2} />
      <Environment preset="sunset" />
      {/* Basic lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={0.2} />

      {/* Wrap Avatar in Suspense for asset loading */}
      <Suspense fallback={null}>
        {/* R3FAvatar will get state directly from store */}
        <R3FAvatar position-y={0} />
      </Suspense>

      <ContactShadows opacity={0.7} blur={2} />
    </>
  );
};