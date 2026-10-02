import { Environment, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Book } from "./Book";

function ResponsiveCameraController({ isMobile }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 1) {
      // ── Mobile Portrait Mode ──────────────────────────────────
      // Center camera X to 0 so the open book is centered horizontally on narrow screens
      const targetVisibleWidth = 3.3; // 2.56-unit book width + padding
      const vFovRad = (camera.fov * Math.PI) / 180;
      const requiredZ = targetVisibleWidth / (2 * Math.tan(vFovRad / 2) * aspect);
      const safeZ = Math.max(6.8, Math.min(requiredZ, 12));

      camera.position.set(0, 1.2, safeZ);
      camera.lookAt(0, -0.1, 0);
    } else {
      // ── Landscape / Tablet / Desktop Mode ────────────────────
      const targetZ = aspect < 1.4 ? 4.8 : 4.0;
      camera.position.set(-0.3, 1.0, targetZ);
      camera.lookAt(0, 0, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, isMobile]);

  return null;
}

export const Experience = ({ isMobile }) => {
  return (
    <>
      <ResponsiveCameraController isMobile={isMobile} />

      {/* Custom 3D Book with skinned-mesh page bending */}
      <group rotation-x={-Math.PI / 4} scale={1.71}>
        <Book />
      </group>

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.08}
        rotateSpeed={isMobile ? 0.6 : 0.8}
        minDistance={isMobile ? 3.5 : 2}
        maxDistance={isMobile ? 15 : 10}
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
      {/* Realistic contact shadow receiver that blends with background */}
      <mesh position-y={-1.5} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <shadowMaterial transparent opacity={0.25} />
      </mesh>
    </>
  );
};
