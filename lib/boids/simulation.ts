import * as THREE from "three";
import { GPUComputationRenderer, Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import {
  BOID_TEX_SIZE,
  positionShader,
  velocityShader,
} from "./shaders";

export type SimulationHandle = {
  compute(delta: number, time: number, baseWind: [number, number]): void;
  getPositionTexture(): THREE.Texture;
  getVelocityTexture(): THREE.Texture;
  setBounds(w: number, h: number): void;
  dispose(): void;
};

export function createSimulation(
  renderer: THREE.WebGLRenderer,
  bounds: [number, number],
): SimulationHandle {
  const gpu = new GPUComputationRenderer(BOID_TEX_SIZE, BOID_TEX_SIZE, renderer);

  const posTex = gpu.createTexture();
  const velTex = gpu.createTexture();
  seedPositions(posTex, bounds);
  seedVelocities(velTex);

  const positionVar: Variable = gpu.addVariable(
    "texturePosition",
    positionShader,
    posTex,
  );
  const velocityVar: Variable = gpu.addVariable(
    "textureVelocity",
    velocityShader,
    velTex,
  );

  gpu.setVariableDependencies(positionVar, [positionVar, velocityVar]);
  gpu.setVariableDependencies(velocityVar, [positionVar, velocityVar]);

  const vu = velocityVar.material.uniforms;
  vu.uDelta = { value: 0 };
  vu.uTime = { value: 0 };
  vu.uBaseWind = { value: new THREE.Vector2(0, 0) };
  vu.uBaseWindWeight = { value: 0.5 };
  vu.uSwirlWeight = { value: 14.0 };
  vu.uSeparation = { value: 15.0 };
  vu.uAlignment = { value: 20.0 };
  vu.uCohesion = { value: 26.0 };
  vu.uSpeedLimit = { value: 4.5 };
  vu.uBounds = { value: new THREE.Vector2(bounds[0], bounds[1]) };

  const pu = positionVar.material.uniforms;
  pu.uDelta = { value: 0 };
  pu.uBounds = { value: new THREE.Vector2(bounds[0], bounds[1]) };

  const initErr = gpu.init();
  if (initErr !== null) {
    console.error("[boids] GPUComputationRenderer init failed:", initErr);
  }

  return {
    compute(delta, time, baseWind) {
      vu.uDelta.value = delta;
      vu.uTime.value = time;
      vu.uBaseWind.value.set(baseWind[0], baseWind[1]);
      pu.uDelta.value = delta;
      gpu.compute();
    },
    getPositionTexture() {
      return gpu.getCurrentRenderTarget(positionVar).texture;
    },
    getVelocityTexture() {
      return gpu.getCurrentRenderTarget(velocityVar).texture;
    },
    setBounds(w, h) {
      vu.uBounds.value.set(w, h);
      pu.uBounds.value.set(w, h);
    },
    dispose() {
      gpu.dispose();
    },
  };
}

function seedPositions(tex: THREE.DataTexture, bounds: [number, number]) {
  const data = tex.image.data as unknown as Float32Array;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = Math.random() * bounds[0];
    data[i + 1] = Math.random() * bounds[1];
    data[i + 2] = 0;
    data[i + 3] = 1;
  }
}

function seedVelocities(tex: THREE.DataTexture) {
  const data = tex.image.data as unknown as Float32Array;
  for (let i = 0; i < data.length; i += 4) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 2;
    data[i + 0] = Math.cos(a) * s;
    data[i + 1] = Math.sin(a) * s;
    data[i + 2] = 0;
    data[i + 3] = 1;
  }
}
