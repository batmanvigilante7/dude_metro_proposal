import { useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  FrontSide,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { currentPageAtom, pageCountAtom, photosAtom, buildPages } from "./UI";
import {
  getWebPTexture,
  updateNativePrefetch,
} from "../utils/textureManager";

// ── Constants ──────────────────────────────────────────────
const easingFactor = 0.5;
const easingFactorFold = 0.3;
const insideCurveStrength = 0.18;
const outsideCurveStrength = 0.05;
const turningCurveStrength = 0.09;

const PAGE_WIDTH = 1.28;
const PAGE_HEIGHT = 1.71;
const PAGE_DEPTH = 0.003;
const COVER_DEPTH = 0.02;
const PAGE_SEGMENTS = 30;
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS;

// ── Geometry helper ────────────────────────────────────────
function createBookGeometry(depth, zOffset = 0) {
  const geometry = new BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    depth,
    PAGE_SEGMENTS,
    2
  );
  // Center along X at spine, and align Z so interior face matches page surface
  geometry.translate(PAGE_WIDTH / 2, 0, zOffset);

  // ── Skin weights ───────────────────────────────────────
  const position = geometry.attributes.position;
  const vertex = new Vector3();
  const skinIndexes = [];
  const skinWeights = [];

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;
    const skinIndex = Math.min(
      PAGE_SEGMENTS - 1,
      Math.max(0, Math.floor(x / SEGMENT_WIDTH))
    );
    let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
    if (x >= PAGE_WIDTH) skinWeight = 1.0;
    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0);
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0);
  }

  geometry.setAttribute(
    "skinIndex",
    new Uint16BufferAttribute(skinIndexes, 4)
  );
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(skinWeights, 4)
  );
  return geometry;
}

// ── Geometries with shared interior deformation plane ─────
// Interior surfaces (back face of front cover, and front face of back cover)
// are locked to the exact same Z coordinates as the interior page paper surfaces.
// Extra cover depth (+17mm) expands purely on the outside of the book.
const pageGeometry = createBookGeometry(PAGE_DEPTH, 0);
const frontCoverGeometry = createBookGeometry(
  COVER_DEPTH,
  (COVER_DEPTH - PAGE_DEPTH) / 2
);
const backCoverGeometry = createBookGeometry(
  COVER_DEPTH,
  -(COVER_DEPTH - PAGE_DEPTH) / 2
);

// ── Colours ────────────────────────────────────────────────
const whiteColor = new Color("white");
const emissiveColor = new Color("orange");
const coverColor = new Color("#11141e"); // midnight obsidian hardcover

// ── Edge materials (shared across instances) ───────────────
const pageEdgeMaterials = [
  new MeshStandardMaterial({ color: whiteColor, depthWrite: true }),
  new MeshStandardMaterial({ color: "#111", depthWrite: true }),
  new MeshStandardMaterial({ color: whiteColor, depthWrite: true }),
  new MeshStandardMaterial({ color: whiteColor, depthWrite: true }),
];

const coverEdgeMaterials = [
  new MeshStandardMaterial({ color: coverColor, roughness: 0.45, metalness: 0.15, depthWrite: true }),
  new MeshStandardMaterial({ color: coverColor, roughness: 0.45, metalness: 0.15, depthWrite: true }),
  new MeshStandardMaterial({ color: coverColor, roughness: 0.45, metalness: 0.15, depthWrite: true }),
  new MeshStandardMaterial({ color: coverColor, roughness: 0.45, metalness: 0.15, depthWrite: true }),
];

