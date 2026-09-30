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
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  TextureLoader,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { currentPageAtom, pageCountAtom, photosAtom, buildPages } from "./UI";

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
function createBookGeometry(depth) {
  const geometry = new BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    depth,
    PAGE_SEGMENTS,
    2
  );
  geometry.translate(PAGE_WIDTH / 2, 0, 0);

  const position = geometry.attributes.position;
  const vertex = new Vector3();
  const skinIndexes = [];
  const skinWeights = [];

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const x = vertex.x;
    const skinIndex = Math.max(0, Math.floor(x / SEGMENT_WIDTH));
    let skinWeight = (x % SEGMENT_WIDTH) / SEGMENT_WIDTH;
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

const pageGeometry = createBookGeometry(PAGE_DEPTH);
const coverGeometry = createBookGeometry(COVER_DEPTH);

// ── Colours ────────────────────────────────────────────────
const whiteColor = new Color("white");
const emissiveColor = new Color("orange");
const coverColor = new Color("#3d2b1f"); // dark leather brown

// ── Edge materials (shared across instances) ───────────────
const pageEdgeMaterials = [
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: "#111" }),
  new MeshStandardMaterial({ color: whiteColor }),
  new MeshStandardMaterial({ color: whiteColor }),
];

const coverEdgeMaterials = [
  new MeshStandardMaterial({ color: coverColor, roughness: 0.6 }),
  new MeshStandardMaterial({ color: coverColor, roughness: 0.6 }),
  new MeshStandardMaterial({ color: coverColor, roughness: 0.6 }),
  new MeshStandardMaterial({ color: coverColor, roughness: 0.6 }),
];

// ── Texture loader singleton ───────────────────────────────
const textureLoader = new TextureLoader();

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

  // Build the skinned mesh
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
      // material[4] — front face
      new MeshStandardMaterial({
        color: isFrontCover ? coverColor : whiteColor,
        roughness: isCover ? 0.6 : 0.1,
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
      // material[5] — back face
      new MeshStandardMaterial({
        color: isBackCover ? coverColor : whiteColor,
        roughness: isCover ? 0.6 : 0.1,
        emissive: emissiveColor,
        emissiveIntensity: 0,
      }),
    ];

    const geo = isCover ? coverGeometry : pageGeometry;
    const mesh = new SkinnedMesh(geo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.add(skeleton.bones[0]);
    mesh.bind(skeleton);
    return mesh;
  }, [isCover, isFrontCover, isBackCover]);

  // ── Apply / remove front photo texture ───────────────────
  useEffect(() => {
    if (!skinnedMeshRef.current) return;
    const mat = skinnedMeshRef.current.material[4];

    if (frontPhoto && !isFrontCover) {
      const tex = textureLoader.load(frontPhoto);
      tex.colorSpace = SRGBColorSpace;
      mat.map = tex;
      mat.color = whiteColor.clone();
      mat.needsUpdate = true;
      return () => {
        tex.dispose();
        mat.map = null;
        mat.needsUpdate = true;
      };
    } else {
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      mat.color = isFrontCover ? coverColor.clone() : whiteColor.clone();
      mat.needsUpdate = true;
    }
  }, [frontPhoto, isFrontCover]);

  // ── Apply / remove back photo texture ────────────────────
  useEffect(() => {
    if (!skinnedMeshRef.current) return;
    const mat = skinnedMeshRef.current.material[5];

    if (backPhoto && !isBackCover) {
      const tex = textureLoader.load(backPhoto);
      tex.colorSpace = SRGBColorSpace;
      mat.map = tex;
      mat.color = whiteColor.clone();
      mat.needsUpdate = true;
      return () => {
        tex.dispose();
        mat.map = null;
        mat.needsUpdate = true;
      };
    } else {
      if (mat.map) {
        mat.map.dispose();
        mat.map = null;
      }
      mat.color = isBackCover ? coverColor.clone() : whiteColor.clone();
      mat.needsUpdate = true;
    }
  }, [backPhoto, isBackCover]);

  // ── Per-frame animation ──────────────────────────────────
  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) return;

    // Highlight glow
    const emissiveIntensity = highlighted ? 0.22 : 0;
    skinnedMeshRef.current.material[4].emissiveIntensity =
      skinnedMeshRef.current.material[5].emissiveIntensity = MathUtils.lerp(
        skinnedMeshRef.current.material[4].emissiveIntensity,
        emissiveIntensity,
        0.1
      );

    if (lastOpened.current !== opened) {
      turnedAt.current = +new Date();
      lastOpened.current = opened;
    }
    let turningTime = Math.min(400, new Date() - turnedAt.current) / 400;
    turningTime = Math.sin(turningTime * Math.PI);

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
        Math.sin(i * Math.PI * (1 / bones.length)) * turningTime;

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
      }

      easing.dampAngle(target.rotation, "y", rotationAngle, easingFactor, delta);

      const foldIntensity =
        i > 8
          ? Math.sin(i * Math.PI * (1 / bones.length) - 0.5) * turningTime
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
        e.stopPropagation();
        setHighlighted(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHighlighted(false);
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
