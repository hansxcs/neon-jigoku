

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
       spawn(cornerX, cornerY, Math.cos(angle), Math.sin(angle), speed, [255, 255, 100]);
    }
  },

  // 12. Rapid Stream (Targeted laser-like stream)
  rapidStream: (p, origin, target, spawn, speed) => {
     const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
     const jitter = p.random(-0.1, 0.1);
     spawn(origin.x, origin.y, Math.cos(angle + jitter), Math.sin(angle + jitter), speed * 1.5, [255, 150, 0]);
  },

  // 13. Wall Down (Curtain of bullets)
  wallDown: (p, width, spawn, speed) => {
     const gap = 40;
     for(let x = 20; x < width; x += gap) {
         if (p.random() > 0.2) {
             spawn(x, 0, 0, 1, speed * 0.6, [100, 255, 200]);
         }
     }
  },

  // --- HEART BOSS PATTERNS ---

  // 14. Heart Spread
  heartSpread: (p, origin, frame, spawn, speed) => {
    const points = 45; 
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

    // Layer 2: Inner Slow Layer
    if (frame % 2 === 0) { 
        for (let i = 0; i < points; i++) {
           const t = p.map(i, 0, points, 0, p.TWO_PI);
           const hx = 16 * Math.pow(Math.sin(t), 3);
           const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
           
           const rotX = hx * Math.cos(rotation + 0.5) - hy * Math.sin(rotation + 0.5);
           const rotY = hx * Math.sin(rotation + 0.5) + hy * Math.cos(rotation + 0.5);

           const mag = Math.sqrt(rotX*rotX + rotY*rotY);
           const dirX = rotX / mag;
           const dirY = -rotY / mag; 

           spawn(origin.x, origin.y, dirX, dirY, speed * 0.6, [255, 50, 100]);
        }
    }
  },

  // 15. Panty Shot
  pantyShot: (p, origin, target, spawn, speed) => {
     const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
     const count = 5;
     for(let i=0; i<count; i++) {
        const offset = p.map(i, 0, count-1, -0.6, 0.6);
        spawn(origin.x, origin.y, Math.cos(angle + offset), Math.sin(angle + offset), speed, [255, 200, 200], 'TRIANGLE');
     }
  },

  // 16. Magazine Stream
  magazineStream: (p, origin, frame, spawn, speed) => {
     const angle = frame * 0.1;
     spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [255, 255, 255], 'RECT');
     spawn(origin.x, origin.y, Math.cos(angle + p.PI), Math.sin(angle + p.PI), speed, [255, 255, 255], 'RECT');
  },

  magazineCross: (p, origin, frame, spawn, speed) => {
     const angle = frame * 0.08; 
     for(let i=0; i<4; i++) {
         const a = angle + (p.TWO_PI / 4) * i;
         spawn(origin.x, origin.y, Math.cos(a), Math.sin(a), speed, [255, 255, 255], 'RECT');
     }
  },

  // --- OVAL BOSS PATTERNS ---

  // 17. Bounce Spread
  bounceSpread: (p, origin, target, count, spawn, speed, bounces) => {
    const baseAngle = Math.atan2(target.y - origin.y, target.x - origin.x);
    for (let i = 0; i < count; i++) {
        const offset = p.map(i, 0, count - 1, -1.0, 1.0);
        const angle = baseAngle + offset;
        spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [200, 100, 255], 'CIRCLE', bounces);
    }
  },

  // --- HEXAGON BOSS PATTERNS ---
  
  // 18. Hexagon Spin
  hexagonSpin: (p, origin, angle, size, spawn, speed) => {
     for(let i=0; i<6; i++) {
         const vAngle = angle + (p.TWO_PI / 6) * i;
         const vx = origin.x + Math.cos(vAngle) * size;
         const vy = origin.y + Math.sin(vAngle) * size;
         spawn(vx, vy, Math.cos(vAngle), Math.sin(vAngle), speed, [0, 255, 255], 'CIRCLE');
     }
  },

  // --- HOURGLASS BOSS PATTERNS ---
  
  // 19. Hourglass Splash
  hourglassSplash: (p, origin, frame, spawn, speed) => {
      // Fire in X shape
      const angles = [
          Math.sin(frame * 0.1),
          Math.PI + Math.sin(frame * 0.1),
          Math.PI/2 + Math.cos(frame * 0.1),
          -Math.PI/2 + Math.cos(frame * 0.1)
      ];
      angles.forEach(a => {
           spawn(origin.x, origin.y, Math.cos(a), Math.sin(a), speed, [218, 165, 32], 'CIRCLE');
      });
  },

  // 20. Hourglass Spiral (Double Helix-ish)
  hourglassSpiral: (p, origin, frame, spawn, speed) => {
      const a1 = frame * 0.2;
      const a2 = -frame * 0.2 + p.PI;
      spawn(origin.x, origin.y, Math.cos(a1), Math.sin(a1), speed, [255, 223, 0], 'CIRCLE');
      spawn(origin.x, origin.y, Math.cos(a2), Math.sin(a2), speed, [255, 223, 0], 'CIRCLE');
  },
  
  // 21. Sandstorm (Chaotic Particles)
  sandstorm: (p, origin, width, spawn, speed) => {
      const count = 5;
      for(let i=0; i<count; i++) {
          const x = p.random(origin.x - 100, origin.x + 100);
          const y = origin.y + p.random(-20, 20);
          const angle = p.PI/2 + p.random(-0.5, 0.5); // Downwards with spread
          const s = speed * p.random(0.5, 1.5);
          spawn(x, y, Math.cos(angle), Math.sin(angle), s, [238, 232, 170], 'CIRCLE');
      }
  },

  // 22. Timeline Collapse (Walls closing in)
  timelineCollapse: (p, width, height, spawn, speed) => {
      // Left Wall
      for(let y=0; y<height; y+=50) {
          spawn(0, y, 1, 0, speed * 0.5, [184, 134, 11], 'CIRCLE');
      }
      // Right Wall
      for(let y=0; y<height; y+=50) {
          spawn(width, y, -1, 0, speed * 0.5, [184, 134, 11], 'CIRCLE');
      }
  },
  
  // 23. Sand Geyser (Upward streams)
  sandGeyser: (p, width, height, spawn, speed) => {
      const x = p.random(width);
      for(let i=0; i<10; i++) {
          spawn(x + p.random(-10, 10), height, p.random(-0.1, 0.1), -1, speed * p.random(1.0, 1.5), [238, 232, 170], 'CIRCLE');
      }
  },

  // --- MATH BOSS PATTERNS ---

  // 24. Math Plus (Direct Aimed)
  mathPlus: (p, origin, target, count, spawn, speed, accelerating = false) => {
      for(let i=0; i<count; i++) {
          setTimeout(() => {
              const angle = Math.atan2(target.y - origin.y, target.x - origin.x) + p.random(-0.1, 0.1);
              spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed, [50, 50, 255], 'CIRCLE', 0, false, accelerating);
          }, i * 50); // Stagger fire
      }
  },

  // 25. Math Minus (Side Attack)
  mathSide: (p, width, height, yPos, spawn, speed, isHeal) => {
      const color = isHeal ? [0, 255, 0] : [255, 50, 50];
      const type = isHeal ? 'HEAL' : 'CIRCLE';
      // Left Side
      spawn(0, yPos, 1, p.random(-0.2, 0.2), speed, color, type);
      // Right Side
      spawn(width, yPos, -1, p.random(-0.2, 0.2), speed, color, type);
  },

  // 26. Math Divide (Fractal Cluster Shot)
  mathDiv: (p, origin, count, spawn, speed) => {
      // Spawn large "Mother" clusters that split into 4 pieces
      for(let i=0; i<count; i++) {
          const angle = p.random(p.TWO_PI);
          // splitGen: 2 means it splits twice (Parent -> 4 Children -> 16 Grandchildren)
          spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed * 0.4, [100, 200, 255], 'CIRCLE', 0, true);
      }
  },
  
  // 27. Math Power Spiral (Exponential Acceleration)
  mathPowerSpiral: (p, origin, count, spawn, baseSpeed) => {
      // Count is based on power result (e.g., 3^3 = 27, 4^3 = 64)
      const loops = 4; // Number of spiral arms
      for(let i=0; i<count; i++) {
          const t = i / count;
          const angle = t * p.TWO_PI * loops;
          // Spawn extremely slow initially
          spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), 0.5, [255, 100, 50], 'GEOMETRY', 0, false, true, 'TRIANGLE');
      }
  },

  // 28. Matrix Rain (Digital Rain)
  matrixRain: (p, width, count, spawn, speed) => {
      for(let i=0; i<count; i++) {
          const x = p.random(width);
          // Falling rectangles or Binary numbers
          const isZero = p.random() > 0.5;
          const type = 'BINARY'; 
          const color = [0, 255, 70];
          // Determine physics in sketch based on 'isZero' param passed via color or separate logic?
          // We'll treat all as BINARY type in sketch, sketch randomizes 0 or 1
          spawn(x, -50, 0, 1, speed * p.random(1.5, 3.0), color, 'BINARY');
      }
  },

  // 29. Golden Spiral (Fibonacci)
  goldenSpiral: (p, origin, frame, spawn, speed) => {
      // Golden Angle ~ 137.5 degrees ~ 2.39996 radians
      const goldenAngle = 2.39996;
      // Fire multiple bullets per frame to create the dense pattern
      const burst = 2;
      for (let i = 0; i < burst; i++) {
          // Use frame count as index for spiral
          const n = frame * burst + i;
          const angle = n * goldenAngle;
          // We fire OUTWARD from the boss center at this angle
          spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), speed * 0.8, [255, 215, 0], 'CIRCLE');
      }
  },
  
  // 30. Geometry Barrage (Shapes)
  geometryBarrage: (p, origin, target, count, spawn, speed) => {
      for(let i=0; i<count; i++) {
          const type = p.random(['TRIANGLE', 'SQUARE', 'PENTAGON']);
          const angle = p.random(p.TWO_PI);
          let s = speed;
          let col = [255, 100, 50];
          
          if (type === 'TRIANGLE') s = speed * 1.5;
          if (type === 'SQUARE') s = speed * 0.5;
          
          spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), s, col, 'GEOMETRY', 0, false, false, type);
      }
  },
  
  // 31. Math Tangent (Vertical Asymptote Walls)
  mathTangent: (p, width, height, count, spawn, speed) => {
      // Creates rapidly moving vertical streams
      for(let i=0; i<count; i++) {
          const x = p.random(width);
          // Rapid fire column
          for(let y= -100; y < 0; y+=20) {
               spawn(x, y, 0, 1, speed * 2.5, [50, 255, 200], 'RECT');
          }
      }
  },
  
  // 32. Math Riemann (Integral Area Barrage)
  mathRiemann: (p, width, height, frame, spawn, speed) => {
      // Calculates y = sin(x) curve and fills area under it
      if (frame % 5 === 0) {
           const curveOffset = frame * 0.05;
           for(let x=20; x<width; x+=40) {
               // Map Sine wave to screen height
               const sinVal = Math.sin(x * 0.01 + curveOffset);
               const curveY = p.map(sinVal, -1, 1, height, height - 250);
               
               // Spawn a bullet at bottom rising up, but only spawn if random chance
               if (p.random() < 0.1) {
                   spawn(x, height, 0, -1, speed * 0.5, [100, 100, 255], 'RECT');
               }
           }
      }
  },

  // 33. Math Modulo (Grid Stripes)
  mathModulo: (p, width, height, modulus, spawn, speed) => {
      // Creates stripes of bullets based on x % mod
      // We spawn a row at the top
      const stripeWidth = modulus / 2; 
      for(let x=0; x<width; x+=10) {
          // If x falls into the "remainder" zone of the modulus
          if (x % modulus > stripeWidth) {
              spawn(x, -20, 0, 1, speed, [180, 50, 255], 'CIRCLE');
          }
      }
  },

  // 34. Math Factorial (Radial Explosion)
  mathFactorial: (p, origin, count, spawn, speed) => {
      // Massive burst
      for(let i=0; i<count; i++) {
          const angle = p.random(p.TWO_PI);
          const s = speed * p.random(0.5, 2.0); // Variable speed for chaotic expansion
          spawn(origin.x, origin.y, Math.cos(angle), Math.sin(angle), s, [255, 69, 0], 'CIRCLE', 0, false, true);
      }
  }

};