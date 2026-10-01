import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { attachGlobeInteraction } from '../game/interaction';
import { latLngToVec3, vec3ToLatLng, type LatLng } from '../game/geo';
import earthDayUrl from '../assets/earth-blue-marble.jpg';
import earthBumpUrl from '../assets/earth-topology.png';

export interface RevealState {
  guess: LatLng;
  actual: LatLng;
}

interface GlobeProps {
  onGuess: (latLng: LatLng) => void;
  reveal: RevealState | null;
  guessEnabled: boolean;
  /** Fired once the earth textures have finished loading. */
  onReady?: () => void;
}

const GLOBE_RADIUS = 1;
const MIN_CAMERA_Z = 1.5;
const MAX_CAMERA_Z = 4.5;
const INITIAL_CAMERA_Z = 2.7;
const REVEAL_CAMERA_Z = 2.4;
const ROTATE_SPEED = 0.0055; // radians per dragged pixel
const REVEAL_ANIM_MS = 1100;
const ARC_SEGMENTS = 96;
const ARC_DRAW_MS = 900;

const GUESS_COLOR = 0xffa726;
const ACTUAL_COLOR = 0x34e07a;
const ARC_COLOR = 0xffd166;

const WORLD_X = new THREE.Vector3(1, 0, 0);
const WORLD_Y = new THREE.Vector3(0, 1, 0);
const CAMERA_DIRECTION = new THREE.Vector3(0, 0, 1);

interface RevealAnim {
  startQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  startTime: number;
}

interface GlobeScene {
  globeGroup: THREE.Group;
  earthMesh: THREE.Mesh;
  markersGroup: THREE.Group;
  pulseRing: THREE.Mesh | null;
  pulseStartTime: number;
  arcLine: THREE.Line | null;
  arcStartTime: number;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
  });
}

function makeDot(latLng: LatLng, color: number, radius: number): THREE.Mesh {
  const pos = latLngToVec3(latLng, GLOBE_RADIUS * 1.004);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  dot.position.set(pos.x, pos.y, pos.z);
  return dot;
}

function makePulseRing(latLng: LatLng): THREE.Mesh {
  const pos = latLngToVec3(latLng, GLOBE_RADIUS * 1.006);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.02, 0.027, 48),
    new THREE.MeshBasicMaterial({
      color: ACTUAL_COLOR,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.position.set(pos.x, pos.y, pos.z);
  const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return ring;
}

/** Elevated great-circle arc between the guess and the actual spot. */
function makeArc(a: LatLng, b: LatLng): THREE.Line | null {
  const va = latLngToVec3(a);
  const vb = latLngToVec3(b);
  const from = new THREE.Vector3(va.x, va.y, va.z).normalize();
  const to = new THREE.Vector3(vb.x, vb.y, vb.z).normalize();
  const angle = from.angleTo(to);
  if (angle < 1e-4) return null; // guess landed on the spot — no arc needed
  const sinAngle = Math.sin(angle);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
    const t = i / ARC_SEGMENTS;
    const p = new THREE.Vector3()
      .addScaledVector(from, Math.sin((1 - t) * angle) / sinAngle)
      .addScaledVector(to, Math.sin(t * angle) / sinAngle);
    const altitude = GLOBE_RADIUS * (1.004 + 0.18 * Math.sin(Math.PI * t) * (angle / Math.PI));
    p.normalize().multiplyScalar(altitude);
    points.push(p);
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: ARC_COLOR, transparent: true, opacity: 0.95 }),
  );
  return line;
}

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
    gl_FragColor = vec4(0.35, 0.62, 1.0, 1.0) * intensity;
  }
