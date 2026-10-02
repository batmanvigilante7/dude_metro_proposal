import { atom, useAtom } from "jotai";
import { useEffect, useRef, useState, useCallback } from "react";
import SpecularButton from "./SpecularButton";

// --- State ---
export const currentPageAtom = atom(0);
export const pageCountAtom = atom(9); // 9 interior sheets → 9×2 + 2 = 20 photo slots

// Pre-seed with the 20 downloaded images (page-01.webp … page-20.webp).
const PRELOADED_PHOTOS = Array.from(
  { length: 20 },
  (_, i) => `${import.meta.env.BASE_URL}images/page-${String(i + 1).padStart(2, "0")}.webp`
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

// --- Background Music Singleton (Guarantees exactly ONE audio element exists) ---
let bgmAudio = null;

function getBgmAudio() {
  if (typeof window === "undefined") return null;
  if (!bgmAudio) {
    if (window.__THE_METRO_PROPOSAL_AUDIO__) {
      bgmAudio = window.__THE_METRO_PROPOSAL_AUDIO__;
    } else {
      bgmAudio = new Audio(encodeURI(`${import.meta.env.BASE_URL}audios/The metro proposal (4).mp3`));
      bgmAudio.loop = true;
      bgmAudio.volume = 0.65;
      bgmAudio._userPaused = false;
      window.__THE_METRO_PROPOSAL_AUDIO__ = bgmAudio;
    }
  }
  return bgmAudio;
}

// Page flip sound reuse
let flipSoundAudio = null;

// --- UI Component ---
export const UI = () => {
  const [page, setPage] = useAtom(currentPageAtom);
  const [pageCount, setPageCount] = useAtom(pageCountAtom);
  const [photos, setPhotos] = useAtom(photosAtom);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const fileInputRef = useRef();
  const isFirstPageRender = useRef(true);
  const activePillRef = useRef(null);
  const touchStartRef = useRef(null);

  const pages = buildPages(pageCount, photos);
  const totalSlots = pageCount * 2 + 2;

  // Background music: Single instance, plays by default, cleanly pauses and resumes
  useEffect(() => {
    const audio = getBgmAudio();
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    // Initial sync
    setIsPlaying(!audio.paused);

    // Play by default on load
    if (audio.paused && !audio._userPaused) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // If browser blocks unprompted autoplay without user gesture,
            // unlock on the first user interaction anywhere on the screen
            const onFirstInteraction = () => {
              if (audio.paused && !audio._userPaused) {
                audio.play().catch(() => {});
              }
              cleanupUnlock();
            };
            const cleanupUnlock = () => {
              window.removeEventListener("pointerdown", onFirstInteraction);
              window.removeEventListener("keydown", onFirstInteraction);
              window.removeEventListener("touchstart", onFirstInteraction);
              window.removeEventListener("click", onFirstInteraction);
            };
            audio._cleanupUnlock = cleanupUnlock;
            window.addEventListener("pointerdown", onFirstInteraction, { once: true });
            window.addEventListener("keydown", onFirstInteraction, { once: true });
            window.addEventListener("touchstart", onFirstInteraction, { once: true });
            window.addEventListener("click", onFirstInteraction, { once: true });
          });
      }
    }

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const toggleAudio = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const audio = getBgmAudio();
    if (!audio) return;

    if (!audio.paused) {
      // User clicked pause: stop the music
      audio._userPaused = true;
      if (audio._cleanupUnlock) {
        audio._cleanupUnlock();
      }
      audio.pause();
    } else {
      // User clicked resume: play the single music file
      audio._userPaused = false;
      audio.play().catch((err) => console.warn("Playback resume failed:", err));
    }
  };

  // Sound effect on manual page flip (skipping initial mount)
  useEffect(() => {
    if (isFirstPageRender.current) {
      isFirstPageRender.current = false;
      return;
    }
    try {
      if (!flipSoundAudio) {
        flipSoundAudio = new Audio(`${import.meta.env.BASE_URL}audios/page-flip-01a.mp3`);
        flipSoundAudio.volume = 0.45;
      }
      flipSoundAudio.currentTime = 0;
      flipSoundAudio.play().catch(() => {});
    } catch {}
  }, [page]);

  // Clamp current page when page count shrinks
  useEffect(() => {
    if (page > pages.length) {
      setPage(pages.length);
    }
  }, [pageCount, pages.length, page, setPage]);

  // Auto-scroll active pill into view on mobile
  useEffect(() => {
    if (activePillRef.current) {
      activePillRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [page]);

  // Keyboard navigation (Arrow keys for Android remotes/keyboards)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") {
        setPage((p) => Math.min(pages.length, p + 1));
      } else if (e.key === "ArrowLeft") {
        setPage((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pages.length, setPage]);

  // Touch swipe gesture handling for mobile / Android
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e) => {
      if (!touchStartRef.current) return;
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Quick horizontal swipe with minimal vertical movement
      if (deltaTime < 400 && Math.abs(deltaX) > 40 && Math.abs(deltaY) < 55) {
        if (deltaX < 0) {
          // Swipe Left -> Next page
          setPage((p) => Math.min(pages.length, p + 1));
        } else {
          // Swipe Right -> Previous page
          setPage((p) => Math.max(0, p - 1));
        }
      }
      touchStartRef.current = null;
    },
    [pages.length, setPage]
  );

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

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
      {/* ── Top Header Navigation Bar (Safe-Area Aware) ── */}
      <header
        className="fixed top-0 left-0 right-0 z-30 pointer-events-none select-none flex justify-between items-start gap-2 p-3 sm:p-6"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        {/* Audio Button */}
        <div className="pointer-events-auto">
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
            className="shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200"
            title={isPlaying ? "Pause music" : "Resume music"}
            aria-label={isPlaying ? "Pause music" : "Resume music"}
          >
            <div className="flex items-center gap-2">
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
              <span className="font-medium text-xs sm:text-sm tracking-tight text-white/95 hidden xs:inline sm:inline">
                {isPlaying ? "Pause Music" : "Resume Music"}
              </span>
              <span className="font-medium text-xs tracking-tight text-white/95 xs:hidden sm:hidden">
                {isPlaying ? "Pause" : "Resume"}
              </span>
            </div>
          </SpecularButton>
        </div>

        {/* ── Desktop Controls: Apple Glassmorphic Stacked Cards ── */}
        <div className="pointer-events-auto hidden sm:flex flex-col gap-2.5 w-44 sm:w-52">
          {/* Page Stepper Card */}
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

        {/* ── Mobile Controls: Compact Sleek Capsule Bar ── */}
        <div className="pointer-events-auto flex sm:hidden items-center gap-1.5">
          {/* Compact Stepper Pill */}
          <div className="apple-glass-dark rounded-full px-2.5 py-1.5 flex items-center gap-1.5 shadow-xl border border-white/20">
            <button
              className="w-5 h-5 rounded-full apple-glass border border-white/20 text-white font-semibold text-xs flex items-center justify-center active:scale-90"
              onClick={() => setPageCount((c) => Math.max(1, c - 1))}
              title="Decrease pages"
            >
              −
            </button>
            <span className="text-white text-xs font-semibold px-1 text-center">
              {pageCount}p
            </span>
            <button
              className="w-5 h-5 rounded-full apple-glass border border-white/20 text-white font-semibold text-xs flex items-center justify-center active:scale-90"
              onClick={() => setPageCount((c) => Math.min(20, c + 1))}
              title="Increase pages"
            >
              +
            </button>
          </div>

          {/* Compact Upload Button */}
          <button
            className="apple-glass-dark apple-glass-interactive rounded-full w-8 h-8 flex items-center justify-center shadow-xl border border-white/20 text-white/90 active:scale-90"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Photos"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* Mobile Slots Badge / Clear Menu Toggle */}
          {photos.length > 0 && (
            <div className="relative">
              <button
                className="apple-glass-dark rounded-full px-2 py-1.5 text-[11px] font-medium text-white/80 border border-white/20 shadow-xl active:scale-90"
                onClick={() => setShowMobileMenu((v) => !v)}
              >
                {photos.length}📷
              </button>

              {showMobileMenu && (
                <div className="absolute right-0 top-10 apple-glass-dark rounded-xl p-2 shadow-2xl border border-white/20 flex flex-col gap-1.5 min-w-[120px] backdrop-blur-3xl animate-in fade-in zoom-in-95">
                  <span className="text-white/60 text-[10px] font-medium text-center">
                    {Math.min(photos.length, totalSlots)}/{totalSlots} slots
                  </span>
                  <button
                    className="text-red-300 hover:text-red-200 text-xs font-semibold py-1 px-2 rounded-lg bg-red-500/15 active:scale-95"
                    onClick={() => {
                      handleClear();
                      setShowMobileMenu(false);
                    }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleUpload}
        />
      </header>

      {/* ── Mobile One-Thumb Floating Side Chevrons ── */}
      <button
        aria-label="Previous Page"
        disabled={page === 0}
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        className={`pointer-events-auto select-none fixed left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full apple-glass-dark flex items-center justify-center text-white/80 border border-white/20 shadow-2xl backdrop-blur-xl transition-all duration-200 active:scale-90 ${
          page === 0
            ? "opacity-20 cursor-not-allowed pointer-events-none"
            : "hover:bg-white/20 hover:text-white"
        }`}
        style={{
          left: "max(0.5rem, env(safe-area-inset-left))",
        }}
      >
        <svg
          className="w-5 h-5 -ml-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        aria-label="Next Page"
        disabled={page === pages.length}
        onClick={() => setPage((p) => Math.min(pages.length, p + 1))}
        className={`pointer-events-auto select-none fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full apple-glass-dark flex items-center justify-center text-white/80 border border-white/20 shadow-2xl backdrop-blur-xl transition-all duration-200 active:scale-90 ${
          page === pages.length
            ? "opacity-20 cursor-not-allowed pointer-events-none"
            : "hover:bg-white/20 hover:text-white"
        }`}
        style={{
          right: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <svg
          className="w-5 h-5 -mr-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* ── Bottom: Apple VisionOS Floating Glass Navigation Dock ── */}
      <main
        className="pointer-events-none select-none z-20 fixed inset-0 flex justify-end flex-col pb-4 sm:pb-8"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <div className="w-full pointer-events-auto flex justify-center px-2 sm:px-4">
          <div className="apple-glass-dark rounded-full p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 max-w-full overflow-x-auto no-scrollbar shadow-2xl border border-white/20 backdrop-blur-2xl">
            {pages.map((_, index) => {
              const isActive = index === page;
              return (
                <button
                  key={index}
                  ref={isActive ? activePillRef : null}
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
              ref={page === pages.length ? activePillRef : null}
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
