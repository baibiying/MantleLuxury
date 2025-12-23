"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

// 3D模型加载组件
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Group>(null);

  // 自动旋转（可选）
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2; // 慢速旋转
    }
  });

  return (
    <primitive 
      ref={meshRef} 
      object={scene} 
      scale={1} 
      position={[0, 0, 0]}
    />
  );
}

// 加载占位符
function LoadingPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#3b82f6" wireframe />
    </mesh>
  );
}

// 主组件
export default function Model3DViewer({ 
  modelUrl, 
  autoRotate = true,
  className = ""
}: { 
  modelUrl: string;
  autoRotate?: boolean;
  className?: string;
}) {
  const fullUrl = modelUrl.startsWith("http") 
    ? modelUrl 
    : `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}${modelUrl}`;

  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        className="bg-gradient-to-b from-slate-900 to-slate-950"
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoadingPlaceholder />}>
          {/* 环境光 */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />
          
          {/* 环境贴图（可选，提供更好的反射效果） */}
          <Environment preset="city" />
          
          {/* 3D模型 */}
          <Model url={fullUrl} />
          
          {/* 相机控制 */}
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={10}
            autoRotate={autoRotate}
            autoRotateSpeed={1}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

// 预加载模型（可选，用于优化）
// 注意：需要在组件内部调用 useGLTF.preload

