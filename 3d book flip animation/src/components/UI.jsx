import { atom, useAtom } from "jotai";
import { useEffect, useRef } from "react";

// --- State ---
export const currentPageAtom = atom(0);
export const pageCountAtom = atom(5); // number of interior sheets
export const photosAtom = atom([]); // array of blob URLs

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
  const fileInputRef = useRef();

  const pages = buildPages(pageCount, photos);
  const totalSlots = pageCount * 2 + 2;

  useEffect(() => {
    const audio = new Audio("/audios/page-flip-01a.mp3");
    audio.play();
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
      {/* ── Control Panel ── */}
      <div className="pointer-events-auto select-none z-20 fixed top-3 right-3 sm:top-5 sm:right-5 flex flex-col gap-2 w-44 sm:w-52">
        {/* Page count */}
        <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center justify-between">
          <span className="text-white text-xs sm:text-sm font-medium">
            Pages
          </span>
          <div className="flex items-center gap-2">
            <button
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/20 hover:bg-white/40 text-white text-sm font-bold flex items-center justify-center transition"
              onClick={() => setPageCount((c) => Math.max(1, c - 1))}
            >
              −
            </button>
            <span className="text-white text-sm sm:text-base font-bold w-5 text-center">
              {pageCount}
            </span>
            <button
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/20 hover:bg-white/40 text-white text-sm font-bold flex items-center justify-center transition"
              onClick={() => setPageCount((c) => Math.min(15, c + 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* Upload button */}
        <button
          className="bg-indigo-600/80 hover:bg-indigo-500 backdrop-blur-md rounded-xl px-3 py-2 text-white text-xs sm:text-sm font-medium transition flex items-center justify-center gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          📷 Upload Photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleUpload}
        />

        {/* Photo count & clear */}
        {photos.length > 0 && (
          <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-white/70 text-xs">
              {Math.min(photos.length, totalSlots)}/{totalSlots} slots
            </span>
            <button
              className="text-red-400 hover:text-red-300 text-xs font-medium transition"
              onClick={handleClear}
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ── Page Navigation ── */}
      <main className="pointer-events-none select-none z-10 fixed inset-0 flex justify-end flex-col">
        <div className="w-full overflow-auto pointer-events-auto flex justify-center">
          <div className="overflow-auto flex items-center gap-2 sm:gap-4 max-w-full p-4 sm:p-10">
            {pages.map((_, index) => (
              <button
                key={index}
                className={`border-transparent hover:border-white transition-all duration-300 px-2.5 py-1.5 sm:px-4 sm:py-3 rounded-full text-xs sm:text-lg uppercase shrink-0 border ${
                  index === page
                    ? "bg-white/90 text-black"
                    : "bg-black/30 text-white"
                }`}
                onClick={() => setPage(index)}
              >
                {index === 0 ? "Cover" : `Page ${index}`}
              </button>
            ))}
            <button
              className={`border-transparent hover:border-white transition-all duration-300 px-2.5 py-1.5 sm:px-4 sm:py-3 rounded-full text-xs sm:text-lg uppercase shrink-0 border ${
                page === pages.length
                  ? "bg-white/90 text-black"
                  : "bg-black/30 text-white"
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
