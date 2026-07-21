import { useEffect, useRef } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  angle: number;
  radius: number;
  phase: number;
}

interface Connection {
  p1: number;
  p2: number;
}

export function Holographic3DModel({ theme = "dark" }: { theme?: "light" | "dark" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rotation angles
  const rotationRef = useRef({ yaw: 0, pitch: 0, roll: 0 });
  const targetRotationRef = useRef({ yaw: 0, pitch: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect prefers-reduced-motion by drawing only a single static frame instead of a continuous animation loop
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Configuration
    const POINT_COUNT = 80;
    const ORBITAL_RINGS = 4;
    const RING_POINTS = 30;
    const FOCAL_LENGTH = 350;

    const points: Point3D[] = [];
    const orbitalPoints: Point3D[] = [];
    const connections: Connection[] = [];
    let animationFrameId = 0;

    // 1. Initialize central sphere points
    for (let i = 0; i < POINT_COUNT; i++) {
      // Golden spiral distribution on a sphere
      const phi = Math.acos(-1 + (2 * i) / POINT_COUNT);
      const theta = Math.sqrt(POINT_COUNT * Math.PI) * phi;
      const radius = 100 + Math.random() * 20; // sphere radius range

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      points.push({
        x,
        y,
        z,
        baseX: x,
        baseY: y,
        baseZ: z,
        speed: 0.02 + Math.random() * 0.03,
        angle: Math.random() * Math.PI * 2,
        radius,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Connect sphere points that are close to each other
    for (let i = 0; i < POINT_COUNT; i++) {
      for (let j = i + 1; j < POINT_COUNT; j++) {
        const dx = points[i].baseX - points[j].baseX;
        const dy = points[i].baseY - points[j].baseY;
        const dz = points[i].baseZ - points[j].baseZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Only connect neighbors
        if (dist < 60) {
          connections.push({ p1: i, p2: j });
        }
      }
    }

    // 2. Initialize orbital ring points
    for (let r = 0; r < ORBITAL_RINGS; r++) {
      const ringRadius = 140 + r * 35;
      const tiltX = (Math.random() - 0.5) * 0.6;
      const tiltZ = (Math.random() - 0.5) * 0.6;
      const speedMultiplier = (1.5 - r * 0.2) * 0.005;

      for (let i = 0; i < RING_POINTS; i++) {
        const angle = (i / RING_POINTS) * Math.PI * 2;
        // Coordinates in ring plane
        const rx = ringRadius * Math.cos(angle);
        const ry = 0;
        const rz = ringRadius * Math.sin(angle);

        // Tilt transformations
        // Tilt X
        const y1 = ry * Math.cos(tiltX) - rz * Math.sin(tiltX);
        const z1 = ry * Math.sin(tiltX) + rz * Math.cos(tiltX);
        // Tilt Z
        const x2 = rx * Math.cos(tiltZ) - y1 * Math.sin(tiltZ);
        const y2 = rx * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);

        orbitalPoints.push({
          x: x2,
          y: y2,
          z: z1,
          baseX: x2,
          baseY: y2,
          baseZ: z1,
          speed: speedMultiplier,
          angle: angle,
          radius: ringRadius,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Track Mouse for camera panning
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

      targetRotationRef.current.yaw = x * 0.4;
      targetRotationRef.current.pitch = y * 0.4;
    };

    // Listen to parent container moves or fall back to window
    window.addEventListener("mousemove", handleMouseMove);

    // Color definitions based on theme
    const getColors = () => {
      if (theme === "light") {
        return {
          coreGlow: "rgba(245, 158, 11, 0.25)",
          pointColor: "rgba(245, 158, 11, 0.85)",
          lineColor: "rgba(245, 158, 11, 0.25)",
          orbitColor: "rgba(100, 116, 139, 0.4)",
          ringPointColor: "rgba(245, 158, 11, 0.95)",
          pulseColor: "rgba(245, 158, 11, 0.05)",
          lineAlphaMultiplier: 0.65,
          pointAlphaMultiplier: 0.9,
        };
      } else {
        return {
          coreGlow: "rgba(245, 158, 11, 0.4)",
          pointColor: "rgba(245, 158, 11, 0.95)",
          lineColor: "rgba(245, 158, 11, 0.35)",
          orbitColor: "rgba(245, 158, 11, 0.35)",
          ringPointColor: "rgba(251, 191, 36, 1.0)",
          pulseColor: "rgba(245, 158, 11, 0.08)",
          lineAlphaMultiplier: 0.8,
          pointAlphaMultiplier: 0.95,
        };
      }
    };

    let time = 0;

    // Animation Loop
    const draw = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      time += 0.015;
      const colors = getColors();

      // Smoothly interpolate rotation angles towards mouse targets
      rotationRef.current.yaw += (targetRotationRef.current.yaw - rotationRef.current.yaw) * 0.05;
      rotationRef.current.pitch +=
        (targetRotationRef.current.pitch - rotationRef.current.pitch) * 0.05;
      // Auto rotation over time
      rotationRef.current.roll += 0.002;

      const yaw = rotationRef.current.yaw + rotationRef.current.roll * 0.5;
      const pitch = rotationRef.current.pitch + rotationRef.current.roll * 0.3;
      const roll = rotationRef.current.roll * 0.2;

      // Cos and Sin helpers for 3D rotations
      const cosY = Math.cos(yaw),
        sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch),
        sinP = Math.sin(pitch);
      const cosR = Math.cos(roll),
        sinR = Math.sin(roll);

      // Projects 3D to 2D
      const project = (pt: Point3D) => {
        // Rotate Pitch (X axis)
        const x1 = pt.x;
        const y1 = pt.y * cosP - pt.z * sinP;
        const z1 = pt.y * sinP + pt.z * cosP;

        // Rotate Yaw (Y axis)
        const x2 = x1 * cosY + z1 * sinY;
        const y2 = y1;
        const z2 = -x1 * sinY + z1 * cosY;

        // Rotate Roll (Z axis)
        const x3 = x2 * cosR - y2 * sinR;
        const y3 = x2 * sinR + y2 * cosR;
        const z3 = z2;

        // Perspective Projection
        const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z3);
        const px = x3 * scale + width / 2;
        const py = y3 * scale + height / 2;

        return { x: px, y: py, z: z3, scale, visible: z3 > -FOCAL_LENGTH };
      };

      // 3. Central Core Glowing Orb
      ctx.save();
      const coreGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        85 + Math.sin(time * 3) * 6,
      );
      coreGrad.addColorStop(0, colors.coreGlow);
      coreGrad.addColorStop(0.5, colors.pulseColor);
      coreGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 90 + Math.sin(time * 3) * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Update sphere points coordinates with organic wave oscillation
      const updatedPoints = points.map((p) => {
        const wave = Math.sin(time * 1.5 + p.phase) * 8;
        const scaleFactor = 1 + wave / p.radius;
        return {
          ...p,
          x: p.baseX * scaleFactor,
          y: p.baseY * scaleFactor,
          z: p.baseZ * scaleFactor,
        };
      });

      // Project all sphere points
      const projectedSphere = updatedPoints.map((p) => project(p));

      // Draw Connections (Wireframe grid)
      ctx.lineWidth = 0.55;
      connections.forEach((conn) => {
        const p1 = projectedSphere[conn.p1];
        const p2 = projectedSphere[conn.p2];

        if (p1.visible && p2.visible) {
          // Fade connection based on depth
          const alpha = Math.min(p1.scale, p2.scale) * colors.lineAlphaMultiplier;
          ctx.strokeStyle = colors.lineColor.replace(/[\d.]+\)$/, `${alpha})`);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // Draw Sphere Points
      projectedSphere.forEach((p) => {
        if (p.visible) {
          const size = Math.max(0.5, p.scale * 1.6);
          const alpha = p.scale * colors.pointAlphaMultiplier;
          ctx.fillStyle = colors.pointColor.replace(/[\d.]+\)$/, `${alpha})`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 4. Update and Project Ring points
      const projectedRings = orbitalPoints.map((p) => {
        // Increment orbital angle
        p.angle += p.speed;

        // Dynamic sine wave height oscillation for orbital rings
        const waveH = Math.sin(time * 2 + p.phase) * 4;

        // Re-evaluate coordinates
        const xVal = p.radius * Math.cos(p.angle);
        const zVal = p.radius * Math.sin(p.angle);
        const yVal = waveH;

        // Apply point transformations
        return project({ ...p, x: xVal, y: yVal, z: zVal });
      });

      // Group ring points back to draw the orbit trails
      for (let r = 0; r < ORBITAL_RINGS; r++) {
        const startIdx = r * RING_POINTS;
        const endIdx = startIdx + RING_POINTS;
        const ringProj = projectedRings.slice(startIdx, endIdx);

        // Draw ring path line
        ctx.strokeStyle = colors.orbitColor;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        for (let i = 0; i <= RING_POINTS; i++) {
          const p = ringProj[i % RING_POINTS];
          if (p.visible) {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();

        // Draw glowing active orbital nodes
        const activeNodeIdx = Math.floor((time * 20 + r * 15) % RING_POINTS);
        const node = ringProj[activeNodeIdx];
        if (node && node.visible) {
          const size = Math.max(1.8, node.scale * 3.5);
          ctx.shadowBlur = 12;
          ctx.shadowColor = "rgba(245, 158, 11, 0.8)";
          ctx.fillStyle = colors.ringPointColor;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
          ctx.fill();

          // Clear shadow effect for next draws
          ctx.shadowBlur = 0;
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    // Handle Resize
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // If prefers-reduced-motion is true, draw a single frame on resize so it doesn't stay blank
      if (prefersReducedMotion) {
        draw();
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Initial draw
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      resizeObserver.disconnect();
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none select-none overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-90 dark:opacity-80 dark:mix-blend-screen pointer-events-none"
      />
    </div>
  );
}