// ── Page component ─────────────────────────────────────────
const Page = ({
  number,
  totalPages,
  frontPhoto,
  backPhoto,
  page,
  opened,
  bookClosed,
  ...props
}) => {
  const isCover = number === 0 || number === totalPages - 1;
  const isFrontCover = number === 0;
  const isBackCover = number === totalPages - 1;

  const group = useRef();
  const turnedAt = useRef(0);
  const lastOpened = useRef(opened);
  const skinnedMeshRef = useRef();

  // State to track if this sheet is actively turning in the animation
  const [isTurning, setIsTurning] = useState(false);

  // ── Page position helpers (for render order only) ──────────
  const isLeftTop = number === page - 1;
  const isRightTop = number === page;
  const isLeftBuffer = number === page - 2;
  const isRightBuffer = number === page + 1;

  // Build the skinned mesh with hardware-accelerated backface culling & polygon offset
  const manualSkinnedMesh = useMemo(() => {
    const bones = [];
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const bone = new Bone();
      bones.push(bone);
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH;
      if (i > 0) bones[i - 1].add(bone);
    }
    const skeleton = new Skeleton(bones);

    const edges = isCover
      ? coverEdgeMaterials.map((m) => m.clone())
      : pageEdgeMaterials.map((m) => m.clone());

    const materials = [
      ...edges,
      // material[4] — front face (Strictly FrontSide to eliminate backface bleed)
      new MeshStandardMaterial({
        color: isFrontCover && !frontPhoto ? coverColor : whiteColor,
        roughness: isFrontCover ? 0.35 : 0.1,
        metalness: isFrontCover ? 0.08 : 0,
        emissive: emissiveColor,
        emissiveIntensity: 0,
        side: FrontSide,
        depthWrite: true,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      // material[5] — back face (Strictly FrontSide to eliminate backface bleed)
      new MeshStandardMaterial({
        color: isBackCover && !backPhoto ? coverColor : whiteColor,
        roughness: isBackCover ? 0.35 : 0.1,
        metalness: isBackCover ? 0.08 : 0,
        emissive: emissiveColor,
        emissiveIntensity: 0,
        side: FrontSide,
        depthWrite: true,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    ];

    const geo = isFrontCover
      ? frontCoverGeometry
      : isBackCover
      ? backCoverGeometry
      : pageGeometry;
    const mesh = new SkinnedMesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [isCover, isFrontCover, isBackCover, frontPhoto, backPhoto]);

  // ── Apply / remove front photo texture ──────────────────────
  useEffect(() => {
    if (!skinnedMeshRef.current) return;
    const mat = skinnedMeshRef.current.material[4];
    let active = true;

    if (frontPhoto) {
      getWebPTexture(frontPhoto, PAGE_WIDTH, PAGE_HEIGHT).then((tex) => {
        if (!active || !skinnedMeshRef.current) return;
        if (tex) {
          mat.map = tex;
          mat.color.set(whiteColor);
          mat.roughness = isFrontCover ? 0.35 : 0.1;
          mat.metalness = isFrontCover ? 0.08 : 0;
          mat.needsUpdate = true;
        }
      });
    } else {
      mat.map = null;
      mat.color.set(isFrontCover ? coverColor : whiteColor);
      mat.needsUpdate = true;
    }

    return () => {
      active = false;
    };
  }, [frontPhoto, isFrontCover]);

  // ── Apply / remove back photo texture ───────────────────────
  useEffect(() => {
    if (!skinnedMeshRef.current) return;
    const mat = skinnedMeshRef.current.material[5];
    let active = true;

    if (backPhoto) {
      getWebPTexture(backPhoto, PAGE_WIDTH, PAGE_HEIGHT).then((tex) => {
        if (!active || !skinnedMeshRef.current) return;
        if (tex) {
          mat.map = tex;
          mat.color.set(whiteColor);
          mat.roughness = isBackCover ? 0.35 : 0.1;
          mat.metalness = isBackCover ? 0.08 : 0;
          mat.needsUpdate = true;
        }
      });
    } else {
      mat.map = null;
      mat.color.set(isBackCover ? coverColor : whiteColor);
      mat.needsUpdate = true;
    }

    return () => {
      active = false;
    };
  }, [backPhoto, isBackCover]);

  // ── Per-frame animation ────────────────────────────────────
  useFrame((_, delta) => {
    if (!skinnedMeshRef.current || !group.current) return;

    // Dynamic Render Order to eliminate Z-fighting & ghosting
    let order = 1;
    if (isTurning) {
      order = 30; // Turning page is strictly on top of all sheets
    } else if (isLeftTop || isRightTop) {
      order = 20; // Active top visible leaves
    } else if (isLeftBuffer || isRightBuffer) {
      order = 10; // Buffer underneath active
    }
    skinnedMeshRef.current.renderOrder = order;

    // Highlight glow on active interactive sheet
    const emissiveIntensity = highlighted ? 0.22 : 0;
    skinnedMeshRef.current.material[4].emissiveIntensity =
      skinnedMeshRef.current.material[5].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[4].emissiveIntensity,
        emissiveIntensity,
        0.1
      );

    // Track turn transition
    if (lastOpened.current !== opened) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
      setIsTurning(true);
    }

    const elapsed = new Date() - turnedAt.current;
    if (isTurning && elapsed >= 450) {
      setIsTurning(false);
    }

    let turningProgress = Math.min(400, elapsed) / 400;
    const turningIntensityCurve = Math.sin(turningProgress * Math.PI);

    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2;
    if (!bookClosed) {
      targetRotation += degToRad(number * 0.8);
    }

    const bones = skinnedMeshRef.current.skeleton.bones;
    for (let i = 0; i < bones.length; i++) {
      const target = i === 0 ? group.current : bones[i];
      const insideCurveIntensity = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0;
      const outsideCurveIntensity = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0;
      const turningIntensity =
        Math.sin(i * Math.PI * (1 / bones.length)) * turningIntensityCurve;

      let rotationAngle =
        insideCurveStrength * insideCurveIntensity * targetRotation -
        outsideCurveStrength * outsideCurveIntensity * targetRotation +
        turningCurveStrength * turningIntensity * targetRotation;
      let foldRotationAngle = degToRad(Math.sign(targetRotation) * 2);

      if (bookClosed) {
        if (i === 0) {
          rotationAngle = targetRotation;
          foldRotationAngle = 0;
        } else {
          rotationAngle = 0;
          foldRotationAngle = 0;
        }
      } else if (isCover) {
        // Hardcover distinction: cover is a stiff board, pivoting on the spine hinge (i=0)
        // without flexible paper curling
        if (i === 0) {
          rotationAngle = targetRotation;
        } else if (i <= 2) {
          // Subtle spine hinge joint flex
          rotationAngle = targetRotation * 0.03;
        } else {
          rotationAngle = 0;
        }
        foldRotationAngle = 0;
      }

      easing.dampAngle(target.rotation, "y", rotationAngle, easingFactor, delta);

      const foldIntensity =
        i > 8
          ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningIntensityCurve
          : 0;
      easing.dampAngle(
        target.rotation,
        "x",
        foldRotationAngle * foldIntensity,
        easingFactorFold,
        delta
      );
    }
  });

  // ── Interaction ──────────────────────────────────────────
  const [, setPage] = useAtom(currentPageAtom);
  const [highlighted, setHighlighted] = useState(false);
  useCursor(highlighted);

  return (
    <group
      {...props}
      ref={group}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          e.stopPropagation();
          setHighlighted(true);
        }
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHighlighted(false);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") {
          setHighlighted(false);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        setPage(opened ? number : number + 1);
        setHighlighted(false);
      }}
    >
      <primitive
        object={manualSkinnedMesh}
        ref={skinnedMeshRef}
        position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
      />
    </group>
  );
};

