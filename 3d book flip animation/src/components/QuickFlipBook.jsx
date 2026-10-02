import { useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { FlipBook } from "quick_flipbook";
import { useEffect, useMemo, useRef, useState } from "react";
import { currentPageAtom, pageCountAtom, photosAtom, buildPages } from "./UI";

export function QuickFlipBook({
  flipDuration = 0.6,
  pageSubdivisions = 25,
  pageRatio = 0.75, // width / height
  ...props
}) {
  const [page, setPage] = useAtom(currentPageAtom);
  const [pageCount] = useAtom(pageCountAtom);
  const [photos] = useAtom(photosAtom);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const bookRef = useRef();

  // Create the FlipBook instance
  const book = useMemo(() => {
    const b = new FlipBook({
      flipDuration,
      pageSubdivisions,
    });
    b.scale.x = pageRatio;
    return b;
  }, [flipDuration, pageSubdivisions, pageRatio]);

  // Build the flat array of page textures from Jotai state
  const flatPages = useMemo(() => {
    const sheets = buildPages(pageCount, photos);
    const result = [];

    sheets.forEach((sheet, index) => {
      const isFirst = index === 0;
      const isLast = index === sheets.length - 1;

      // Front face
      if (isFirst) {
        result.push(sheet.front || "/textures/book-cover.jpg");
      } else {
        result.push(sheet.front || "");
      }

      // Back face
      if (isLast) {
        result.push(sheet.back || "/textures/book-back.jpg");
      } else {
        result.push(sheet.back || "");
      }
    });

    return result;
  }, [pageCount, photos]);

  // Load pages into FlipBook
  useEffect(() => {
    if (book && flatPages.length > 0) {
      book.setPages(flatPages);
      // Sync to current page state immediately
      book.currentPage = page * 2;
    }
  }, [book, flatPages]);

  // Sync UI page state changes (from navigation buttons, keyboard, swipes, pills)
  useEffect(() => {
    if (book) {
      const targetPage = page * 2;
      if (book.currentPage !== targetPage) {
        book.currentPage = targetPage;
      }
    }
  }, [book, page]);

  // Drive the flip physics & animation in R3F render loop
  useFrame((_, delta) => {
    if (book) {
      book.animate(delta);
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (book) {
        book.dispose();
      }
    };
  }, [book]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!book) return;

    // Traverse upwards to find which Page mesh was clicked
    let target = e.object;
    while (target && !book.pages.includes(target)) {
      target = target.parent;
    }

    if (target) {
      book.flipPage(target);
      // Synchronize back to Jotai currentPageAtom so UI buttons & sound effect trigger
      const newPage = Math.round(book.currentPage / 2);
      setPage(newPage);
    }
  };

  return (
    <primitive
      ref={bookRef}
      object={book}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      {...props}
    />
  );
}

export default QuickFlipBook;
