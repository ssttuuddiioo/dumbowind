"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";

import { createSimulation, type SimulationHandle } from "@/lib/boids/simulation";
import { createGlyphAtlas } from "@/lib/boids/atlas";
import { createGlyphSprites } from "@/lib/boids/sprites";
import { createLetterAtlas } from "@/lib/boids/letterAtlas";
import { createLetters, type LettersHandle } from "@/lib/boids/letters";

const FRAME_MS = 1000 / 30;

type Props = {
  typingText: string;
  releaseTick: number;
};

export function WindScene({ typingText, releaseTick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<LettersHandle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x0a0a0a, 1);

    const canvasEl = renderer.domElement;
    canvasEl.style.display = "block";
    canvasEl.style.width = "100vw";
    canvasEl.style.height = "100dvh";
    container.appendChild(canvasEl);

    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height, false);

    let sim: SimulationHandle;
    try {
      sim = createSimulation(renderer, [width, height]);
    } catch (e) {
      console.error("[WindScene] simulation init failed", e);
      return;
    }

    const atlas = createGlyphAtlas();
    const sprites = createGlyphSprites([width, height], atlas, dpr);

    const letterAtlas = createLetterAtlas();
    const letters = createLetters(letterAtlas, [width, height], dpr);
    lettersRef.current = letters;

    const scene = new THREE.Scene();
    scene.add(sprites.points);
    scene.add(letters.points);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const baseNoise = createNoise3D();

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      renderer.setSize(width, height, false);
      sim.setBounds(width, height);
      sprites.material.uniforms.uBounds.value.set(width, height);
      letters.setBounds(width, height);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = 0;
    let lastTickMs = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;

      const delta = Math.min(0.05, (now - lastTickMs) / 1000);
      lastTickMs = now;

      const t = now * 0.001;
      const slowX = Math.tanh(baseNoise(0, 0, t * 0.09) * 2.8);
      const slowY = baseNoise(100, 100, t * 0.08) * 0.35;
      const gustX = baseNoise(50, 0, t * 0.35) * 0.12;
      const gustY = baseNoise(0, 50, t * 0.3) * 0.12;
      const wind: [number, number] = [slowX + gustX, slowY + gustY];
      sim.compute(delta * 0.75, t, wind);

      letters.update(delta, t, wind, now);

      sprites.material.uniforms.uPosition.value = sim.getPositionTexture();
      sprites.material.uniforms.uVelocity.value = sim.getVelocityTexture();

      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      last = now;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      lettersRef.current = null;
      sim.dispose();
      atlas.dispose();
      sprites.material.dispose();
      sprites.points.geometry.dispose();
      letterAtlas.dispose();
      letters.dispose();
      renderer.dispose();
      if (canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    };
  }, []);

  useEffect(() => {
    const letters = lettersRef.current;
    if (!letters) return;
    letters.setTypingText(typingText, performance.now());
  }, [typingText]);

  useEffect(() => {
    if (releaseTick === 0) return;
    const letters = lettersRef.current;
    if (!letters) return;
    letters.release(performance.now());
  }, [releaseTick]);

  return <div ref={containerRef} className="fixed inset-0 bg-ink pointer-events-none" />;
}
