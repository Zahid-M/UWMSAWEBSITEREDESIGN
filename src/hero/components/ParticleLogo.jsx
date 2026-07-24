import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/*
  ParticleLogo — samples the real logo image pixel-by-pixel and turns every
  visible (non-transparent) pixel into a particle positioned exactly where
  that pixel sits. Unlike a hand-written formula, this guarantees the result
  matches the actual artwork (Needle, flourish, star, flag — all of it),
  because it's built from the image itself.

  Put the logo file in `public/` (e.g. public/logo-mark.png) so it's served
  as a static asset, then pass its path in `src`.
*/
export default function ParticleLogo({
  src = `${import.meta.env.BASE_URL}logo-mark.png`,
  particleCount = 10000,
  glow = true,
}) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf, geometry, material, points;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50, mount.clientWidth / mount.clientHeight, 0.1, 3000
    );
    camera.position.set(0, 0, 420);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (disposed) return;

      // Sample the image onto an offscreen canvas at a controlled resolution
      // — this is what controls particle density/performance.
      const maxDim = 260;
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const cw = Math.round(img.width * ratio);
      const ch = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch).data;

      const rawX = [], rawY = [], rawR = [], rawG = [], rawB = [];
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const idx = (y * cw + x) * 4;
          const a = data[idx + 3];
          if (a < 80) continue; // skip transparent pixels
          rawX.push(x - cw / 2);
          rawY.push(-(y - ch / 2)); // flip: canvas y-down -> 3D y-up
          rawR.push(data[idx] / 255);
          rawG.push(data[idx + 1] / 255);
          rawB.push(data[idx + 2] / 255);
        }
      }

      // Subsample evenly if the image has more opaque pixels than our budget.
      const found = rawX.length;
      const stride = found > particleCount ? Math.ceil(found / particleCount) : 1;
      const total = Math.ceil(found / stride);

      const worldScale = 300 / Math.max(cw, ch);
      const positions = new Float32Array(total * 3);
      const startPos = new Float32Array(total * 3);
      const targetArr = new Float32Array(total * 3);
      const colors = new Float32Array(total * 3);

      let p = 0;
      for (let idx = 0; idx < found && p < total; idx += stride, p++) {
        const tx = rawX[idx] * worldScale;
        const ty = rawY[idx] * worldScale;
        const tz = (Math.random() - 0.5) * 26; // slight depth so it "pops"

        const ang = Math.random() * Math.PI * 2;
        const rad = 260 + Math.random() * 220;
        const sx = Math.cos(ang) * rad;
        const sy = Math.sin(ang) * rad;
        const sz = (Math.random() - 0.5) * 400;

        startPos[p * 3] = sx; startPos[p * 3 + 1] = sy; startPos[p * 3 + 2] = sz;
        targetArr[p * 3] = tx; targetArr[p * 3 + 1] = ty; targetArr[p * 3 + 2] = tz;
        positions[p * 3] = sx; positions[p * 3 + 1] = sy; positions[p * 3 + 2] = sz;

        colors[p * 3] = rawR[idx];
        colors[p * 3 + 1] = rawG[idx];
        colors[p * 3 + 2] = rawB[idx];
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      material = new THREE.PointsMaterial({
        size: 2.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      points = new THREE.Points(geometry, material);
      scene.add(points);

      const clock = new THREE.Clock();
      const animate = () => {
        if (disposed) return;
        const t = clock.getElapsedTime();
        const posAttr = geometry.attributes.position;
        const assembleProgress = Math.min(1, t / 2.0); // 2s assembly-in
        const ease = 1 - Math.pow(1 - assembleProgress, 3);
        const settled = ease > 0.98;

        for (let i = 0; i < total; i++) {
          const sx = startPos[i * 3], sy = startPos[i * 3 + 1], sz = startPos[i * 3 + 2];
          const tx = targetArr[i * 3], ty = targetArr[i * 3 + 1], tz = targetArr[i * 3 + 2];
          const bob = settled ? Math.sin(t * 1.2 + i * 0.05) * 1.5 : 0;
          posAttr.array[i * 3] = sx + (tx - sx) * ease;
          posAttr.array[i * 3 + 1] = sy + (ty - sy) * ease + bob;
          posAttr.array[i * 3 + 2] = sz + (tz - sz) * ease;
        }
        posAttr.needsUpdate = true;

        points.rotation.y = Math.sin(t * 0.15) * 0.12;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();
    };
    img.src = src;

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (geometry) geometry.dispose();
      if (material) material.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [src, particleCount, glow]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />;
}