`;

export function Globe({ onGuess, reveal, guessEnabled, onReady }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const revealAnimRef = useRef<RevealAnim | null>(null);
  const zoomTargetRef = useRef(INITIAL_CAMERA_Z);
  const guessEnabledRef = useRef(guessEnabled);
  const onGuessRef = useRef(onGuess);
  const onReadyRef = useRef(onReady);
  guessEnabledRef.current = guessEnabled;
  onGuessRef.current = onGuess;
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(0, 0, INITIAL_CAMERA_Z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(5, 2.5, 4);
    scene.add(sun);

    const loadManager = new THREE.LoadingManager();
    loadManager.onLoad = () => onReadyRef.current?.();
    loadManager.onError = (url) => {
      console.warn(`maptap: failed to load texture ${url}`);
      onReadyRef.current?.(); // don't hang the loading screen on a texture failure
    };
    const textureLoader = new THREE.TextureLoader(loadManager);
    const dayTexture = textureLoader.load(earthDayUrl);
    dayTexture.colorSpace = THREE.SRGBColorSpace;
    dayTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const bumpTexture = textureLoader.load(earthBumpUrl);
    const earthGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: dayTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.05,
      specular: new THREE.Color(0x222222),
      shininess: 6,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    globeGroup.add(earthMesh);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.16, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    scene.add(atmosphere);

    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const y = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - y * y);
      const r = 60 + Math.random() * 40;
      starPositions[i * 3] = r * s * Math.cos(theta);
      starPositions[i * 3 + 1] = r * y;
      starPositions[i * 3 + 2] = r * s * Math.sin(theta);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.3,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.75,
      }),
    );
    scene.add(stars);

    const markersGroup = new THREE.Group();
    globeGroup.add(markersGroup);

    const globeScene: GlobeScene = {
      globeGroup,
      earthMesh,
      markersGroup,
      pulseRing: null,
      pulseStartTime: 0,
      arcLine: null,
      arcStartTime: 0,
    };
    sceneRef.current = globeScene;

    const raycaster = new THREE.Raycaster();

    const handleRotate = (dx: number, dy: number) => {
      revealAnimRef.current = null; // user input cancels the reveal animation
      const qx = new THREE.Quaternion().setFromAxisAngle(WORLD_Y, dx * ROTATE_SPEED);
      const qy = new THREE.Quaternion().setFromAxisAngle(WORLD_X, dy * ROTATE_SPEED);
      globeGroup.quaternion.premultiply(qy).premultiply(qx);
    };

    const handleZoom = (deltaY: number) => {
      zoomTargetRef.current = THREE.MathUtils.clamp(
        zoomTargetRef.current * (1 + deltaY * 0.0012),
        MIN_CAMERA_Z,
        MAX_CAMERA_Z,
      );
    };

    const handleGuessPoint = (x: number, y: number) => {
      if (!guessEnabledRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ndc = new THREE.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(earthMesh, false)[0];
      if (!hit) return; // clicked space — not a guess
      const local = earthMesh.worldToLocal(hit.point.clone());
      onGuessRef.current(vec3ToLatLng({ x: local.x, y: local.y, z: local.z }));
    };

    const detachInteraction = attachGlobeInteraction(renderer.domElement, {
      onRotate: handleRotate,
      onZoom: handleZoom,
      onGuess: handleGuessPoint,
    });

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      camera.position.z += (zoomTargetRef.current - camera.position.z) * Math.min(1, dt * 9);

      const anim = revealAnimRef.current;
      if (anim) {
        const t = Math.min(1, (performance.now() - anim.startTime) / REVEAL_ANIM_MS);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        globeGroup.quaternion.slerpQuaternions(anim.startQuat, anim.targetQuat, eased);
        if (t >= 1) revealAnimRef.current = null;
      }

      if (globeScene.pulseRing) {
        const t = ((performance.now() - globeScene.pulseStartTime) / 1400) % 1;
        globeScene.pulseRing.scale.setScalar(1 + t * 2.4);
        const material = globeScene.pulseRing.material;
        if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.85 * (1 - t);
      }

      if (globeScene.arcLine) {
        const progress = Math.min(1, (performance.now() - globeScene.arcStartTime) / ARC_DRAW_MS);
        const count = Math.max(0, Math.floor(progress * (ARC_SEGMENTS + 1)));
        globeScene.arcLine.geometry.setDrawRange(0, count);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      detachInteraction();
      sceneRef.current = null;
      revealAnimRef.current = null;
      disposeObject(scene);
      dayTexture.dispose();
      bumpTexture.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const globeScene = sceneRef.current;
    if (!globeScene) return;

    disposeObject(globeScene.markersGroup);
    globeScene.markersGroup.clear();
    globeScene.pulseRing = null;
    globeScene.arcLine = null;

    if (!reveal) return;

    globeScene.markersGroup.add(makeDot(reveal.guess, GUESS_COLOR, 0.011));
    globeScene.markersGroup.add(makeDot(reveal.actual, ACTUAL_COLOR, 0.013));
    const ring = makePulseRing(reveal.actual);
    globeScene.markersGroup.add(ring);
    globeScene.pulseRing = ring;
    globeScene.pulseStartTime = performance.now();
    const arc = makeArc(reveal.guess, reveal.actual);
    if (arc) {
      arc.geometry.setDrawRange(0, 0);
      globeScene.markersGroup.add(arc);
      globeScene.arcLine = arc;
      globeScene.arcStartTime = performance.now() + REVEAL_ANIM_MS * 0.55;
    }

    // Rotate the globe so the actual spot faces the camera.
    const actualVec = latLngToVec3(reveal.actual);
    const localDir = new THREE.Vector3(actualVec.x, actualVec.y, actualVec.z).normalize();
    const worldDir = localDir.clone().applyQuaternion(globeScene.globeGroup.quaternion).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(worldDir, CAMERA_DIRECTION);
    revealAnimRef.current = {
      startQuat: globeScene.globeGroup.quaternion.clone(),
      targetQuat: delta.multiply(globeScene.globeGroup.quaternion),
      startTime: performance.now(),
    };
    zoomTargetRef.current = Math.max(zoomTargetRef.current, REVEAL_CAMERA_Z);
  }, [reveal]);

  return (
    <div
      ref={containerRef}
      className={`globe-container${guessEnabled ? ' guess-enabled' : ''}`}
    />
  );
}
