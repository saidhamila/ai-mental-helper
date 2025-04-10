"use client"

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { R3FExperience } from "./R3FExperience"; // Import the experience component

// No props needed anymore, state comes from Valtio store
// interface AvatarDisplayProps { ... }

// Update component signature
// Update component signature
export default function AvatarDisplay() { // Removed props
  return (
    <div className="relative w-full h-full">
      {/* R3F Canvas */}
      <Canvas shadows camera={{ position: [0, 0, 2.5], fov: 30 }}> {/* Adjusted initial camera */}
        <Suspense fallback={null}> {/* Suspense for loading */}
          {/* R3FExperience will get state directly from store */}
          <R3FExperience />
        </Suspense>
      </Canvas>

      {/* Title removed, will be placed in the parent component */}
    </div>
  )
}