// ── Book component ─────────────────────────────────────────
export const Book = ({ ...props }) => {
  const [page] = useAtom(currentPageAtom);
  const [pageCount] = useAtom(pageCountAtom);
  const [photos] = useAtom(photosAtom);
  const [delayedPage, setDelayedPage] = useState(page);

  const allPages = useMemo(
    () => buildPages(pageCount, photos),
    [pageCount, photos]
  );

  // ── Native Prefetch for upcoming pages ───────────────────
  useEffect(() => {
    const prefetchMin = Math.max(0, page - 2);
    const prefetchMax = Math.min(allPages.length - 1, page + 4);
    const prefetchUrls = [];
    for (let i = prefetchMin; i <= prefetchMax; i++) {
      if (allPages[i]?.front) prefetchUrls.push(allPages[i].front);
      if (allPages[i]?.back) prefetchUrls.push(allPages[i].back);
    }
    updateNativePrefetch(prefetchUrls);
  }, [page, allPages]);

  // Page turning stepper
  useEffect(() => {
    let timeout;
    const goToPage = () => {
      setDelayedPage((prev) => {
        if (page === prev) return prev;
        timeout = setTimeout(
          () => goToPage(),
          Math.abs(page - prev) > 2 ? 50 : 150
        );
        return page > prev ? prev + 1 : prev - 1;
      });
    };
    goToPage();
    return () => clearTimeout(timeout);
  }, [page]);

  return (
    <group {...props} rotation-y={-Math.PI / 2}>
      {allPages.map((pageData, index) => (
        <Page
          key={index}
          page={delayedPage}
          number={index}
          totalPages={allPages.length}
          frontPhoto={pageData.front}
          backPhoto={pageData.back}
          opened={delayedPage > index}
          bookClosed={delayedPage === 0 || delayedPage === allPages.length}
        />
      ))}
    </group>
  );
};
