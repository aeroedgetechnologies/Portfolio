import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere } from '@react-three/drei';
import { ArrowLeft } from 'lucide-react';
import * as THREE from 'three';

interface ThreeJSPlaygroundProps {
  onBack: () => void;
}

// Simple floating skill component
function FloatingSkill({ position, skill, color }: { 
  position: [number, number, number]; 
  skill: string; 
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
    }
  });

  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.3, 16, 16]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </Sphere>
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.1}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {skill}
      </Text>
    </group>
  );
}

// Main scene component
function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  // Govinda's skills
  const skills = [
    { skill: 'MERN', color: '#10b981' },
    { skill: 'Laravel', color: '#ef4444' },
    { skill: 'WordPress', color: '#3b82f6' },
    { skill: 'Node.js', color: '#10b981' },
    { skill: 'TypeScript', color: '#3b82f6' },
    { skill: 'MySQL', color: '#f59e0b' },
    { skill: 'MongoDB', color: '#10b981' },
    { skill: 'Shopify', color: '#8b5cf6' },
    { skill: 'Kajabi', color: '#ec4899' },
    { skill: 'React Native', color: '#06b6d4' },
    { skill: 'Java', color: '#f97316' },
    { skill: 'C/C++', color: '#6366f1' }
  ];

  return (
    <group ref={groupRef}>
      {/* Govinda's workspace */}
      <Box position={[0, -1, 0]} args={[3, 0.2, 2]}>
        <meshStandardMaterial color="#1f2937" />
      </Box>
      
      {/* Computer monitor */}
      <Box position={[0, 0.5, 0]} args={[1.5, 1, 0.1]}>
        <meshStandardMaterial color="#374151" />
      </Box>
      
      {/* Computer screen */}
      <Box position={[0, 0.5, 0.06]} args={[1.3, 0.8, 0.01]}>
        <meshStandardMaterial color="#000000" />
      </Box>
      
      {/* Keyboard */}
      <Box position={[0, -0.3, 0.8]} args={[1.2, 0.05, 0.4]}>
        <meshStandardMaterial color="#6b7280" />
      </Box>
      
      {/* Govinda's name - prominently displayed */}
      <Text
        position={[0, 2.5, 0]}
        fontSize={0.4}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        GOVINDA YADAV
      </Text>
      
      {/* Experience subtitle */}
      <Text
        position={[0, 2, 0]}
        fontSize={0.15}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        Full Stack Developer • 1+ Years Experience
      </Text>
      
      {/* Qualifications */}
      <Text
        position={[-2, 1.5, 0]}
        fontSize={0.12}
        color="#1e40af"
        anchorX="center"
        anchorY="middle"
      >
        BCA • MCA • PGDCA
      </Text>
      
      {/* Floating skill spheres */}
      {skills.map((skillData, index) => {
        const angle = (index / skills.length) * Math.PI * 2;
        const radius = 6;
        return (
          <FloatingSkill
            key={index}
            position={[
              Math.cos(angle) * radius,
              0.5 + Math.sin(angle * 2) * 0.5,
              Math.sin(angle) * radius
            ]}
            skill={skillData.skill}
            color={skillData.color}
          />
        );
      })}
      
      {/* Floating code symbols */}
      {['{', '}', '<', '>', '(', ')', '[', ']'].map((symbol, index) => (
        <Text
          key={index}
          position={[
            Math.cos(index * Math.PI / 4) * 10,
            3 + Math.sin(index * Math.PI / 4) * 2,
            Math.sin(index * Math.PI / 4) * 10
          ]}
          fontSize={0.3}
          color="#3b82f6"
          anchorX="center"
          anchorY="middle"
        >
          {symbol}
        </Text>
      ))}
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
    </group>
  );
}

export default function ThreeJSPlayground({ onBack }: ThreeJSPlaygroundProps) {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg text-white hover:bg-white/20 transition-all duration-300 border border-white/20"
      >
        <ArrowLeft size={20} />
        Back to Chat
      </button>
      
      {/* Title */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Govinda's 3D Portfolio</h1>
        <p className="text-white/70 text-sm">Full Stack Developer • MERN • Laravel • WordPress</p>
      </div>
      
      {/* 3D Canvas */}
      <div className="w-full h-full">
        <Canvas
          camera={{ position: [8, 5, 8], fov: 60 }}
          style={{ background: 'transparent' }}
        >
          <Scene />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxDistance={20}
            minDistance={3}
            autoRotate={true}
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>
      
      {/* Info overlay */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 max-w-xs">
        <h3 className="text-white font-semibold mb-2">Govinda's Skills Showcase</h3>
        <ul className="text-white/80 text-sm space-y-1">
          <li>• 12+ Technologies</li>
          <li>• 1+ Years Experience</li>
          <li>• Full Stack Expertise</li>
          <li>• Interactive 3D Scene</li>
        </ul>
        <div className="mt-3 text-xs text-white/60">
          <p>• Rotate: Click & drag</p>
          <p>• Zoom: Scroll wheel</p>
          <p>• Auto-rotating scene</p>
        </div>
      </div>
      
      {/* Skills counter */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">12+</div>
          <div className="text-white/80 text-sm">Technologies</div>
        </div>
      </div>
    </div>
  );
}
