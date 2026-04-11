import { useRef, useEffect, memo } from 'react';
import * as THREE from 'three';

// ── Helpers ──────────────────────────────────────────────────────────────────
function ll2xyz(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

function ll2px(lat: number, lng: number, W: number, H: number): [number, number] {
  return [(lng + 180) / 360 * W, (90 - lat) / 180 * H];
}

/** Draw country polygons onto a 2D canvas → apply as sphere texture. */
function buildEarthTexture(geojson: any): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Transparent background (no solid ocean fill)
  ctx.clearRect(0, 0, W, H);

  // Land fill — visible teal, ocean stays transparent
  ctx.fillStyle   = 'rgba(38,180,200,0.62)';
  ctx.strokeStyle = 'rgba(0,210,230,0.85)';
  ctx.lineWidth   = 0.7;

  function drawRing(ring: number[][], move: boolean) {
    if (ring.length < 2) return;
    const [sx, sy] = ll2px(ring[0]![1]!, ring[0]![0]!, W, H);
    if (move) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    for (let i = 1; i < ring.length; i++) {
      const [x, y] = ll2px(ring[i]![1]!, ring[i]![0]!, W, H);
      ctx.lineTo(x, y);
    }
  }

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    const polys: number[][][][] =
      geom.type === 'Polygon'      ? [geom.coordinates]  :
      geom.type === 'MultiPolygon' ?  geom.coordinates    : [];
    for (const poly of polys) {
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) drawRing(poly[i]!, i === 0);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.stroke();
    }
  }

  // Quần đảo Hoàng Sa & Trường Sa
  const VN_COORDS = [
    // Quần đảo Hoàng Sa
    { lat: 16.8333, lng: 112.3333 },
    { lat: 16.7000, lng: 112.2667 },
    { lat: 16.4000, lng: 112.3000 },
    { lat: 16.5833, lng: 111.8333 },
    { lat: 17.0500, lng: 112.3500 },
    { lat: 16.9500, lng: 112.3500 },
    { lat: 16.5000, lng: 111.6000 },
    { lat: 16.5000, lng: 111.3000 },
    { lat: 16.5000, lng: 111.7000 },
    { lat: 16.4000, lng: 111.5000 },
    { lat: 16.4500, lng: 111.7500 },
    // Quần đảo Trường Sa
    { lat: 11.4333, lng: 114.3333 },
    { lat: 11.4500, lng: 114.3500 },
    { lat: 10.1833, lng: 114.3667 },
    { lat: 10.3833, lng: 114.4833 },
    { lat: 10.3833, lng: 114.3167 },
    { lat: 10.4000, lng: 114.3667 },
    { lat:  8.6333, lng: 111.9167 },
    { lat:  7.8667, lng: 112.9000 },
    { lat:  8.9667, lng: 113.6833 },
    { lat: 11.0500, lng: 114.2833 },
    { lat:  9.9167, lng: 115.5333 },
    { lat:  9.5500, lng: 112.8833 },
    { lat:  9.7000, lng: 114.2833 },
    { lat: 10.9167, lng: 114.1000 },
  ];
  for (const { lat, lng } of VN_COORDS) {
    const [ix, iy] = ll2px(lat, lng, W, H);
    ctx.beginPath();
    ctx.arc(ix, iy, 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,95,107,0.45)';
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function ringToLinePts(coords: number[][], r: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    pts.push(ll2xyz(coords[i]![1]!, coords[i]![0]!, r));
    pts.push(ll2xyz(coords[i + 1]![1]!, coords[i + 1]![0]!, r));
  }
  return pts;
}

const VN_ISLANDS: Array<{ name: string; lat: number; lng: number }> = [
  // Quần đảo Hoàng Sa
  ...([
    [16.8333, 112.3333], [16.7000, 112.2667], [16.4000, 112.3000],
    [16.5833, 111.8333], [17.0500, 112.3500], [16.9500, 112.3500],
    [16.5000, 111.6000], [16.5000, 111.3000], [16.5000, 111.7000],
    [16.4000, 111.5000], [16.4500, 111.7500],
  ] as [number, number][]).map(([lat, lng]) => ({ name: '🇻🇳 Quần đảo Hoàng Sa', lat, lng })),
  // Quần đảo Trường Sa
  ...([
    [11.4333, 114.3333], [11.4500, 114.3500], [10.1833, 114.3667],
    [10.3833, 114.4833], [10.3833, 114.3167], [10.4000, 114.3667],
    [ 8.6333, 111.9167], [ 7.8667, 112.9000], [ 8.9667, 113.6833],
    [11.0500, 114.2833], [ 9.9167, 115.5333], [ 9.5500, 112.8833],
    [ 9.7000, 114.2833], [10.9167, 114.1000],
  ] as [number, number][]).map(([lat, lng]) => ({ name: '🇻🇳 Quần đảo Trường Sa', lat, lng })),
];

interface ThreeGlobeProps { size?: number }

