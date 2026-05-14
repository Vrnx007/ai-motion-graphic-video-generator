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
    const cycle = f % 120;
    const z = cycle <= 60 ? 5.4 - (2.4 * cycle) / 60 : 3.0 + (2.4 * (cycle - 60)) / 60;
    const sway = Math.sin(f * 0.012) * 0.08;
    camera.position.set(sway, 0.1 + Math.sin(f * 0.018) * 0.05, z);
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
  const ringRef = useRef<Mesh | null>(null);
  useFrame(() => {
    const fr = frameRef.current;
    if (meshRef.current) {
      meshRef.current.rotation.y = fr * 0.019;
      meshRef.current.rotation.x = 0.28 + Math.sin(fr * 0.04) * 0.06;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = fr * 0.011;
      ringRef.current.rotation.x = Math.PI / 2.25;
    }
  });
  return (
    <group>
      <mesh ref={meshRef} rotation={[0.32, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.35, 1.45, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.42} roughness={0.2} />
      </mesh>
      <mesh ref={ringRef} position={[0, -0.05, 0]} castShadow>
        <torusGeometry args={[1.55, 0.04, 12, 80]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    </group>
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
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 6]} intensity={1.2} />
        <pointLight position={[-4, 2, 4]} intensity={0.85 + Math.sin(frame * 0.08) * 0.25} color={primaryColor} />
        <ProductBlock frame={frame} color={primaryColor} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
