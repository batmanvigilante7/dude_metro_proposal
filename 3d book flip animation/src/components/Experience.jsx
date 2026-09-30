import { Environment, Float, OrbitControls } from "@react-three/drei";
import { Book } from "./Book";

export const Experience = ({ isMobile }) => {
  return (
    <>
      <Float
        rotation-x={-Math.PI / 4}
        floatIntensity={isMobile ? 0.3 : 1}
        speed={isMobile ? 1 : 2}
        rotationIntensity={isMobile ? 0.5 : 2}
      >
        <Book />
      </Float>
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={isMobile ? 4 : 2}
        maxDistance={isMobile ? 12 : 10}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
      <Environment preset="studio"></Environment>
      <directionalLight
        position={[2, 5, 2]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={isMobile ? 1024 : 2048}
        shadow-mapSize-height={isMobile ? 1024 : 2048}
        shadow-bias={-0.0001}
      />
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.2} />
      </mesh>
    </>
  );
};
