import { SRGBColorSpace, Texture, LinearFilter, LinearMipmapLinearFilter, ClampToEdgeWrapping } from "three";

// ── WebP Asynchronous Image Decoder ──────────────────────────────
// Uses decoding="async" to decompress images off the main thread.
const imagePromiseCache = new Map();

export function loadAsyncImage(url) {
  if (!url) return Promise.resolve(null);
  if (imagePromiseCache.has(url)) {
    return imagePromiseCache.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.loading = "eager";

    img.onload = () => {
      if ("decode" in img) {
        img
          .decode()
          .then(() => resolve(img))
          .catch(() => resolve(img)); // Fallback if decode errors
      } else {
        resolve(img);
      }
    };

    img.onerror = (err) => {
      imagePromiseCache.delete(url);
      reject(err);
    };

    img.src = url;
  });

  imagePromiseCache.set(url, promise);
  return promise;
}

// ── Three.js Texture Cache & Cover-Fit ───────────────────────────
const textureCache = new Map();

export async function getWebPTexture(url, pageWidth, pageHeight) {
  if (!url) return null;

  if (textureCache.has(url)) {
    return textureCache.get(url);
  }

  try {
    const img = await loadAsyncImage(url);
    if (!img) return null;

    const texture = new Texture(img);
    texture.colorSpace = SRGBColorSpace;

    // Cover-fit logic: preserve aspect ratio and center crop
    const imgAspect = img.width / img.height;
    const pageAspect = pageWidth / pageHeight;

    if (imgAspect > pageAspect) {
      const rx = pageAspect / imgAspect;
      texture.repeat.set(rx, 1);
      texture.offset.set((1 - rx) / 2, 0);
    } else {
      const ry = imgAspect / pageAspect;
      texture.repeat.set(1, ry);
      texture.offset.set(0, (1 - ry) / 2);
    }

    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;

    textureCache.set(url, texture);
    return texture;
  } catch (error) {
    console.warn(`Failed to load texture for ${url}:`, error);
    return null;
  }
}

// ── Cache Eviction / Cleanup ─────────────────────────────────────
// Keep textures in the active cache window, dispose stale ones
export function pruneTextureCache(allowedUrls) {
  const allowedSet = new Set(allowedUrls.filter(Boolean));

  for (const [url, texture] of textureCache.entries()) {
    if (!allowedSet.has(url)) {
      try {
        texture.dispose();
      } catch (e) {
        // ignore
      }
      textureCache.delete(url);
      imagePromiseCache.delete(url);
    }
  }
}

// ── Native Browser Prefetch ──────────────────────────────────────
// Dynamically manages <link rel="prefetch"> in <head> for adjacent assets
export function updateNativePrefetch(urls) {
  if (typeof document === "undefined") return;

  const validUrls = urls.filter(Boolean);
  const targetSet = new Set(validUrls);

  // Clean up old prefetch links created by this manager
  const existingLinks = document.querySelectorAll(
    'link[rel="prefetch"][data-reader-prefetch="true"]'
  );
  existingLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!targetSet.has(href)) {
      link.remove();
    }
  });

  const remainingHrefs = new Set(
    Array.from(
      document.querySelectorAll(
        'link[rel="prefetch"][data-reader-prefetch="true"]'
      )
    ).map((l) => l.getAttribute("href"))
  );

  validUrls.forEach((url) => {
    if (!remainingHrefs.has(url)) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = url;
      link.setAttribute("data-reader-prefetch", "true");
      document.head.appendChild(link);
    }
  });
}