export const ThreeGlobe = memo(function ThreeGlobe({ size = 260 }: ThreeGlobeProps) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const tipRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el  = mountRef.current;
    const tip = tipRef.current;
    if (!el || !tip) return;
    const tipEl: HTMLDivElement = tip;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 2.8);
    const globe = new THREE.Group();
    scene.add(globe);

    // ── Transparent glass sphere ───────────────────────────────────────────────
    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x1de9f4,
      specular: 0x80deea,
      shininess: 120,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globe.add(sphereMesh);

    // Atmosphere glow — stronger to compensate for transparent body
    globe.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.13, side: THREE.BackSide }),
    ));

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(3, 3, 5); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4dd0e1, 0.25);
    rim.position.set(-3, -1, -3); scene.add(rim);

    // ── Grid ──────────────────────────────────────────────────────────────────
    const gridMat = new THREE.LineBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.28 });
    const Rg = 1.002;
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lng = -180; lng <= 180; lng += 3) pts.push(ll2xyz(lat, lng, Rg));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let lng = -180; lng < 180; lng += 45) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -85; lat <= 85; lat += 3) pts.push(ll2xyz(lat, lng, Rg));
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    // ── World data ────────────────────────────────────────────────────────────
    const borderMat = new THREE.LineBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.75 });

    fetch('/echarts/world.json')
      .then(r => r.json())
      .then((geojson: any) => {
        sphereMat.map = buildEarthTexture(geojson);
        sphereMat.needsUpdate = true;

        const Rc = 1.003;
        for (const feature of geojson.features) {
          const geom = feature.geometry;
          const polys: number[][][][] =
            geom.type === 'Polygon'      ? [geom.coordinates]  :
            geom.type === 'MultiPolygon' ?  geom.coordinates    : [];
          for (const poly of polys) {
            for (const ring of poly) {
              const pts = ringToLinePts(ring, Rc);
              if (pts.length > 1)
                globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), borderMat));
            }
          }
        }
      })
      .catch(() => { sphereMat.color.set(0xb3ecf5); sphereMat.needsUpdate = true; });

    // ── VN island hit-target dots (invisible large spheres for raycasting) ────
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x005f6b, transparent: true, opacity: 0.45, depthWrite: false });
    const dotHitMat = new THREE.MeshBasicMaterial({ visible: false });

    const hitMeshes: Array<{ mesh: THREE.Mesh; name: string }> = [];
    for (const isl of VN_ISLANDS) {
      const pos = ll2xyz(isl.lat, isl.lng, 1.008);

      // Visible small dot — same color as border lines
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), dotMat);
      dot.position.copy(pos);
      dot.renderOrder = 12;
      globe.add(dot);

      // Larger invisible hit target
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), dotHitMat);
      hit.position.copy(pos);
      globe.add(hit);
      hitMeshes.push({ mesh: hit, name: isl.name });
    }

    // ── Initial orientation ───────────────────────────────────────────────────
    globe.rotation.y = -1.95;

    // ── Pointer drag + raycasting tooltip ─────────────────────────────────────
    let isDragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0;
    const AUTO_SPEED = 0.003;
    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerDown(e: PointerEvent) {
      isDragging = true; lastX = e.clientX; lastY = e.clientY; velX = velY = 0;
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
      tipEl.style.display = 'none';
    }
    function onPointerMove(e: PointerEvent) {
      if (isDragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        velX = dx * 0.008; velY = dy * 0.008;
        globe.rotation.y += velX;
        globe.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, globe.rotation.x + velY));
        return;
      }

      // Raycasting for tooltip
      const rect = canvas.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left)  / rect.width)  * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(hitMeshes.map(h => h.mesh));
      if (hits.length > 0) {
        const found = hitMeshes.find(h => h.mesh === hits[0]!.object);
        if (found) {
          tipEl.textContent = found.name;
          tipEl.style.display = 'block';
          tipEl.style.left = (e.clientX - rect.left + 10) + 'px';
          tipEl.style.top  = (e.clientY - rect.top  - 28) + 'px';
          canvas.style.cursor = 'pointer';
        }
      } else {
        tipEl.style.display = 'none';
        canvas.style.cursor = 'grab';
      }
    }
    function onPointerUp(e: PointerEvent) {
      isDragging = false; canvas.releasePointerCapture(e.pointerId); canvas.style.cursor = 'grab';
    }
    function onPointerLeave() {
      tipEl.style.display = 'none';
    }

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown',  onPointerDown);
    canvas.addEventListener('pointermove',  onPointerMove);
    canvas.addEventListener('pointerup',    onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    // ── Animate ───────────────────────────────────────────────────────────────
    let rafId = 0;
    function animate() {
      rafId = requestAnimationFrame(animate);
      if (!isDragging) {
        velX *= 0.88; velY *= 0.88;
        globe.rotation.y += Math.abs(velX) > 0.0001 ? velX : AUTO_SPEED;
        if (Math.abs(velY) > 0.0001)
          globe.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, globe.rotation.x + velY));
      }
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown',  onPointerDown);
      canvas.removeEventListener('pointermove',  onPointerMove);
      canvas.removeEventListener('pointerup',    onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      renderer.dispose();
      if (el.contains(canvas)) el.removeChild(canvas);
    };
  }, [size]);

  return (
    <div ref={mountRef} style={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
      {/* Tooltip overlay */}
      <div
        ref={tipRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          background: 'rgba(255,255,255,0.95)',
          color: '#1e293b',
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          whiteSpace: 'nowrap',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  );
});
