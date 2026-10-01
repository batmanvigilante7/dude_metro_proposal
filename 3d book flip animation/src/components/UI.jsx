import { atom, useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import SpecularButton from "./SpecularButton";

// --- State ---
export const currentPageAtom = atom(0);
export const pageCountAtom = atom(9); // 9 interior sheets → 9×2 + 2 = 20 photo slots

// Pre-seed with the 20 downloaded images (page-01.webp … page-20.webp).
// These live in /public/images/ and are served as static assets.
const PRELOADED_PHOTOS = Array.from(
  { length: 20 },
  (_, i) => `/images/page-${String(i + 1).padStart(2, "0")}.webp`
);
export const photosAtom = atom(PRELOADED_PHOTOS);

// Build the sheets array from interior count + uploaded photos
export function buildPages(interiorCount, photos) {
  const pages = [];
  let photoIdx = 0;

  // Front cover sheet
  pages.push({
    front: null, // cover exterior — solid color
    back: photos[photoIdx++] || null,
  });

  // Interior sheets
  for (let i = 0; i < interiorCount; i++) {
    pages.push({
      front: photos[photoIdx++] || null,
      back: photos[photoIdx++] || null,
    });
  }

  // Back cover sheet
  pages.push({
    front: photos[photoIdx++] || null,
    back: null, // cover exterior — solid color
  });

  return pages;
}

// --- UI Component ---
export const UI = () => {
  const [page, setPage] = useAtom(currentPageAtom);
  const [pageCount, setPageCount] = useAtom(pageCountAtom);
  const [photos, setPhotos] = useAtom(photosAtom);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef();
  const audioRef = useRef(null);
  const isFirstPageRender = useRef(true);

  const pages = buildPages(pageCount, photos);
  const totalSlots = pageCount * 2 + 2;

  // Background music initialization & persistent playback
  useEffect(() => {
    const audio = new Audio("/audios/The metro proposal (4).mp3");
    audio.loop = true;
    audio.volume = 0.7;
    audioRef.current = audio;

    const tryPlay = () => {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // If browser autoplay policies require user engagement,
            // unlock audio seamlessly on any first user gesture across the window
            const unlock = () => {
              audio
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
              window.removeEventListener("pointerdown", unlock);
              window.removeEventListener("keydown", unlock);
              window.removeEventListener("touchstart", unlock);
            };
            window.addEventListener("pointerdown", unlock, { once: true });
            window.addEventListener("keydown", unlock, { once: true });
            window.addEventListener("touchstart", unlock, { once: true });
          });
      }
    };

    tryPlay();

    return () => {
      audio.pause();
    };
  }, []);

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  // Sound effect on manual page flip (skipping initial mount)
  useEffect(() => {
    if (isFirstPageRender.current) {
      isFirstPageRender.current = false;
      return;
    }
    const flipSound = new Audio("/audios/page-flip-01a.mp3");
    flipSound.volume = 0.5;
    flipSound.play().catch(() => {});
  }, [page]);

  // Clamp current page when page count shrinks
  useEffect(() => {
    if (page > pages.length) {
      setPage(pages.length);
    }
  }, [pageCount]);

  const handleUpload = (e) => {
    const files = Array.from(e.target.files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPhotos((prev) => [...prev, ...urls]);
    e.target.value = "";
  };

  const handleClear = () => {
    photos.forEach((url) => URL.revokeObjectURL(url));
    setPhotos([]);
  };

  return (
    <>
      {/* ── Top Left: Specular Audio Button (Apple Music Aesthetic) ── */}
      <div className="pointer-events-auto select-none z-30 fixed top-4 left-4 sm:top-6 sm:left-6">
        <SpecularButton
          size="md"
          radius={22}
          tint="#ffffff"
          tintOpacity={0.12}
          blur={24}
          textColor="#ffffff"
          lineColor="#ffffff"
          baseColor="#333333"
          intensity={1.25}
          shineSize={12}
          shineFade={45}
          thickness={1.2}
          speed={0.35}
          followMouse={true}
          proximity={280}
          autoAnimate={isPlaying}
          onClick={toggleAudio}
          className="shadow-2xl hover:scale-105 transition-transform duration-200"
        >
          <div className="flex items-center gap-2.5">
            {/* Audio Wave / Play-Pause Icon */}
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 border border-white/20">
              {isPlaying ? (
                <div className="flex items-end justify-center gap-0.5 h-3 w-3">
                  <span className="w-0.5 bg-white rounded-full h-2 animate-pulse" />
                  <span className="w-0.5 bg-white rounded-full h-3 animate-bounce" />
                  <span className="w-0.5 bg-white rounded-full h-1.5 animate-pulse" />
                </div>
              ) : (
                <svg
                  className="w-2.5 h-2.5 text-white fill-current ml-0.5"
                  viewBox="0 0 24 24"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </div>
            <span className="font-medium text-xs sm:text-sm tracking-tight text-white/95">
              The Metro proposal
            </span>
          </div>
        </SpecularButton>
      </div>

      {/* ── Top Right: Apple Glassmorphic Control Panel ── */}
      <div className="pointer-events-auto select-none z-20 fixed top-4 right-4 sm:top-6 sm:right-6 flex flex-col gap-2.5 w-44 sm:w-52">
        {/* Page Count Stepper Card */}
        <div className="apple-glass-dark rounded-2xl px-3.5 py-2.5 flex items-center justify-between shadow-xl">
          <span className="text-white/80 text-xs sm:text-sm font-medium tracking-tight">
            Pages
          </span>
          <div className="flex items-center gap-2">
            <button
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full apple-glass border border-white/20 text-white font-semibold text-xs sm:text-sm flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
              onClick={() => setPageCount((c) => Math.max(1, c - 1))}
              title="Decrease pages"
            >
              −
            </button>
            <span className="text-white text-xs sm:text-sm font-semibold w-5 text-center">
              {pageCount}
            </span>
            <button
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full apple-glass border border-white/20 text-white font-semibold text-xs sm:text-sm flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
              onClick={() => setPageCount((c) => Math.min(20, c + 1))}
              title="Increase pages"
            >
              +
            </button>
          </div>
        </div>

        {/* Upload Photos Glass Button */}
        <button
          className="apple-glass-dark apple-glass-interactive rounded-2xl px-3.5 py-2.5 text-white/90 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-xl border border-white/20"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg
            className="w-4 h-4 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>Upload Photos</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleUpload}
        />

        {/* Photo Slots Count & Clear All */}
        {photos.length > 0 && (
          <div className="apple-glass-dark rounded-2xl px-3.5 py-2 flex items-center justify-between text-xs shadow-xl border border-white/15">
            <span className="text-white/60 font-medium">
              {Math.min(photos.length, totalSlots)}/{totalSlots} slots
            </span>
            <button
              className="text-red-300 hover:text-red-200 font-medium px-2 py-0.5 rounded-full hover:bg-red-500/10 transition-colors"
              onClick={handleClear}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom: Apple VisionOS Floating Glass Navigation Dock ── */}
      <main className="pointer-events-none select-none z-20 fixed inset-0 flex justify-end flex-col pb-5 sm:pb-8">
        <div className="w-full pointer-events-auto flex justify-center px-4">
          <div className="apple-glass-dark rounded-full p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 max-w-full overflow-x-auto shadow-2xl border border-white/20 backdrop-blur-2xl">
            {pages.map((_, index) => {
              const isActive = index === page;
              return (
                <button
                  key={index}
                  className={`apple-glass-pill px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium tracking-tight whitespace-nowrap transition-all duration-200 border ${
                    isActive
                      ? "bg-white text-black border-white shadow-lg shadow-white/25 scale-[1.03]"
                      : "bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border-white/10 hover:border-white/25"
                  }`}
                  onClick={() => setPage(index)}
                >
                  {index === 0 ? "Cover" : `Page ${index}`}
                </button>
              );
            })}
            <button
              className={`apple-glass-pill px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium tracking-tight whitespace-nowrap transition-all duration-200 border ${
                page === pages.length
                  ? "bg-white text-black border-white shadow-lg shadow-white/25 scale-[1.03]"
                  : "bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border-white/10 hover:border-white/25"
              }`}
              onClick={() => setPage(pages.length)}
            >
              Back Cover
            </button>
          </div>
        </div>
      </main>
    </>
  );
};
