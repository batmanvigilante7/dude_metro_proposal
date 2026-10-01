import { Environment, OrbitControls } from "@react-three/drei";
import { Book } from "./Book";

export const Experience = ({ isMobile }) => {
  return (
    <>
      {/* Stable book orientation without unnecessary mid-air floating */}
      <group rotation-x={-Math.PI / 4}>
        <Book />
      </group>
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.06}
        rotateSpeed={0.8}
        minDistance={isMobile ? 4 : 2}
        maxDistance={isMobile ? 12 : 10}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
      <Environment preset="studio" />
      <directionalLight
        position={[2, 5, 2]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={isMobile ? 1024 : 2048}
        shadow-mapSize-height={isMobile ? 1024 : 2048}
        shadow-bias={-0.0001}
      />
      {/* Realistic contact shadow receiver that blends with any custom cinematic background */}
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.25} />
      </mesh>
    </>
  );
};

