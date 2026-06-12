import React, { useMemo, useRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { ALL_JOINTS, BONES, Joint, MotionFrame, Pose } from '@/types/motion';
import { lerpPose } from '@/lib/motion/skeleton';
import { normalizePose } from '@/lib/motion/normalize';
import { colors } from '@/theme';

/**
 * 3D stick-figure replay of anonymized motion data. Renders joints as spheres
 * and bones as cylinders, animated by interpolating the MotionFrame[] over its
 * own timeline (loops). Works in Expo Go via @react-three/fiber/native + GL.
 *
 * Optionally overlays a faded reference skeleton ("ghost") for comparison.
 */
/**
 * expo-gl returns `null`/`undefined` from getShaderInfoLog / getProgramInfoLog,
 * but three.js calls `.trim()` on the result during shader compilation. On the
 * iOS Simulator (where expo-gl's GL is flaky) that throws
 * "Cannot read property 'trim' of undefined" and crashes the replay. Wrap those
 * context methods so they always return a string. Safe no-op on real devices.
 */
function hardenGLContext(renderer: THREE.WebGLRenderer) {
  try {
    const gl = renderer.getContext() as WebGLRenderingContext;
    const patch = <K extends 'getShaderInfoLog' | 'getProgramInfoLog'>(name: K) => {
      const orig = gl[name]?.bind(gl);
      if (!orig) return;
      gl[name] = (target: WebGLShader & WebGLProgram) => orig(target) ?? '';
    };
    patch('getShaderInfoLog');
    patch('getProgramInfoLog');
  } catch {
    /* best-effort */
  }
}

export function SkeletonReplay({
  frames,
  reference,
  height = 320,
}: {
  frames: MotionFrame[];
  reference?: MotionFrame[];
  height?: number;
}) {
  return (
    <View style={[styles.canvasWrap, { height }]}>
      <GLErrorBoundary>
        <Canvas
          camera={{ position: [0, 0.2, 3.6], fov: 50 }}
          onCreated={(state) => hardenGLContext(state.gl)}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 4, 3]} intensity={0.9} />
          <Floor />
          {reference && reference.length > 1 && (
            <Figure frames={reference} color={colors.textDim} opacity={0.35} />
          )}
          <Figure frames={frames} color={colors.primary} opacity={1} />
        </Canvas>
      </GLErrorBoundary>
    </View>
  );
}

/** Degrade gracefully if GL/three fails (e.g. on a flaky simulator GL stack). */
class GLErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[SkeletonReplay] 3D render unavailable:', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackEmoji}>🦴</Text>
          <Text style={styles.fallbackText}>
            3D replay isn’t available on this device. Your motion data and
            coaching are still saved below.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}>
      <planeGeometry args={[6, 6]} />
      <meshStandardMaterial color={'#14141d'} />
    </mesh>
  );
}

function Figure({
  frames,
  color,
  opacity,
}: {
  frames: MotionFrame[];
  color: string;
  opacity: number;
}) {
  const group = useRef<THREE.Group>(null);
  const jointRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const boneRefs = useRef<Array<THREE.Mesh | null>>([]);

  const totalMs = frames.length > 1 ? frames[frames.length - 1].timestamp : 1000;

  // Pre-normalize so size/centering is stable across the clip.
  const normFrames = useMemo(
    () => frames.map((f) => ({ t: f.timestamp, pose: normalizePose(f.joints) })),
    [frames]
  );

  useFrame((state) => {
    if (normFrames.length === 0) return;
    const elapsed = (state.clock.elapsedTime * 1000) % Math.max(1, totalMs);
    const pose = sampleAt(normFrames, elapsed);

    for (const j of ALL_JOINTS) {
      const m = jointRefs.current[j];
      if (m) m.position.set(pose[j].x, pose[j].y, pose[j].z);
    }
    BONES.forEach(([a, b], i) => {
      const mesh = boneRefs.current[i];
      if (mesh) orientBone(mesh, pose[a], pose[b]);
    });
  });

  return (
    <group ref={group}>
      {ALL_JOINTS.map((j) => (
        <mesh key={j} ref={(m) => (jointRefs.current[j] = m)}>
          <sphereGeometry args={[j === Joint.Nose ? 0.12 : 0.07, 12, 12]} />
          <meshStandardMaterial color={color} transparent opacity={opacity} />
        </mesh>
      ))}
      {BONES.map((_, i) => (
        <mesh key={i} ref={(m) => (boneRefs.current[i] = m)}>
          <cylinderGeometry args={[0.028, 0.028, 1, 8]} />
          <meshStandardMaterial color={color} transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
const start = new THREE.Vector3();
const end = new THREE.Vector3();
const dir = new THREE.Vector3();
const quat = new THREE.Quaternion();

/** Position/scale/orient a unit cylinder to span from joint a to joint b. */
function orientBone(
  mesh: THREE.Mesh,
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  start.set(a.x, a.y, a.z);
  end.set(b.x, b.y, b.z);
  dir.subVectors(end, start);
  const len = dir.length();
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.scale.set(1, Math.max(len, 1e-3), 1);
  if (len > 1e-4) {
    dir.normalize();
    quat.setFromUnitVectors(UP, dir);
    mesh.quaternion.copy(quat);
  }
}

function sampleAt(
  frames: Array<{ t: number; pose: Pose }>,
  ms: number
): Pose {
  if (frames.length === 1) return frames[0].pose;
  let hi = 1;
  while (hi < frames.length && frames[hi].t < ms) hi++;
  if (hi >= frames.length) return frames[frames.length - 1].pose;
  const lo = hi - 1;
  const span = frames[hi].t - frames[lo].t || 1;
  const f = (ms - frames[lo].t) / span;
  return lerpPose(frames[lo].pose, frames[hi].pose, Math.min(1, Math.max(0, f)));
}

const styles = StyleSheet.create({
  canvasWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0e0e16',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  fallbackEmoji: { fontSize: 34 },
  fallbackText: { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
