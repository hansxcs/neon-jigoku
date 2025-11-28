



export const Patterns = {
  // 1. Simple aimed shot
  aimed: (p, origin, target, spawn, speed) => {
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [255, 100, 100]);
  },

  // 2. Spiral (Single arm)
  spiral: (p, origin, frame, spawn, speed) => {
    const angle = frame * 0.1;
    spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [255, 0, 255]);
  },

  // 3. Multi-arm Spiral (Flower)
  flower: (p, origin, frame, arms, spawn, speed) => {
    for (let i = 0; i < arms; i++) {
      const angle = (frame * 0.05) + (p.TWO_PI / arms) * i;
      spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [200, 50, 255]);
    }
  },

  // 4. Circular Burst (Ring)
  ring: (p, origin, count, spawn, speed) => {
    for (let i = 0; i < count; i++) {
      const angle = (p.TWO_PI / count) * i;
      spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [255, 100, 0]);
    }
  },

  // 5. Sine Wave Stream
  sineStream: (p, origin, frame, spawn, speed) => {
    const baseAngle = p.PI / 2; // Down
    const oscillation = Math.sin(frame * 0.1) * 0.5;
    const angle = baseAngle + oscillation;
    spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [100, 100, 255]);
  },

  // 6. Shotgun / Spread
  spread: (p, origin, target, count, spreadAngle, spawn, speed) => {
    const baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
    for (let i = 0; i < count; i++) {
      const offset = p.map(i, 0, count - 1, -spreadAngle / 2, spreadAngle / 2);
      const angle = baseAngle + offset;
      spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [255, 255, 50]);
    }
  },

  // 7. Spinning Cross
  cross: (p, origin, frame, spawn, speed) => {
    const arms = 4;
    const offset = frame * 0.03;
    for (let i = 0; i < arms; i++) {
      const angle = offset + (p.TWO_PI / arms) * i;
      spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [50, 255, 50]);
    }
  },

  // 8. Random Rain
  rain: (p, width, spawn, speed) => {
    const x = p.random(10, width - 10);
    spawn(x, 0, 0, 1, speed, [100, 200, 255]);
  },

  // 9. Chaos (Random positions around boss)
  chaos: (p, origin, spawn, speed) => {
    const angle = p.random(p.TWO_PI);
    const dist = 50;
    const spawnX = origin.x + Math.cos(angle) * dist;
    const spawnY = origin.y + Math.sin(angle) * dist;
    spawn(spawnX, spawnY, Math.cos(angle), Math.sin(angle), speed, [255, 255, 255]);
  },

  // 10. Converging Circle
  converge: (p, target, width, height, spawn, speed) => {
    const side = Math.floor(p.random(4));
    let x = 0, y = 0;
    if (side === 0) { x = p.random(width); y = 0; }
    else if (side === 1) { x = width; y = p.random(height); }
    else if (side === 2) { x = p.random(width); y = height; }
    else { x = 0; y = p.random(height); }
    
    const angle = Math.atan2(target.y - y, target.x - x);
    spawn(x, y, Math.cos(angle), Math.sin(angle), speed * 0.7, [255, 0, 0]);
  },

  // --- SQUARE BOSS PATTERNS ---

  // 11. Square Spiral (4 corners firing)
  squareSpiral: (p, origin, frame, spawn, speed) => {
    const rotation = frame * 0.05;
    const size = 40;
    // Fire from 4 corners of the boss rect
    for(let i = 0; i < 4; i++) {
       const angle = rotation + (p.TWO_PI / 4) * i;
       const cornerX = origin.x + Math.cos(angle) * size;
       const cornerY = origin.y + Math.sin(angle) * size;
       // Shoot outward perpendicular to edge? Or just spiral? Let's do spiral.
       spawn(cornerX, cornerY, Math.cos(angle), Math.sin(angle), speed, [255, 255, 100]);
    }
  },

  // 12. Rapid Stream (Targeted laser-like stream)
  rapidStream: (p, origin, target, spawn, speed) => {
     // High accuracy, high speed
     const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
     // Add slight jitter
     const jitter = p.random(-0.1, 0.1);
     spawn(origin.x, origin.y, Math.cos(angle + jitter), Math.sin(angle + jitter), speed * 1.5, [255, 150, 0]);
  },

  // 13. Wall Down (Curtain of bullets)
  wallDown: (p, width, spawn, speed) => {
     const gap = 40;
     for(let x = 20; x < width; x += gap) {
         // 20% chance to skip a spot (make a hole to dodge)
         if (p.random() > 0.2) {
             spawn(x, 0, 0, 1, speed * 0.6, [100, 255, 200]);
         }
     }
  },

  // --- HEART BOSS PATTERNS ---

  // 14. Heart Spread (Bullets form a heart shape)
  heartSpread: (p, origin, frame, spawn, speed) => {
    // Parametric heart equation:
    // x = 16sin^3(t)
    // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
    const points = 45; // Increased density
    const rotation = frame * 0.03; 

    // Layer 1: Outer Fast Layer
    for (let i = 0; i < points; i++) {
       const t = p.map(i, 0, points, 0, p.TWO_PI);
       const hx = 16 * Math.pow(Math.sin(t), 3);
       const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
       
       const rotX = hx * Math.cos(rotation) - hy * Math.sin(rotation);
       const rotY = hx * Math.sin(rotation) + hy * Math.cos(rotation);

       const mag = Math.sqrt(rotX*rotX + rotY*rotY);
       const dirX = rotX / mag;
       const dirY = -rotY / mag; 

       spawn(origin.x, origin.y, dirX, dirY, speed, [255, 100, 180]);
    }

    // Layer 2: Inner Slow Layer (creates pulse effect)
    if (frame % 2 === 0) { // Slight staggering
        for (let i = 0; i < points; i++) {
           const t = p.map(i, 0, points, 0, p.TWO_PI);
           const hx = 16 * Math.pow(Math.sin(t), 3);
           const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
           
           // Rotate slightly differently
           const rotX = hx * Math.cos(rotation + 0.5) - hy * Math.sin(rotation + 0.5);
           const rotY = hx * Math.sin(rotation + 0.5) + hy * Math.cos(rotation + 0.5);

           const mag = Math.sqrt(rotX*rotX + rotY*rotY);
           const dirX = rotX / mag;
           const dirY = -rotY / mag; 

           spawn(origin.x, origin.y, dirX, dirY, speed * 0.6, [255, 50, 100]);
        }
    }
  },

  // 15. Panty Shot (Inverted Triangle Spread)
  pantyShot: (p, origin, target, spawn, speed) => {
     const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
     // Fire 5 bullets in a wide spread
     const count = 5;
     for(let i=0; i<count; i++) {
        const offset = p.map(i, 0, count-1, -0.6, 0.6);
        spawn(origin.x, origin.y, Math.cos(angle + offset), Math.sin(angle + offset), speed, [255, 200, 200], 'TRIANGLE');
     }
  },

  // 16. Magazine Stream (Rectangular bullets)
  magazineStream: (p, origin, frame, spawn, speed) => {
     const angle = frame * 0.1;
     spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [255, 255, 255], 'RECT');
     spawn(origin.x, origin.y, Math.cos(angle + p.PI), Math.sin(angle + p.PI), speed, [255, 255, 255], 'RECT');
  },

  // --- OVAL BOSS PATTERNS ---

  // 17. Bounce Spread (Bullets marked to bounce)
  bounceSpread: (p, origin, target, count, spawn, speed, bounces) => {
    const baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
    for (let i = 0; i < count; i++) {
        // Wide spread
        const offset = p.map(i, 0, count - 1, -1.0, 1.0);
        const angle = baseAngle + offset;
        spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [200, 100, 255], 'CIRCLE', bounces);
    }
  },

  // --- HEXAGON BOSS PATTERNS ---
  
  // 18. Hexagon Spin (Fire from 6 vertices)
  hexagonSpin: (p, origin, angle, size, spawn, speed) => {
     for(let i=0; i<6; i++) {
         const vAngle = angle + (p.TWO_PI / 6) * i;
         // Vertex position
         const vx = origin.x + Math.cos(vAngle) * size;
         const vy = origin.y + Math.sin(vAngle) * size;
         // Fire tangent to rotation
         spawn(vx, vy, Math.cos(vAngle), Math.sin(vAngle), speed, [0, 255, 255], 'CIRCLE');
     }
  }
};