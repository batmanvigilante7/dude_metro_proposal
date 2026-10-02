import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { Experience } from "./components/Experience";
import { UI, photosAtom } from "./components/UI";
import DriftWall from "./components/DriftWall";

// Original photos used inside the book (page-01.webp … page-20.webp)
const ORIGINAL_BOOK_PHOTOS = Array.from(
  { length: 20 },
  (_, i) => `${import.meta.env.BASE_URL}images/page-${String(i + 1).padStart(2, "0")}.webp`
);

function App() {
  const [photos] = useAtom(photosAtom);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" &&
      (window.innerWidth <= 800 || window.innerHeight > window.innerWidth)
  );

  const handleResize = useCallback(() => {
    setIsMobile(
      window.innerWidth <= 800 || window.innerHeight > window.innerWidth
    );
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [handleResize]);

  const activePhotos = useMemo(
    () => (photos && photos.length > 0 ? photos : ORIGINAL_BOOK_PHOTOS),
    [photos]
  );

  const driftItems = useMemo(
    () => activePhotos.map((src, i) => ({ image: src, title: `Page ${i + 1}` })),
    [activePhotos]
  );

  return (
    <div className="flipbook-container w-full h-full relative overflow-hidden">
      {/* ── DriftWall Background Layer ─────────────────────────────
           pointer-events: none ensures hovering and touch interactions
           never interrupt movement or steal touch events from the 3D book. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <DriftWall
          items={driftItems}
          columns={isMobile ? 3 : 5}
          tileWidth={isMobile ? 105 : 155}
          tileHeight={isMobile ? 140 : 205}
          gap={isMobile ? 10 : 18}
          radius={12}
          tilt={12}
          turn={-10}
          perspective={1400}
          depth={90}
          speed={22}
          direction="up"
          variance={0.4}
          parallax={0}
          pauseOnHover={false}
          lift={0}
          fade={0.25}
          dim={0.52}
          grayscale={false}
          overlayColor="transparent"
        />
      </div>

      {/* ── UI Controls ── */}
      <UI />
      <Loader />

      {/* ── 3D Canvas (Optimized for Android / Mobile GPUs) ── */}
      <Canvas
        shadows
        className="flipbook-container"
        style={{ position: "relative", zIndex: 1, touchAction: "none" }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, isMobile ? 1.75 : 2]}
        camera={{
          position: isMobile ? [0, 1.2, 7.5] : [-0.5, 1, 4],
          fov: isMobile ? 50 : 45,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <group position-y={isMobile ? -0.15 : 0}>
          <Suspense fallback={null}>
            <Experience isMobile={isMobile} />
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}

export default App;
