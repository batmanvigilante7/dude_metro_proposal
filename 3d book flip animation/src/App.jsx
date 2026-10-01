import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState, useCallback } from "react";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 800);

  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth <= 800);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  return (
    <div className="flipbook-container w-full h-full relative">
      <UI />
      <Loader />
      <Canvas
        shadows
        className="flipbook-container"
        gl={{ alpha: true, antialias: true }}
        camera={{
          position: isMobile ? [-0.5, 1.5, 7] : [-0.5, 1, 4],
          fov: isMobile ? 50 : 45,
        }}
      >
        <group position-y={isMobile ? -0.2 : 0}>
          <Suspense fallback={null}>
            <Experience isMobile={isMobile} />
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}

export default App;
