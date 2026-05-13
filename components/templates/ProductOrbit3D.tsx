"use client";

import React, { useLayoutEffect, useRef } from "react";
import type { Mesh } from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";

function CameraRig({ frame }: { frame: number }) {
  const { camera } = useThree();
  const frameRef = useRef(frame);
  useLayoutEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  useFrame(() => {
    const f = frameRef.current;
    const cycle = f % 150;
    const z = cycle <= 75 ? 5.2 - (2.1 * cycle) / 75 : 3.1 + (2.1 * (cycle - 75)) / 75;
    camera.position.set(0, 0.12, z);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function ProductBlock({ frame, color }: { frame: number; color: string }) {
  const frameRef = useRef(frame);
  useLayoutEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  const meshRef = useRef<Mesh | null>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y = frameRef.current * 0.017;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[0.32, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.35, 1.45, 0.12]} />
      <meshStandardMaterial color={color} metalness={0.38} roughness={0.22} />
    </mesh>
  );
}

export function ProductOrbit3D({
  headline = "Your product",
  subheadline = "",
  primaryColor = "#3b82f6",
}: {
  headline?: string;
  subheadline?: string;
  primaryColor?: string;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 30%,#1e293b 0%,#020617 72%)" }}>
      <div
        style={{
          position: "absolute",
          top: "7%",
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: Math.min(50, width / 22),
            fontWeight: 900,
            letterSpacing: "-0.03em",
            textShadow: "0 10px 40px rgba(0,0,0,0.55)",
          }}
        >
          {headline.slice(0, 52)}
        </div>
        {subheadline ? (
          <div style={{ marginTop: 10, color: "#94a3b8", fontSize: Math.min(18, width / 52) }}>
            {subheadline.slice(0, 110)}
          </div>
        ) : null}
      </div>
      <ThreeCanvas width={width} height={height}>
        <color attach="background" args={["#020617"]} />
        <CameraRig frame={frame} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 6]} intensity={1.15} />
        <ProductBlock frame={frame} color={primaryColor} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
