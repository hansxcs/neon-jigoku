
import p5 from 'p5';
import { COLORS, PLAYER_SPEED, PLAYER_RADIUS, BOSS_RADIUS, BOSS_SQUARE_SIZE, BOSS_TRIANGLE_SIZE, BOSS_HEXAGON_SIZE, BOSS_HOURGLASS_SIZE, BOSS_MATH_SIZE, BOSS_MAX_HP, BULLET_SPEED, PLAYER_HITBOX, ENEMY_BULLET_BASE_SPEED, MAX_WEAPON_LEVEL, BASE_BULLET_SPEED_SCALE, OVAL_BOSS_MOVE_SPEED, SHIELD_DURATION, MAX_SHIELD_CHARGES } from '../constants.js';
import { GameState, PowerUpType, WeaponType } from '../types.js';
import { Patterns } from './patterns.js';

export const createSketch = (
  setScore,
  setHealth,
  setBossHealth,
  setGameState,
  setStage,
  setWeaponInfo,
  triggerShieldRef,
  setPlayerStatus,
  bulletSpeedRef,
  targetW,
  targetH
) => {
  return (p) => {
    // --- Game Entities ---
    let gameState = GameState.MENU;
    let score = 0;
    
    // Player
    let player = {
      pos: p.createVector(targetW / 2, targetH - 100),
      hp: 100,
      radius: PLAYER_RADIUS,
      hitbox: PLAYER_HITBOX,
      bullets: [],
      weaponType: WeaponType.DEFAULT,
      weaponLevel: 1, 
      weaponTimer: 0,
      damageMult: 1,
      invulnerable: 0,
      shieldTimer: 0,
      shieldCharges: MAX_SHIELD_CHARGES,
      frozen: false, // If true, input disabled
      freezeTimer: 0
    };

    // Boss
    let boss = {
      pos: p.createVector(targetW / 2, 100),
      vel: p.createVector(3, 2),
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      type: 'CIRCLE', 
      phase: 0,
      radius: BOSS_RADIUS,
      angle: 0, 
      dashState: 'IDLE',
      dashTimer: 0,
      targetPos: null,
      summonTimer: 0, 
      teleportState: 'IDLE',
      teleportTimer: 0,
      opacity: 255,
      laserPhase: 'COOLDOWN',
      laserTimer: 0,
      shield: 0, 
      maxShield: 2000,
      active: true,
      squash: { x: 1, y: 1 },
      squashTimer: 0,
      spinSpeed: 0.05,
      pendingAttacks: [],
      nextPowerUpHp: 0,
      clockHandAngle: 0,
      
      // Hourglass specific
      timeAbilityTimer: 300, // 5 seconds (reduced from 7)
      timeState: 'NORMAL', // NORMAL, STOP, RESUME
      sandFrame: 0,
      targetAngle: 0,
      history: [], // Stores previous positions for Ghost Echo
      pendulum: {
          phase: 0,
          angle: 0,
          length: 450,
          bobR: 35
      },
      fateBeams: [], // Array of active beams
      
      // Math Boss Specific
      mathState: 'SPIN', // SPIN, CALCULATE, ATTACK
      mathTimer: 0,
      operands: [0, 0],
      operator: '+',
      mathResult: 0,
      displayNums: [0, 0], // For animation
      clones: [] // For multiplication attacks
    };

    // Game State Logic
    let currentStageIndex = 0;
    let stageTransitionTimer = 0;
    
    // Time Manipulation Globals
    let globalTimeScale = 1.0; 
    let simTime = 0; // Accumulated simulation time
    let timeRewindCycle = 0;

    // Arrays
    let enemies = [];
    let enemyBullets = [];
    let powerUps = [];
    let particles = [];
    let blockers = []; 
    let sandTraps = [];
    let stasisOrbs = []; // Replaces Time Bombs
    
    // Systems
    let frame = 0;
    let stars = [];

    // --- Setup ---
    p.setup = () => {
      p.createCanvas(targetW, targetH);
      p.frameRate(60);
      
      // Init stars
      for(let i=0; i<100; i++) {
        stars.push({
          x: p.random(p.width), 
          y: p.random(p.height), 
          z: p.random(0.5, 3)
        });
      }

      // Assign Shield Trigger to Ref
      if (triggerShieldRef) {
          triggerShieldRef.current = () => {
              if (player.shieldCharges > 0 && player.shieldTimer <= 0 && gameState === GameState.PLAYING && !player.frozen) {
                  player.shieldCharges--;
                  player.shieldTimer = SHIELD_DURATION;
                  updatePlayerStatus();
              }
          };
      }
    };

    p.touchMoved = () => {
      return false; // Prevent scrolling on mobile
    };

    // --- Reset ---
    const resetGame = (bossType = 'RANDOM') => {
      player.pos = p.createVector(p.width / 2, p.height - 100);
      player.hp = 100;
      player.bullets = [];
      player.weaponType = WeaponType.DEFAULT;
      player.weaponLevel = 1;
      player.weaponTimer = 0;
      player.damageMult = 1;
      player.invulnerable = 0;
      player.shieldTimer = 0;
      player.shieldCharges = MAX_SHIELD_CHARGES;
      player.frozen = false;
      player.freezeTimer = 0;

      boss.hp = BOSS_MAX_HP;
      boss.phase = 0;
      boss.pos = p.createVector(p.width / 2, 100);
      boss.vel = p.createVector(p.random([-OVAL_BOSS_MOVE_SPEED, OVAL_BOSS_MOVE_SPEED]), p.random(OVAL_BOSS_MOVE_SPEED*0.7, OVAL_BOSS_MOVE_SPEED));
      boss.active = true;
      boss.dashState = 'IDLE';
      boss.dashTimer = 0;
      boss.summonTimer = 0;
      boss.teleportState = 'IDLE';
      boss.teleportTimer = 0;
      boss.opacity = 255;
      boss.angle = 0;
      boss.targetAngle = 0;
      boss.shield = 0;
      boss.radius = BOSS_RADIUS;
      boss.laserPhase = 'COOLDOWN';
      boss.laserTimer = 120;
      boss.squash = { x: 1, y: 1 };
      boss.pendingAttacks = [];
      boss.spinSpeed = 0.05;
      boss.nextPowerUpHp = BOSS_MAX_HP * 0.95; 
      boss.timeAbilityTimer = 300;
      boss.timeState = 'NORMAL';
      boss.history = [];
      boss.clockHandAngle = 0;
      boss.pendulum = { phase: 0, angle: 0, length: 450, bobR: 35 };
      boss.fateBeams = [];
      
      boss.mathState = 'SPIN';
      boss.mathTimer = 120; // Start with longer spin
      boss.operands = [0, 0];
      boss.displayNums = [0, 0];
      boss.clones = [];
      
      // Select boss type
      if (bossType !== 'RANDOM') {
          boss.type = bossType;
      } else {
          const bosses = ['CIRCLE', 'SQUARE', 'TRIANGLE', 'HEART', 'OVAL', 'HEXAGON', 'HOURGLASS', 'MATH'];
          boss.type = p.random(bosses);
      }

      currentStageIndex = 0;
      stageTransitionTimer = 0;
      globalTimeScale = 1.0;
      simTime = 0;

      enemies = [];
      enemyBullets = [];
      powerUps = [];
      particles = [];
      blockers = []; 
      sandTraps = [];
      stasisOrbs = [];
      score = 0;
      frame = 0;

      setScore(0);
      setHealth(100);
      setBossHealth(100);
      setStage(1);
      setWeaponInfo({ name: 'DEFAULT', level: 1, timer: 0 });
      updatePlayerStatus();
    };

    const updatePlayerStatus = () => {
        if (setPlayerStatus) {
            setPlayerStatus({
                shieldCharges: player.shieldCharges,
                shieldTimer: Math.ceil(player.shieldTimer / 60)
            });
        }
    };

    // --- Helpers ---
    const spawnEnemyBullet = (x, y, vx, vy, speed, color, shape = 'CIRCLE', bounces = 0, canSplit = false, accelerating = false, subType = null) => {
      let b = {
        pos: p.createVector(x, y),
        vel: p.createVector(vx * speed, vy * speed),
        color: color,
        r: 6,
        shape: shape, 
        angle: 0,
        bounces: bounces,
        canSplit: canSplit,
        splitTimer: canSplit ? p.random(30, 60) : 0,
        splitGen: canSplit ? 2 : 0, // Generations of splitting
        accelerating: accelerating,
        speed: speed,
        subType: subType // For Geometry Barrage or Binary drift
      };
      
      // Binary Bullet Logic: Randomize 0 or 1
      if (shape === 'BINARY') {
          b.text = p.random() > 0.5 ? '1' : '0';
          if (b.text === '1') {
              // '1's drift horizontally
              b.vel.x = p.random(-1, 1);
          }
      }
      
      enemyBullets.push(b);
    };

    const spawnMeteorAttack = (x, y, targetX, targetY, delay = 60, size = 15) => {
        const angle = Math.atan2(targetY - y, targetX - x);
        boss.pendingAttacks.push({
            type: 'METEOR',
            x: x, y: y,
            dx: Math.cos(angle),
            dy: Math.sin(angle),
            timer: delay,
            size: size
        });
    };
    
    const spawnStasisOrb = () => {
        stasisOrbs.push({
            x: p.random(50, p.width-50),
            y: p.random(50, 200),
            vx: p.random(-1, 1),
            vy: p.random(1, 2),
            radius: 20
        });
    };

    const spawnMinion = (forcedType = null, forcedX = null, forcedY = null, parent = null) => {
      if (enemies.length >= 25) return; 

      const type = forcedType || (p.random() > 0.5 ? 'drone' : 'swooper');
      const x = forcedX !== null ? forcedX : p.random(50, p.width - 50);
      const y = forcedY !== null ? forcedY : -30;
      
      let hp = 30;
      let radius = 15;
      let scoreVal = 100;

      if (type === 'drone') hp = 30;
      if (type === 'swooper') hp = 20;
      if (type === 'orbiter') { hp = 60; radius = 10; }
      if (type === 'mini_boss') { hp = 500; radius = 30; scoreVal = 1000; }
      if (type === 'lust_orb') { hp = 1200; radius = 100; scoreVal = 2000; }

      enemies.push({
        pos: p.createVector(x, y),
        vel: p.createVector(0, 0),
        hp: hp,
        maxHp: hp,
        radius: radius,
        type: type,
        shootTimer: p.random(60, 120),
        orbitAngle: p.random(p.TWO_PI), 
        parent: parent, 
        scoreVal: scoreVal
      });
    };

    const spawnPowerUp = (x, y, guaranteedType) => {
      let type;
      let isTrap = false;
      
      if (boss.type === 'HEART' && p.random() < 0.3) {
          isTrap = true;
          type = PowerUpType.HEAL; 
      } else if (guaranteedType !== undefined) {
        type = guaranteedType;
      } else {
        const r = p.random();
        if (r < 0.25) type = PowerUpType.SPREAD;
        else if (r < 0.5) type = PowerUpType.RAPID;
        else if (r < 0.75) type = PowerUpType.HOMING;
        else type = PowerUpType.HEAL;
      }
      // Constrain spawn to screen
      const cx = p.constrain(x, 20, p.width - 20);
      powerUps.push({ x: cx, y, type, radius: 10, active: true, trap: isTrap });
    };

    const createExplosion = (x, y, color, count) => {
      for(let i=0; i<count; i++) {
        const angle = p.random(p.TWO_PI);
        const speed = p.random(1, 4);
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color: color,
          size: p.random(2, 5)
        });
      }
    };

    const checkBlockerCollision = (x, y, r) => {
        for (let b of blockers) {
            const halfW = b.w / 2 + r;
            const halfH = b.h / 2 + r;
            if (x > b.pos.x - halfW && x < b.pos.x + halfW &&
                y > b.pos.y - halfH && y < b.pos.y + halfH) {
                return true;
            }
        }
        return false;
    };
    
    const lineCircleIntersect = (x1, y1, x2, y2, cx, cy, r) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx*dx + dy*dy;
        const t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
        const closestX = x1 + Math.max(0, Math.min(1, t)) * dx;
        const closestY = y1 + Math.max(0, Math.min(1, t)) * dy;
        const distSq = (cx - closestX)*(cx - closestX) + (cy - closestY)*(cy - closestY);
        return distSq < r*r;
    };

    const drawLightningHex = (px, py, radius, angle, color) => {
        p.push();
        p.translate(px, py);
        p.rotate(angle);
        p.stroke(color);
        p.strokeWeight(3);
        p.noFill();
        p.beginShape();
        for(let i=0; i<6; i++) {
            let a1 = p.TWO_PI / 6 * i;
            let a2 = p.TWO_PI / 6 * (i+1);
            let x1 = Math.cos(a1) * radius;
            let y1 = Math.sin(a1) * radius;
            let x2 = Math.cos(a2) * radius;
            let y2 = Math.sin(a2) * radius;
            p.vertex(x1, y1);
            let mx = (x1 + x2) / 2 + p.random(-5, 5);
            let my = (y1 + y2) / 2 + p.random(-5, 5);
            p.vertex(mx, my);
        }
        p.endShape(p.CLOSE);
        if (frame % 5 === 0) {
            p.stroke(255, 200);
            p.strokeWeight(1);
            p.line(p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius));
        }
        p.pop();
    };

    const drawGlitch = () => {
        // Randomly offset slices of the canvas
        const slices = 5;
        for(let i=0; i<slices; i++) {
            const y = p.random(p.height);
            const h = p.random(10, 50);
            const offset = p.random(-20, 20);
            p.image(p.get(0, y, p.width, h), offset, y);
            
            // Random rectangles
            p.fill(p.random([COLORS.BOSS_HOURGLASS, 255]), p.random(100));
            p.noStroke();
            p.rect(p.random(p.width), p.random(p.height), p.random(50), p.random(10));
        }
    };

    // --- Draw Loop ---
    p.draw = () => {
      p.background(COLORS.BACKGROUND, 100);

      // Camera Shake
      let shaking = stageTransitionTimer > 150;
      // Extra shake for hourglass shockwave
      if (boss.type === 'HOURGLASS' && (boss.timeState === 'STOPPED' || boss.timeState === 'RESUME') && frame % 4 === 0) {
          shaking = true;
      }
      
      if (shaking) {
          p.push();
          p.translate(p.random(-8, 8), p.random(-8, 8));
      }

      // Draw Stars
      p.noStroke();
      p.fill(255, 100);
      for(let star of stars) {
        star.y += star.z;
        if(star.y > p.height) {
           star.y = 0;
           star.x = p.random(p.width);
        }
        p.circle(star.x, star.y, star.z);
      }

      if (gameState === GameState.MENU || gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
        if (shaking) p.pop();
        return;
      }

      frame++;
      simTime += globalTimeScale; // Accumulated simulation time
      
      // Update Shield Timer
      if (player.shieldTimer > 0) {
          player.shieldTimer--;
          if (frame % 30 === 0) updatePlayerStatus();
      }

      // Update Freeze Timer
      if (player.freezeTimer > 0) {
          player.freezeTimer--;
          if (player.freezeTimer <= 0) {
              player.frozen = false;
          }
      }

      // --- 1. Player Movement ---
      let dx = 0;
      let dy = 0;
      let inputDetected = false;
      let speedMult = 1.0;

      // Check Sand Traps
      for (let trap of sandTraps) {
          if (p.dist(player.pos.x, player.pos.y, trap.x, trap.y) < trap.r + PLAYER_RADIUS) {
              speedMult = 0.3;
              break;
          }
      }

      // Only allow movement if not frozen
      if (!player.frozen) {
          // Keyboard
          if (p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(65)) { dx -= PLAYER_SPEED * speedMult; inputDetected = true; }
          if (p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(68)) { dx += PLAYER_SPEED * speedMult; inputDetected = true; }
          if (p.keyIsDown(p.UP_ARROW) || p.keyIsDown(87)) { dy -= PLAYER_SPEED * speedMult; inputDetected = true; }
          if (p.keyIsDown(p.DOWN_ARROW) || p.keyIsDown(83)) { dy += PLAYER_SPEED * speedMult; inputDetected = true; }
          if (p.keyIsDown(32)) { // Spacebar for Shield
              if (triggerShieldRef && triggerShieldRef.current) triggerShieldRef.current();
          }

          // Mouse/Touch with Responsive Scaling
          if (!inputDetected) {
            let targetX = player.pos.x;
            let targetY = player.pos.y;
            
            const canvasRect = p.canvas.getBoundingClientRect();
            const scaleX = p.width / canvasRect.width;
            const scaleY = p.height / canvasRect.height;
            
            if (p.touches.length > 0) {
               let t = p.touches[0];
               targetX = (t.x - canvasRect.left) * scaleX;
               // Offset Y slightly up so finger doesn't cover ship, especially on mobile
               targetY = (t.y - canvasRect.top) * scaleY - 60; 
            } else if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
               targetX = p.mouseX * (p.width / p.width); // Redundant calc simplified
               targetY = p.mouseY * (p.height / p.height);
            }
            dx = (targetX - player.pos.x) * 0.2 * speedMult;
            dy = (targetY - player.pos.y) * 0.2 * speedMult;
          }
      }

      let nextX = player.pos.x + dx;
      if (!checkBlockerCollision(nextX, player.pos.y, PLAYER_RADIUS)) player.pos.x = nextX;
      let nextY = player.pos.y + dy;
      if (!checkBlockerCollision(player.pos.x, nextY, PLAYER_RADIUS)) player.pos.y = nextY;

      player.pos.x = p.constrain(player.pos.x, PLAYER_RADIUS, p.width - PLAYER_RADIUS);
      player.pos.y = p.constrain(player.pos.y, PLAYER_RADIUS, p.height - PLAYER_RADIUS);

      // --- 2. Weapon & Shooting ---
      if (player.weaponTimer > 0) {
        player.weaponTimer--;
        if (player.weaponTimer <= 0) {
          player.weaponType = WeaponType.DEFAULT;
          player.weaponLevel = 1;
        }
      }
      
      if (frame % 10 === 0) {
        const getWeaponName = (t) => {
             const entry = Object.entries(WeaponType).find(([k, v]) => v === t);
             return entry ? entry[0] : 'DEFAULT';
        }
        setWeaponInfo({
            name: getWeaponName(player.weaponType),
            level: player.weaponLevel,
            timer: Math.ceil(player.weaponTimer / 60)
        });
      }

      // Player cannot shoot if frozen
      if (!player.frozen) {
          let fireRate = 8;
          if (player.weaponType === WeaponType.RAPID) fireRate = Math.max(2, 5 - player.weaponLevel); 

          if (frame % fireRate === 0) {
            const type = player.weaponType;
            const lvl = player.weaponLevel;
            
            if (type === WeaponType.DEFAULT) {
                if (lvl === 1) {
                    player.bullets.push({ pos: player.pos.copy().add(-5, -10), vel: p.createVector(0, -BULLET_SPEED), dmg: 10, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(5, -10), vel: p.createVector(0, -BULLET_SPEED), dmg: 10, homing: false });
                } else if (lvl === 2) {
                    player.bullets.push({ pos: player.pos.copy().add(0, -10), vel: p.createVector(0, -BULLET_SPEED), dmg: 10, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(-8, -5), vel: p.createVector(-1, -BULLET_SPEED), dmg: 10, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(8, -5), vel: p.createVector(1, -BULLET_SPEED), dmg: 10, homing: false });
                } else {
                    player.bullets.push({ pos: player.pos.copy().add(-5, -10), vel: p.createVector(0, -BULLET_SPEED), dmg: 10, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(5, -10), vel: p.createVector(0, -BULLET_SPEED), dmg: 10, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(-12, -5), vel: p.createVector(-2, -BULLET_SPEED), dmg: 10, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(12, -5), vel: p.createVector(2, -BULLET_SPEED), dmg: 10, homing: false });
                }
            } else if (type === WeaponType.RAPID) {
                 player.bullets.push({ pos: player.pos.copy().add(0, -10), vel: p.createVector(0, -BULLET_SPEED * 1.5), dmg: 8, homing: false });
                 if (lvl >= 3) {
                    player.bullets.push({ pos: player.pos.copy().add(-10, 0), vel: p.createVector(0, -BULLET_SPEED), dmg: 6, homing: false });
                    player.bullets.push({ pos: player.pos.copy().add(10, 0), vel: p.createVector(0, -BULLET_SPEED), dmg: 6, homing: false });
                 }
            } else if (type === WeaponType.SPREAD) {
                const count = 3 + (lvl * 2); 
                const spread = 0.2 + (lvl * 0.1);
                for(let i=0; i<count; i++) {
                    const angle = -p.PI/2 + (i - (count-1)/2) * spread;
                    player.bullets.push({ 
                        pos: player.pos.copy().add(0, -10), 
                        vel: p.createVector(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED), 
                        dmg: 8,
                        homing: false
                    });
                }
            } else if (type === WeaponType.HOMING) {
                const count = 1 + (lvl * 2);
                for(let i=0; i<count; i++) {
                    const angle = -p.PI/2 + p.random(-0.5, 0.5);
                    player.bullets.push({ 
                        pos: player.pos.copy().add(0, -10), 
                        vel: p.createVector(Math.cos(angle) * BULLET_SPEED * 0.5, Math.sin(angle) * BULLET_SPEED * 0.5), 
                        dmg: 12,
                        homing: true
                    });
                }
            }
          }
      }

      // --- 3. Boss Logic ---
      if (boss.active) {
        
        const healthPct = boss.hp / BOSS_MAX_HP;
        let calculatedStage = 0;
        if (healthPct < 0.2) calculatedStage = 4;
        else if (healthPct < 0.4) calculatedStage = 3;
        else if (healthPct < 0.6) calculatedStage = 2;
        else if (healthPct < 0.8) calculatedStage = 1;
        
        if (calculatedStage > currentStageIndex) {
            currentStageIndex = calculatedStage;
            setStage(currentStageIndex + 1);
            stageTransitionTimer = 180; 
            enemyBullets = [];
            stasisOrbs = [];
            let exColor = COLORS.BOSS_CIRCLE;
            if (boss.type === 'SQUARE') exColor = COLORS.BOSS_SQUARE;
            if (boss.type === 'TRIANGLE') exColor = COLORS.BOSS_TRIANGLE;
            if (boss.type === 'HEART') exColor = COLORS.BOSS_HEART;
            if (boss.type === 'OVAL') exColor = COLORS.BOSS_OVAL;
            if (boss.type === 'HEXAGON') exColor = COLORS.BOSS_HEXAGON;
            if (boss.type === 'HOURGLASS') exColor = COLORS.BOSS_HOURGLASS;
            if (boss.type === 'MATH') exColor = COLORS.BOSS_MATH;

            createExplosion(boss.pos.x, boss.pos.y, exColor, 40);

            // Special Stage Start Logics
            if (boss.type === 'HEART') {
                if (currentStageIndex === 3) { // Stage 4: Lust Orbs
                    spawnMinion('lust_orb', 100, 100);
                    spawnMinion('lust_orb', p.width - 100, 100);
                }
                if (currentStageIndex === 4) { // Stage 5: Shield + Grow
                    boss.shield = boss.maxShield;
                    boss.radius = BOSS_RADIUS * 1.5;
                }
            }
            if (boss.type === 'OVAL') {
                let speedMult = 1 + (currentStageIndex * 0.25);
                if (boss.vel.x > 0) boss.vel.x = OVAL_BOSS_MOVE_SPEED * speedMult; else boss.vel.x = -OVAL_BOSS_MOVE_SPEED * speedMult;
                if (boss.vel.y > 0) boss.vel.y = OVAL_BOSS_MOVE_SPEED * 0.7 * speedMult; else boss.vel.y = -OVAL_BOSS_MOVE_SPEED * 0.7 * speedMult;
            }
            if (boss.type === 'HEXAGON') {
                boss.spinSpeed = 0.05 + (currentStageIndex * 0.05);
            }
            if (boss.type === 'HOURGLASS') {
                // STAGE 5 NORMAL SPEED, HIGH DENSITY
                if (currentStageIndex >= 4) {
                    // Activate Dual Fate Beams
                    boss.fateBeams = [
                        { active: false, x: 0, width: 0, damage: 2, orientation: 'V' },
                        { active: false, y: 0, width: 0, damage: 2, orientation: 'H' }
                    ];
                }
            }
        }

        // --- GLOBAL BULLET SPEED SCALING ---
        const userSpeedScale = bulletSpeedRef && bulletSpeedRef.current ? bulletSpeedRef.current : 1.0;
        let baseSpeed = (ENEMY_BULLET_BASE_SPEED + (currentStageIndex * 0.5)) * BASE_BULLET_SPEED_SCALE * userSpeedScale;
        
        // --- BOSS MOVEMENT & BEHAVIOR ---
        if (boss.type === 'CIRCLE') {
            boss.pos.x = p.width / 2 + Math.sin(frame * 0.02) * 150;
            boss.pos.y = 100 + Math.sin(frame * 0.05) * 20;
            
            if (stageTransitionTimer < 140) {
                 if (frame % 60 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 2);
                 if (currentStageIndex >= 0 && frame % 10 === 0) Patterns.spiral(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                 if (currentStageIndex >= 1) if (frame % 120 === 0) Patterns.ring(p, boss.pos, 12 + currentStageIndex * 2, spawnEnemyBullet, baseSpeed * 0.8);
                 if (currentStageIndex >= 2) if (frame % 90 === 0) Patterns.spread(p, boss.pos, player.pos, 5, p.PI/3, spawnEnemyBullet, baseSpeed);
                 if (currentStageIndex >= 3) if (frame % 5 === 0) Patterns.cross(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                 if (currentStageIndex >= 4) if (frame % 60 === 0) Patterns.converge(p, player.pos, p.width, p.height, spawnEnemyBullet, baseSpeed * 0.5);
            }

        } else if (boss.type === 'SQUARE') {
            boss.angle += 0.02; 
            switch(boss.dashState) {
                case 'IDLE':
                    boss.pos.x = p.lerp(boss.pos.x, p.width/2 + Math.sin(frame * 0.01) * 100, 0.05);
                    boss.pos.y = p.lerp(boss.pos.y, 100 + Math.cos(frame * 0.03) * 20, 0.05);
                    if (currentStageIndex >= 1 && p.random() < 0.01) {
                         boss.dashState = 'CHARGE';
                         boss.dashTimer = 60;
                         const trapSize = 250;
                         const wallThick = 20;
                         const px = player.pos.x;
                         const py = player.pos.y;
                         blockers.push({ pos: p.createVector(px, py - trapSize/2), w: trapSize, h: wallThick });
                         blockers.push({ pos: p.createVector(px, py + trapSize/2), w: trapSize, h: wallThick });
                         blockers.push({ pos: p.createVector(px - trapSize/2, py), w: wallThick, h: trapSize });
                         blockers.push({ pos: p.createVector(px + trapSize/2, py), w: wallThick, h: trapSize });
                    }
                    break;
                case 'CHARGE':
                    boss.dashTimer--;
                    boss.pos.x += p.random(-2, 2);
                    boss.pos.y += p.random(-2, 2);
                    p.stroke(255, 0, 0, 100);
                    p.line(boss.pos.x, boss.pos.y, player.pos.x, player.pos.y);
                    if (boss.dashTimer <= 0) {
                        boss.dashState = 'DASH';
                        boss.dashTimer = 30;
                        let v = p5.Vector.sub(player.pos, boss.pos);
                        v.setMag(15);
                        boss.targetPos = v;
                    }
                    break;
                case 'DASH':
                    boss.dashTimer--;
                    boss.pos.add(boss.targetPos);
                    particles.push({
                         x: boss.pos.x, y: boss.pos.y,
                         vx: p.random(-1,1), vy: p.random(-1,1),
                         life: 0.5, color: COLORS.BOSS_SQUARE, size: 20
                    });
                    if (boss.dashTimer <= 0) {
                        boss.dashState = 'RECOVER';
                        boss.dashTimer = 60;
                    }
                    break;
                case 'RECOVER':
                    boss.dashTimer--;
                    boss.pos.x = p.lerp(boss.pos.x, p.width/2, 0.05);
                    boss.pos.y = p.lerp(boss.pos.y, 100, 0.05);
                    if (boss.dashTimer <= 0) {
                        boss.dashState = 'IDLE';
                        blockers = []; 
                    }
                    break;
            }

            if (stageTransitionTimer < 140 && boss.dashState !== 'DASH') {
                if (currentStageIndex >= 0) if (frame % 8 === 0) Patterns.squareSpiral(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                if (currentStageIndex >= 1) if (frame % 40 === 0) Patterns.rapidStream(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 3);
                if (currentStageIndex >= 2) if (frame % 100 === 0) Patterns.wallDown(p, p.width, spawnEnemyBullet, baseSpeed * 0.8);
                if (currentStageIndex >= 3) if (frame % 30 === 0) Patterns.spread(p, boss.pos, player.pos, 7, p.PI/2, spawnEnemyBullet, baseSpeed);
                if (currentStageIndex >= 4) if (frame % 10 === 0) Patterns.chaos(p, boss.pos, spawnEnemyBullet, baseSpeed + 2);
            }

        } else if (boss.type === 'TRIANGLE') {
             boss.angle -= 0.02; 
            boss.summonTimer++;
            if (boss.teleportState === 'IDLE') {
                boss.pos.x = p.width / 2 + Math.sin(frame * 0.03) * 200;
                boss.pos.y = 80 + Math.abs(Math.sin(frame * 0.04)) * 50;
                if (frame % 300 === 0) {
                    boss.teleportState = 'OUT';
                    boss.teleportTimer = 30;
                }
            } else if (boss.teleportState === 'OUT') {
                boss.opacity -= 8;
                if (boss.opacity <= 0) {
                    boss.opacity = 0;
                    boss.teleportState = 'WAIT';
                    boss.teleportTimer = 20;
                    boss.pos.x = p.random(100, p.width - 100);
                    boss.pos.y = p.random(50, 200);
                }
            } else if (boss.teleportState === 'WAIT') {
                boss.teleportTimer--;
                if (boss.teleportTimer <= 0) boss.teleportState = 'IN';
            } else if (boss.teleportState === 'IN') {
                boss.opacity += 8;
                if (boss.opacity >= 255) {
                    boss.opacity = 255;
                    boss.teleportState = 'IDLE';
                }
            }
            if (currentStageIndex >= 2 && boss.opacity > 200) {
                boss.laserTimer--;
                if (boss.laserTimer <= 0) {
                    if (boss.laserPhase === 'COOLDOWN') {
                        boss.laserPhase = 'CHARGE';
                        boss.laserTimer = 60; 
                    } else if (boss.laserPhase === 'CHARGE') {
                        boss.laserPhase = 'FIRE';
                        boss.laserTimer = 90; 
                    } else {
                        boss.laserPhase = 'COOLDOWN';
                        boss.laserTimer = 120;
                    }
                }

                if (boss.laserPhase !== 'COOLDOWN') {
                    const s = BOSS_TRIANGLE_SIZE;
                    for(let i=0; i<3; i++) {
                        const angle = boss.angle + (p.TWO_PI/3)*i - p.PI/2;
                        const vx = boss.pos.x + Math.cos(angle) * s;
                        const vy = boss.pos.y + Math.sin(angle) * s;
                        const laserLen = 1000;
                        const lx = vx + Math.cos(angle) * laserLen;
                        const ly = vy + Math.sin(angle) * laserLen;
                        
                        if (boss.laserPhase === 'CHARGE') {
                            p.stroke(COLORS.BOSS_LASER[0], COLORS.BOSS_LASER[1], COLORS.BOSS_LASER[2], 100);
                            p.strokeWeight(2);
                            p.drawingContext.setLineDash([10, 10]); 
                            p.line(vx, vy, lx, ly);
                            p.drawingContext.setLineDash([]);
                        } else if (boss.laserPhase === 'FIRE') {
                            p.stroke(COLORS.BOSS_LASER);
                            p.strokeWeight(6);
                            p.line(vx, vy, lx, ly);
                            p.strokeWeight(2);
                            p.stroke(255);
                            p.line(vx, vy, lx, ly);
                            if (lineCircleIntersect(vx, vy, lx, ly, player.pos.x, player.pos.y, PLAYER_HITBOX + 6)) {
                                if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
                                    player.hp -= 3;
                                    setHealth(player.hp);
                                    createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 1);
                                }
                            }
                        }
                    }
                }
            }
            if (stageTransitionTimer < 140 && boss.opacity > 200) {
                if (frame % 30 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 4); 
                if (currentStageIndex >= 0) {
                    if (boss.summonTimer % 100 === 0) { 
                        spawnMinion('drone', boss.pos.x + 50, boss.pos.y);
                        spawnMinion('drone', boss.pos.x - 50, boss.pos.y);
                        p.noFill(); p.stroke(255); p.circle(boss.pos.x, boss.pos.y, 100); 
                    }
                }
                if (currentStageIndex >= 1) {
                    if (boss.summonTimer % 120 === 60) spawnMinion('swooper', boss.pos.x, boss.pos.y + 50); 
                    if (frame % 40 === 0) Patterns.spread(p, boss.pos, player.pos, 3, p.PI/4, spawnEnemyBullet, baseSpeed);
                }
                if (currentStageIndex >= 2) {
                     if (boss.summonTimer % 180 === 100) { 
                         for(let i=0; i<3; i++) spawnMinion('orbiter', boss.pos.x, boss.pos.y, boss);
                     }
                }
                if (currentStageIndex >= 3) {
                     const miniBossCount = enemies.filter(e => e.type === 'mini_boss').length;
                     if (miniBossCount < 5 && boss.summonTimer % 150 === 0) spawnMinion('mini_boss', boss.pos.x, boss.pos.y); 
                }
                if (currentStageIndex >= 4) {
                     if (frame % 5 === 0) Patterns.flower(p, boss.pos, frame, 5, spawnEnemyBullet, baseSpeed); 
                     if (boss.summonTimer % 45 === 0) spawnMinion(p.random(['drone', 'swooper'])); 
                }
            }

        } else if (boss.type === 'HEART') {
             boss.pos.x = p.width / 2 + Math.sin(frame * 0.02) * 100;
            boss.pos.y = 120 + Math.sin(frame * 0.04) * 30;
            if (stageTransitionTimer < 140) {
                if (currentStageIndex >= 0) if (frame % 60 === 0) Patterns.heartSpread(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                if (currentStageIndex >= 1) if (frame % 60 === 0) Patterns.pantyShot(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 1);
                if (currentStageIndex >= 2) if (frame % 5 === 0) Patterns.magazineStream(p, boss.pos, frame, spawnEnemyBullet, baseSpeed + 2);
                if (currentStageIndex >= 3) if (frame % 40 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed);
                if (currentStageIndex >= 4) {
                     if (frame % 20 === 0) Patterns.chaos(p, boss.pos, spawnEnemyBullet, baseSpeed + 3);
                     if (frame % 90 === 0) Patterns.heartSpread(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                     if (frame % 15 === 0) Patterns.magazineCross(p, boss.pos, frame, spawnEnemyBullet, baseSpeed + 2);
                }
            }

        } else if (boss.type === 'OVAL') {
             boss.pos.add(boss.vel);
            boss.squash.x = p.lerp(boss.squash.x, 1, 0.1);
            boss.squash.y = p.lerp(boss.squash.y, 1, 0.1);
            const rX = 60; const rY = 40; let bounced = false;
            if (boss.pos.x < rX || boss.pos.x > p.width - rX) {
                boss.vel.x *= -1; boss.pos.x = p.constrain(boss.pos.x, rX, p.width - rX);
                createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_OVAL, 10);
                boss.squash.x = 0.6; boss.squash.y = 1.4; bounced = true;
            }
            if (boss.pos.y < rY || boss.pos.y > p.height - rY) {
                boss.vel.y *= -1; boss.pos.y = p.constrain(boss.pos.y, rY, p.height - rY);
                createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_OVAL, 10);
                boss.squash.x = 1.4; boss.squash.y = 0.6; bounced = true;
            }
            if (bounced && currentStageIndex >= 4) Patterns.ring(p, boss.pos, 16, (x, y, vx, vy, s, c) => spawnEnemyBullet(x, y, vx, vy, s, c, 'CIRCLE', 1), baseSpeed * 1.5);
            if (stageTransitionTimer < 140) {
                if (currentStageIndex >= 0 && frame % 50 === 0) Patterns.aimed(p, boss.pos, player.pos, (x, y, vx, vy, s, c) => spawnEnemyBullet(x, y, vx, vy, s, c, 'CIRCLE', 1), baseSpeed);
                if (currentStageIndex >= 1 && frame % 90 === 0) {
                    const angleOffset = frame * 0.05;
                    for (let i = 0; i < 10; i++) {
                        const angle = (p.TWO_PI / 10) * i + angleOffset;
                        spawnEnemyBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 1);
                    }
                }
                if (currentStageIndex >= 2 && frame % 120 === 0) {
                     for(let i=0; i<3; i++) {
                         let angle = p.random(p.TWO_PI);
                         spawnEnemyBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed * 0.7, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 3);
                     }
                }
                if (currentStageIndex >= 3 && frame % 60 === 0) Patterns.bounceSpread(p, boss.pos, player.pos, 5, spawnEnemyBullet, baseSpeed + 2, 2);
                if (currentStageIndex >= 4 && frame % 8 === 0) {
                    let angle = Math.atan2(player.pos.y - boss.pos.y, player.pos.x - boss.pos.x) + p.random(-0.5, 0.5);
                    spawnEnemyBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed + 4, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 3);
                }
            }

        } else if (boss.type === 'HEXAGON') {
             boss.angle += boss.spinSpeed;
             if (!boss.hexState) boss.hexState = 'IDLE';
             if (!boss.hexTimer) boss.hexTimer = 0;
             switch(boss.hexState) {
                case 'IDLE':
                    if (currentStageIndex >= 1) { 
                        boss.hexTimer++;
                        let teleportThreshold = 180;
                        if (currentStageIndex >= 3) teleportThreshold = 90;
                        if (currentStageIndex >= 4) teleportThreshold = 45; 
                        if (boss.hexTimer > teleportThreshold) { boss.hexState = 'TELEPORT_OUT'; boss.hexTimer = 0; createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 10); }
                    }
                    boss.pos.y += Math.sin(frame * 0.1) * 2;
                    break;
                case 'TELEPORT_OUT':
                    boss.hexState = 'TELEPORT_IN';
                    let nx = p.random(100, p.width - 100);
                    let ny = p.random(50, 250);
                    if (currentStageIndex >= 4) ny = p.random(50, 400); 
                    boss.pos.x = nx; boss.pos.y = ny;
                    break;
                case 'TELEPORT_IN':
                     createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 15);
                     // Spawn a targeted meteor from off-screen instead of shooting directly
                     if (currentStageIndex >= 1) {
                         const angle = p.random(p.TWO_PI);
                         const dist = 500;
                         const sx = player.pos.x + Math.cos(angle) * dist;
                         const sy = player.pos.y + Math.sin(angle) * dist;
                         spawnMeteorAttack(sx, sy, player.pos.x, player.pos.y, 30, 30);
                     }
                     boss.hexState = 'IDLE'; boss.hexTimer = 0;
                    break;
             }
             if (currentStageIndex >= 4 && frame % 300 < 100) { boss.pos.x = p.lerp(boss.pos.x, p.width/2, 0.1); boss.pos.y = p.lerp(boss.pos.y, p.height/2 - 100, 0.1); }
             if (stageTransitionTimer < 140) {
                 for (let i = boss.pendingAttacks.length - 1; i >= 0; i--) {
                     let atk = boss.pendingAttacks[i];
                     atk.timer--;
                     p.stroke(COLORS.BOSS_METEOR);
                     p.strokeWeight(Math.max(1, 4 * (1 - atk.timer/60))); 
                     if (atk.timer % 10 < 5) p.stroke(COLORS.BOSS_LIGHTNING); 
                     let segments = 10; let lx = atk.x; let ly = atk.y; let tx = atk.x + atk.dx * 1200; let ty = atk.y + atk.dy * 1200;
                     p.noFill(); p.beginShape(); p.vertex(lx, ly);
                     for(let j=1; j<segments; j++) { let t = j/segments; let px = p.lerp(lx, tx, t); let py = p.lerp(ly, ty, t); px += p.random(-5, 5); py += p.random(-5, 5); p.vertex(px, py); }
                     p.vertex(tx, ty); p.endShape();
                     if (atk.timer <= 0) {
                         spawnEnemyBullet(atk.x, atk.y, atk.dx, atk.dy, baseSpeed * 6, COLORS.BOSS_METEOR, 'METEOR');
                         boss.pendingAttacks.splice(i, 1);
                         createExplosion(atk.x, atk.y, COLORS.BOSS_METEOR, 5);
                         if (currentStageIndex >= 3) stageTransitionTimer = 5; 
                     }
                 }
                 if (currentStageIndex >= 0 && frame % 20 === 0) Patterns.hexagonSpin(p, boss.pos, boss.angle, BOSS_HEXAGON_SIZE, spawnEnemyBullet, baseSpeed * 1.5);
                 
                 // STAGE 1: Basic Meteor Rain (Replaces aimed stream)
                 if (currentStageIndex === 1 && frame % 50 === 0) {
                     const sx = p.random(p.width);
                     spawnMeteorAttack(sx, -50, sx, p.height, 50, 25);
                 }
                 
                 // STAGE 2+: Heavier Meteor Rain
                 if (currentStageIndex >= 2 && frame % 25 === 0) { const startX1 = p.random(0, p.width); spawnMeteorAttack(startX1, -50, startX1, p.height, 40, 25); const startX2 = p.random(0, p.width); spawnMeteorAttack(startX2, -50, startX2, p.height, 40, 25); }
                 
                 // STAGE 3+: Cross Grid
                 if (currentStageIndex >= 3 && frame % 50 === 0) { spawnMeteorAttack(-50, player.pos.y, p.width, player.pos.y, 40, 20); spawnMeteorAttack(player.pos.x, -50, player.pos.x, p.height, 40, 20); }
                 
                 // STAGE 4+: Overload
                 if (currentStageIndex >= 4 && frame % 10 === 0) { const angle = p.random(p.TWO_PI); const dist = 600; const sx = p.width/2 + Math.cos(angle) * dist; const sy = p.height/2 + Math.sin(angle) * dist; spawnMeteorAttack(sx, sy, player.pos.x, player.pos.y, 30, 30); }
             }

        } else if (boss.type === 'HOURGLASS') {
            boss.pos.x = p.width / 2 + Math.sin(frame * 0.01) * 100;
            boss.pos.y = 120 + Math.cos(frame * 0.02) * 20;
            
            // Record History for Echo
            boss.history.push({ x: boss.pos.x, y: boss.pos.y, angle: boss.angle });
            if (boss.history.length > 30) boss.history.shift(); // Reduced history for tighter echo
            
            // --- PENDULUM LOGIC (Stage 2+) ---
            if (currentStageIndex >= 1) {
                // Pendulum moves based on accumulated simTime (so it freezes with time stop)
                boss.pendulum.phase += 0.03 * globalTimeScale;
                boss.pendulum.angle = Math.sin(boss.pendulum.phase) * (Math.PI/4);
                
                // Draw Pendulum
                p.push();
                p.translate(p.width/2, -50); // Anchor at top center
                p.rotate(boss.pendulum.angle);
                
                // Draw Chain
                p.stroke(COLORS.BOSS_PENDULUM);
                p.strokeWeight(4);
                p.line(0, 0, 0, boss.pendulum.length);
                
                // Pendulum Sand Trail
                if (globalTimeScale > 0 && frame % 5 === 0) {
                     // FIX: In p5 rotation, + rotation moves Y axis to negative X. So we need to subtract sin(angle)
                     const worldX = p.width/2 - Math.sin(boss.pendulum.angle) * boss.pendulum.length;
                     const worldY = -50 + Math.cos(boss.pendulum.angle) * boss.pendulum.length;
                     spawnEnemyBullet(worldX, worldY, p.random(-0.2, 0.2), 0.5, baseSpeed, COLORS.BOSS_BULLET_SAND, 'CIRCLE');
                }
                
                // Draw Bob (Blade)
                p.translate(0, boss.pendulum.length);
                p.fill(200); // Silver Blade
                p.stroke(255);
                p.strokeWeight(2);
                p.beginShape();
                p.vertex(0, -boss.pendulum.bobR);
                p.bezierVertex(boss.pendulum.bobR*1.5, 0, boss.pendulum.bobR*1.5, boss.pendulum.bobR, 0, boss.pendulum.bobR*1.5);
                p.bezierVertex(-boss.pendulum.bobR*1.5, boss.pendulum.bobR, -boss.pendulum.bobR*1.5, 0, 0, -boss.pendulum.bobR);
                p.endShape(p.CLOSE);
                
                // Collision
                // FIX: Match visual rotation coordinate system
                const bladeWorldX = p.width/2 - Math.sin(boss.pendulum.angle) * boss.pendulum.length;
                const bladeWorldY = -50 + Math.cos(boss.pendulum.angle) * boss.pendulum.length;
                
                if (p.dist(bladeWorldX, bladeWorldY, player.pos.x, player.pos.y) < boss.pendulum.bobR + player.hitbox && player.invulnerable <= 0 && player.shieldTimer <= 0) {
                     player.hp -= 35; // Increased Damage
                     setHealth(player.hp);
                     player.invulnerable = 90;
                     createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 15);
                }
                
                p.pop();
            }
            
            // --- STASIS ORBS (Stage 3+) ---
            // Replaces Time Bombs
            if (currentStageIndex >= 2 && globalTimeScale > 0 && frame % 180 === 0) {
                spawnStasisOrb();
            }

            // --- FATE BEAM (Stage 5) ---
            if (currentStageIndex >= 4) {
                // Initialize beams if needed
                if (!boss.fateBeams || boss.fateBeams.length === 0) {
                     boss.fateBeams = [
                        { active: false, x: 0, width: 0, damage: 2, orientation: 'V' },
                        { active: false, y: 0, width: 0, damage: 2, orientation: 'H' }
                    ];
                }

                if (frame % 300 === 0 && globalTimeScale > 0) {
                    boss.fateBeams.forEach(b => {
                        b.active = true;
                        b.width = 0;
                        if (b.orientation === 'V') b.x = p.random(50, p.width - 50);
                        if (b.orientation === 'H') b.y = p.random(50, p.height - 50);
                    });
                }
                
                boss.fateBeams.forEach(beam => {
                    if (beam.active) {
                        beam.width += 2 * globalTimeScale; // Expand
                        const maxWidth = 80;
                        const opacity = Math.min(255, beam.width * 5);
                        
                        // Render
                        p.noStroke();
                        p.fill(COLORS.BOSS_FATE_BEAM[0], COLORS.BOSS_FATE_BEAM[1], COLORS.BOSS_FATE_BEAM[2], 100);
                        
                        if (beam.orientation === 'V') {
                             p.rect(beam.x - beam.width/2, 0, beam.width, p.height);
                             p.fill(255, 200); p.rect(beam.x - beam.width/6, 0, beam.width/3, p.height);
                        } else {
                             p.rect(0, beam.y - beam.width/2, p.width, beam.width);
                             p.fill(255, 200); p.rect(0, beam.y - beam.width/6, p.width, beam.width/3);
                        }

                        // Collision
                        if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
                            let hit = false;
                            if (beam.orientation === 'V') {
                                if (Math.abs(player.pos.x - beam.x) < beam.width/2) hit = true;
                            } else {
                                if (Math.abs(player.pos.y - beam.y) < beam.width/2) hit = true;
                            }
                            if (hit) {
                                player.hp -= beam.damage;
                                setHealth(player.hp);
                                createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 1);
                            }
                        }
                        
                        if (beam.width > maxWidth) beam.active = false;
                    }
                });
            }

            // Handle Time Stop Mechanics (Stage 3+)
            if (currentStageIndex >= 2) {
                boss.timeAbilityTimer--;
                
                // Trigger Stop
                if (boss.timeAbilityTimer <= 0 && boss.timeState === 'NORMAL') {
                    boss.timeState = 'STOPPED';
                    boss.timeAbilityTimer = 90; // 1.5 second freeze duration
                    boss.targetAngle += p.PI; // Flip
                    globalTimeScale = 0;
                    player.frozen = true;
                    // Shockwave Visual
                    particles.push({x: boss.pos.x, y: boss.pos.y, vx: 0, vy: 0, life: 1.0, color: COLORS.BOSS_HOURGLASS, size: 200, isShockwave: true});
                    drawGlitch(); // Visual glitch on stop
                    
                    // Spawn Frozen Rain (Stage 3+)
                    for(let x=20; x<p.width; x+=40) {
                        spawnEnemyBullet(x, -20, 0, 2, baseSpeed, COLORS.BOSS_BULLET_SAND, 'CIRCLE');
                    }
                    
                    // Morph bullets
                    enemyBullets.forEach(b => {
                        b.shape = 'KNIFE';
                        b.color = COLORS.BOSS_BULLET_KNIFE;
                        b.r = 8;
                        // Point to player
                        const a = Math.atan2(player.pos.y - b.pos.y, player.pos.x - b.pos.x);
                        b.angle = a;
                        // Stop movement
                        b.vel.mult(0);
                    });
                } 
                // Resume from Stop
                else if (boss.timeAbilityTimer <= 0 && boss.timeState === 'STOPPED') {
                    boss.timeState = 'NORMAL';
                    boss.timeAbilityTimer = 300; // 5 seconds cooldown
                    boss.targetAngle += p.PI; // Flip back
                    globalTimeScale = 1.0; // Reset to normal speed (Stage 5 handled elsewhere if needed, but requested normal)
                    player.frozen = false;
                    drawGlitch(); // Visual glitch on resume
                    
                    // Launch Knives
                    enemyBullets.forEach(b => {
                        if (b.shape === 'KNIFE') {
                            b.vel.x = Math.cos(b.angle) * baseSpeed * 2;
                            b.vel.y = Math.sin(b.angle) * baseSpeed * 2;
                        } else if (b.pos.y < 0) {
                            // Rain starts falling
                            b.vel.y = baseSpeed * 2;
                        }
                    });
                }
            }

            // Handle Rewind (Stage 4+)
            if (currentStageIndex >= 3 && boss.timeState === 'NORMAL') {
                timeRewindCycle++;
                if (timeRewindCycle > 240) { // Every 4 seconds
                    timeRewindCycle = 0;
                    drawGlitch();
                    // Reverse all bullet velocities
                    enemyBullets.forEach(b => {
                        b.vel.mult(-1);
                    });
                    // Visual effect
                    createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_HOURGLASS, 20);
                }
            }
            
            // --- SAND GEYSERS (Upward streams) ---
            if (currentStageIndex >= 3 && frame % 150 === 0 && globalTimeScale > 0) {
                Patterns.sandGeyser(p, p.width, p.height, spawnEnemyBullet, baseSpeed);
            }

            if (stageTransitionTimer < 140 && boss.timeState === 'NORMAL') {
                // Get Echo Position
                let ghostPos = null;
                if (currentStageIndex >= 3 && boss.history.length > 30) {
                     let record = boss.history[boss.history.length - 30];
                     ghostPos = p.createVector(record.x, record.y);
                }
                
                // --- STAGE 5 SHADOW CLONE (Double Bullets) ---
                const sources = [boss.pos];
                if (currentStageIndex >= 4) {
                    sources.push(p.createVector(p.width - boss.pos.x, boss.pos.y));
                }

                sources.forEach((source, index) => {
                    const isShadow = index === 1;
                    const c = isShadow ? COLORS.BOSS_SHADOW : undefined; 
                    
                    if (currentStageIndex >= 0 && frame % 60 === 0) {
                        Patterns.hourglassSplash(p, source, frame, (x,y,vx,vy,s,cl,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                    }
                    if (currentStageIndex >= 1 && frame % 120 === 0) {
                        Patterns.sandstorm(p, source, p.width, (x,y,vx,vy,s,cl,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                    }
                    if (currentStageIndex >= 2 && frame % 5 === 0 && p.random() < 0.2) {
                        Patterns.aimed(p, source, player.pos, (x,y,vx,vy,s,cl,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                    }
                    if (currentStageIndex >= 3 && frame % 40 === 0) {
                        Patterns.ring(p, source, 10, (x,y,vx,vy,s,cl,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                    }
                });
                
                // Ghost Echo is separate
                if (ghostPos) {
                     Patterns.hourglassSplash(p, ghostPos, frame - 30, (x,y,vx,vy,s,c,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,COLORS.BOSS_GHOST,sh,b), baseSpeed);
                     if (currentStageIndex >= 3 && frame % 40 === 0) {
                        Patterns.ring(p, ghostPos, 10, (x,y,vx,vy,s,c,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,COLORS.BOSS_GHOST,sh,b), baseSpeed);
                     }
                }
                
                // Timeline Collapse (Walls)
                if (currentStageIndex >= 4 && frame % 90 === 0) {
                    Patterns.timelineCollapse(p, p.width, p.height, spawnEnemyBullet, baseSpeed);
                }
            }
        } else if (boss.type === 'MATH') {
            // Spin numbers
            boss.pos.x = p.lerp(boss.pos.x, p.width / 2, 0.05);
            boss.pos.y = p.lerp(boss.pos.y, 100, 0.05);
            
            if (stageTransitionTimer < 140) {
                switch(boss.mathState) {
                    case 'SPIN':
                        boss.mathTimer--;
                        if (frame % 5 === 0) {
                            let maxR = 9;
                            if (currentStageIndex > 1) maxR = 20;
                            if (currentStageIndex > 3) maxR = 99;
                            boss.displayNums[0] = Math.floor(p.random(1, maxR));
                            boss.displayNums[1] = Math.floor(p.random(1, maxR));
                        }
                        if (boss.mathTimer <= 0) {
                            boss.mathState = 'RESOLVE';
                        }
                        break;
                    case 'RESOLVE':
                        // Decide Operator based on stage
                        const ops = ['+'];
                        if (currentStageIndex >= 0) ops.push('-');
                        if (currentStageIndex >= 1) ops.push('/');
                        if (currentStageIndex >= 2) ops.push('x'); // Stage 3: Matrix Rain
                        if (currentStageIndex >= 3) ops.push('^'); // Stage 4: Geometry
                        if (currentStageIndex >= 4) { // Stage 5: Golden Ratio
                            if (p.random() < 0.6) ops.push('PHI'); // Use Phi more often
                        }
                        
                        boss.operator = p.random(ops);
                        
                        // Scale numbers heavily by stage
                        let maxRange = 9;
                        if (currentStageIndex >= 1) maxRange = 20;
                        if (currentStageIndex >= 2) maxRange = 30;
                        if (currentStageIndex >= 3) maxRange = 50; 
                        if (currentStageIndex >= 4) maxRange = 99;
                        
                        // Determine operands
                        if (boss.operator === '+') {
                            boss.operands = [Math.floor(p.random(1, maxRange)), Math.floor(p.random(1, maxRange))];
                            boss.mathResult = boss.operands[0] + boss.operands[1];
                        } else if (boss.operator === '-') {
                             boss.operands = [Math.floor(p.random(1, maxRange)), Math.floor(p.random(1, maxRange))];
                             boss.mathResult = boss.operands[0] - boss.operands[1];
                        } else if (boss.operator === '/') {
                             boss.mathResult = Math.floor(p.random(2, 6 + currentStageIndex)); 
                             const denominator = Math.floor(p.random(2, 5));
                             boss.operands[0] = boss.mathResult * denominator;
                             boss.operands[1] = denominator;
                        } else if (boss.operator === 'x') {
                             const a = Math.floor(p.random(3, 8 + currentStageIndex));
                             const b = Math.floor(p.random(2, 6 + currentStageIndex));
                             boss.operands = [a, b];
                             boss.mathResult = a * b; // Used for Matrix Rain count
                        } else if (boss.operator === '^') {
                             boss.operands[0] = Math.floor(p.random(2, 6)); // Increase base
                             boss.operands[1] = Math.floor(p.random(2, 4)); // Increase power
                             boss.mathResult = Math.min(150, Math.pow(boss.operands[0], boss.operands[1]));
                        } else if (boss.operator === 'PHI') {
                             boss.mathResult = 150; // High count for spiral
                             boss.operands = [1, 1]; // Fib seed
                        }
                        
                        boss.displayNums = [...boss.operands];
                        boss.mathTimer = 30; // Wait a bit showing result
                        boss.mathState = 'ATTACK';
                        break;
                    case 'ATTACK':
                        boss.mathTimer--;
                        
                        // Fire Logic
                        if (boss.mathTimer === 20) {
                            if (boss.operator === '+') {
                                // Addition: Direct aimed shots
                                let count = Math.min(boss.mathResult, 50); 
                                Patterns.mathPlus(p, boss.pos, player.pos, count, spawnEnemyBullet, baseSpeed + 2);
                            } else if (boss.operator === '-') {
                                // Subtraction: Side attacks or Heal
                                if (boss.mathResult < 0) {
                                    Patterns.mathSide(p, p.width, p.height, p.height/2, spawnEnemyBullet, baseSpeed, true);
                                    Patterns.mathSide(p, p.width, p.height, p.height/3, spawnEnemyBullet, baseSpeed, true);
                                } else {
                                    let c = Math.min(Math.abs(boss.mathResult), 20);
                                    for(let i=0; i<c; i++) {
                                        setTimeout(() => {
                                            Patterns.mathSide(p, p.width, p.height, p.random(100, p.height-100), spawnEnemyBullet, baseSpeed, false);
                                        }, i * 100);
                                    }
                                }
                            } else if (boss.operator === '/') {
                                // Division: FRACTAL CLUSTER SHOT (Recursive Mitosis)
                                let count = Math.min(boss.mathResult, 15);
                                Patterns.mathDiv(p, boss.pos, count, spawnEnemyBullet, baseSpeed);
                            } else if (boss.operator === 'x') {
                                // Multiplication: BINARY MATRIX RAIN (0s and 1s)
                                let count = Math.min(boss.mathResult * 2, 80); 
                                Patterns.matrixRain(p, p.width, count, spawnEnemyBullet, baseSpeed);
                            } else if (boss.operator === '^') {
                                // Power: EXPONENTIAL SPIRAL (Accelerating bullets)
                                Patterns.mathPowerSpiral(p, boss.pos, boss.mathResult, spawnEnemyBullet, baseSpeed);
                            } else if (boss.operator === 'PHI') {
                                // Golden Spiral
                                // Handled in draw loop while state is ATTACK
                            }
                        }
                        
                        if (boss.operator === 'PHI') {
                             Patterns.goldenSpiral(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                        }
                        
                        if (boss.mathTimer <= 0) {
                            // Recovery time based on stage intensity
                            boss.mathState = 'SPIN';
                            boss.mathTimer = 60 - (currentStageIndex * 5); 
                            if (boss.mathTimer < 20) boss.mathTimer = 20;
                        }
                        break;
                }
            }
        }
      }

      // --- Draw Boss ---
      if (boss.active) {
          // Flash effect on hit
          if (stageTransitionTimer > 0) {
               if (frame % 4 < 2) p.fill(255); else p.fill(COLORS[`BOSS_${boss.type}`]);
               boss.opacity = 255;
          } else {
              p.fill(COLORS[`BOSS_${boss.type}`][0], COLORS[`BOSS_${boss.type}`][1], COLORS[`BOSS_${boss.type}`][2], boss.opacity);
          }
          
          p.push();
          p.translate(boss.pos.x, boss.pos.y);
          p.rotate(boss.angle);
          p.scale(boss.squash.x, boss.squash.y);
          p.stroke(255);
          p.strokeWeight(3);
          
          if (boss.type === 'CIRCLE') {
              p.circle(0, 0, boss.radius * 2);
          } else if (boss.type === 'SQUARE') {
              p.rectMode(p.CENTER);
              p.rect(0, 0, BOSS_SQUARE_SIZE, BOSS_SQUARE_SIZE);
              // Forcefield
              p.noFill(); p.stroke(255, 100); p.strokeWeight(1);
              p.rect(0, 0, BOSS_SQUARE_SIZE + 20 + Math.sin(frame*0.1)*10, BOSS_SQUARE_SIZE + 20 + Math.sin(frame*0.1)*10);
          } else if (boss.type === 'TRIANGLE') {
              p.beginShape();
              for(let i=0; i<3; i++) {
                  let a = (p.TWO_PI/3) * i - p.PI/2;
                  p.vertex(Math.cos(a) * BOSS_TRIANGLE_SIZE, Math.sin(a) * BOSS_TRIANGLE_SIZE);
              }
              p.endShape(p.CLOSE);
              // Inner Triangle
              p.noFill(); p.stroke(255); p.strokeWeight(1);
              p.rotate(frame * 0.05);
              p.beginShape();
              for(let i=0; i<3; i++) {
                  let a = (p.TWO_PI/3) * i - p.PI/2;
                  p.vertex(Math.cos(a) * (BOSS_TRIANGLE_SIZE/2), Math.sin(a) * (BOSS_TRIANGLE_SIZE/2));
              }
              p.endShape(p.CLOSE);
          } else if (boss.type === 'HEART') {
               p.beginShape();
               for (let t = 0; t < p.TWO_PI; t += 0.1) {
                    let r = 2; // scale
                    if (currentStageIndex >= 4) r = 3; 
                    let x = 16 * Math.pow(Math.sin(t), 3);
                    let y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)); 
                    p.vertex(x * r, y * r);
               }
               p.endShape(p.CLOSE);
          } else if (boss.type === 'OVAL') {
               p.ellipse(0, 0, 100, 60);
               p.noFill(); p.stroke(255, 200); 
               p.ellipse(0, 0, 60 + Math.sin(frame * 0.2)*10, 30);
          } else if (boss.type === 'HEXAGON') {
               drawLightningHex(0, 0, BOSS_HEXAGON_SIZE, 0, COLORS.BOSS_HEXAGON);
          } else if (boss.type === 'HOURGLASS') {
               // Interpolate angle for smooth flip
               boss.angle = p.lerp(boss.angle, boss.targetAngle, 0.1);
               // Top Bulb
               p.noFill(); p.stroke(COLORS.BOSS_HOURGLASS); p.strokeWeight(4);
               p.triangle(-30, -50, 30, -50, 0, 0);
               p.triangle(-30, 50, 30, 50, 0, 0);
               // Sand
               p.noStroke(); p.fill(255, 215, 0);
               let sandLevelTop = 10 + Math.sin(frame * 0.05) * 5;
               let sandLevelBot = 10 + frame % 40; 
               if (boss.timeState === 'STOPPED') {
                   p.fill(100); // Grey sand
               }
               p.triangle(-20, -40, 20, -40, 0, -5); // Top sand
               p.triangle(-20, 45, 20, 45, 0, 45 - sandLevelBot*0.5); // Bot sand
               // Stream
               if (boss.timeState !== 'STOPPED') {
                   p.stroke(255, 215, 0); p.strokeWeight(2);
                   p.line(0, -5, 0, 45);
               }
          } else if (boss.type === 'MATH') {
               p.rectMode(p.CENTER);
               p.stroke(255); p.strokeWeight(2);
               p.fill(50);
               p.rect(0, 0, 80, 80, 10);
               
               // INVULNERABLE VISUAL
               if (boss.mathState !== 'SPIN') {
                   p.noFill();
                   p.stroke(150);
                   p.strokeWeight(4);
                   p.rect(0, 0, 90 + Math.sin(frame * 0.2)*5, 90 + Math.sin(frame * 0.2)*5, 15);
                   p.stroke(255, 0, 0, 100);
                   p.line(-40, -40, 40, 40);
                   p.line(40, -40, -40, 40);
               }
               
               p.textAlign(p.CENTER, p.CENTER);
               p.textSize(40);
               p.fill(255);
               p.noStroke();
               if (boss.mathState === 'SPIN') {
                   p.text(p.random(['+', '-', '/', 'x', '^', 'Φ']), 0, 0);
                   p.textSize(15);
                   p.fill(0, 255, 0);
                   if (frame % 10 < 5) p.text("VULNERABLE", 0, 60);
               } else {
                   if (boss.operator === 'PHI') p.textSize(30);
                   p.text(boss.operator === 'PHI' ? 'Φ' : boss.operator, 0, 0);
               }
               
               // Floating Numbers
               p.textSize(30);
               p.fill(200, 200, 255);
               p.text(boss.displayNums[0], -80 + Math.sin(frame * 0.1)*10, Math.cos(frame * 0.1)*10);
               p.text(boss.displayNums[1], 80 + Math.sin(frame * 0.1 + p.PI)*10, Math.cos(frame * 0.1 + p.PI)*10);
               
               // Result
               if (boss.mathState === 'ATTACK' || boss.mathState === 'RESOLVE') {
                   p.textSize(20);
                   p.fill(100, 255, 100);
                   let res = boss.mathResult;
                   if (boss.operator === 'x' || boss.operator === '^') res = 'MAX'; // Simplified display
                   if (boss.operator === 'PHI') res = 'GOLDEN';
                   p.text("= " + res, 0, -60);
               }
          }
          p.pop();
          
          // Shield Bar for Heart Boss Stage 5
          if (boss.type === 'HEART' && currentStageIndex >= 4 && boss.shield > 0) {
              p.noFill();
              p.stroke(COLORS.BOSS_SHIELD);
              p.strokeWeight(4);
              p.arc(boss.pos.x, boss.pos.y, 140, 140, -p.PI/2, -p.PI/2 + (p.TWO_PI * (boss.shield/boss.maxShield)));
              p.noStroke();
          }
      }

      // --- 4. Entities Update & Render ---

      // Minions
      for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        // Behavior
        if (e.type === 'drone') {
            e.pos.y += 1.5;
        } else if (e.type === 'swooper') {
            e.pos.y += 2.5;
            e.pos.x += Math.sin(frame * 0.05) * 3;
            // Aim at player
            let angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
            e.pos.x += Math.cos(angle) * 1;
        } else if (e.type === 'orbiter') {
            if (e.parent && e.parent.active) {
                e.orbitAngle += 0.05;
                e.pos.x = e.parent.pos.x + Math.cos(e.orbitAngle) * 100;
                e.pos.y = e.parent.pos.y + Math.sin(e.orbitAngle) * 100;
            } else {
                e.hp = 0; // Die if parent dies
            }
        } else if (e.type === 'mini_boss') {
            e.pos.x += Math.sin(frame * 0.02) * 2;
            e.pos.y = 150 + Math.cos(frame * 0.03) * 30;
            if (frame % 120 === 0) spawnMinion('drone', e.pos.x, e.pos.y + 30);
        } else if (e.type === 'lust_orb') {
             // Slowly track player
             let angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
             e.pos.x += Math.cos(angle) * 0.75; // Slow
             e.pos.y += Math.sin(angle) * 0.75;
        }

        // Shoot
        if (e.shootTimer > 0) e.shootTimer--;
        else {
           if (e.type === 'drone') { spawnEnemyBullet(e.pos.x, e.pos.y, 0, 1, baseSpeed * 0.8, COLORS.ENEMY_BULLET); e.shootTimer = 120; }
           if (e.type === 'mini_boss') { Patterns.aimed(p, e.pos, player.pos, spawnEnemyBullet, baseSpeed); e.shootTimer = 90; }
           if (e.type === 'orbiter') { Patterns.aimed(p, e.pos, player.pos, spawnEnemyBullet, baseSpeed); e.shootTimer = 100; }
        }

        // Draw
        p.fill(e.type === 'lust_orb' ? COLORS.ENEMY_LUST_ORB : (e.type === 'mini_boss' ? COLORS.ENEMY_MINI_BOSS : COLORS.ENEMY));
        p.noStroke();
        p.circle(e.pos.x, e.pos.y, e.radius * 2);

        // Bounds
        if (e.pos.y > p.height + 50 || e.pos.x < -50 || e.pos.x > p.width + 50) {
            enemies.splice(i, 1);
        }
      }

      // Enemy Bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        let b = enemyBullets[i];
        
        // Acceleration Logic (Math Boss)
        if (b.accelerating) {
            b.speed *= 1.03; // Exponential acceleration
            b.vel.setMag(b.speed);
        }

        // Homing Logic for GEOMETRY Triangles
        if (b.shape === 'GEOMETRY' && b.subType === 'TRIANGLE') {
             let angle = Math.atan2(player.pos.y - b.pos.y, player.pos.x - b.pos.x);
             b.vel.x = p.lerp(b.vel.x, Math.cos(angle) * b.speed, 0.05);
             b.vel.y = p.lerp(b.vel.y, Math.sin(angle) * b.speed, 0.05);
        }
        
        // Fractal Split Logic (Math Boss - Division)
        if (b.canSplit && b.splitTimer > 0) {
            b.splitTimer--;
            if (b.splitTimer <= 0 && b.splitGen > 0) {
                 // Split into 4 pieces (Cross shape) relative to current velocity
                 createExplosion(b.pos.x, b.pos.y, b.color, 3);
                 let currentAngle = Math.atan2(b.vel.y, b.vel.x);
                 
                 for(let k = 0; k < 4; k++) {
                     // 4-way split: 0, 90, 180, 270 degrees offset
                     let angleOffset = (p.HALF_PI * k); 
                     let newAngle = currentAngle + angleOffset;
                     spawnEnemyBullet(b.pos.x, b.pos.y, Math.cos(newAngle), Math.sin(newAngle), b.speed * 1.2, b.color, 'CIRCLE', 0, true);
                     // Decrement generation for children
                     enemyBullets[enemyBullets.length-1].splitGen = b.splitGen - 1;
                 }
                 enemyBullets.splice(i, 1);
                 continue;
            }
        }
        
        // Frozen Logic
        if (boss.type === 'HOURGLASS' && boss.timeState === 'STOPPED') {
             // Do not move
             if (b.shape === 'KNIFE') {
                 // Vibrate
                 p.push();
                 p.translate(b.pos.x + p.random(-1, 1), b.pos.y + p.random(-1, 1));
                 p.rotate(b.angle);
                 p.fill(b.color);
                 p.noStroke();
                 p.triangle(-5, -3, -5, 3, 10, 0); // Knife shape
                 p.pop();
             } else {
                 // Frozen circle
                 p.fill(b.color);
                 p.circle(b.pos.x, b.pos.y, b.r * 2);
             }
        } else {
            // Normal Movement
            if (b.shape === 'KNIFE') {
                // Should already be moving from resume logic
                b.pos.add(b.vel);
            } else {
                b.pos.x += b.vel.x * globalTimeScale;
                b.pos.y += b.vel.y * globalTimeScale;
            }

            // Bouncing Logic (Oval Boss)
            if (b.bounces > 0 || (b.shape === 'GEOMETRY' && b.subType === 'PENTAGON')) {
                if (b.pos.x < 0 || b.pos.x > p.width) { b.vel.x *= -1; if(b.bounces > 0) b.bounces--; }
                if (b.pos.y < 0 || b.pos.y > p.height) { b.vel.y *= -1; if(b.bounces > 0) b.bounces--; }
            }

            // Draw
            p.fill(b.color);
            p.noStroke();
            if (b.shape === 'CIRCLE') {
                p.circle(b.pos.x, b.pos.y, b.r * 2);
            } else if (b.shape === 'RECT') {
                p.push();
                p.translate(b.pos.x, b.pos.y);
                p.rotate(frame * 0.2);
                p.rectMode(p.CENTER);
                p.rect(0, 0, 10, 20);
                p.pop();
            } else if (b.shape === 'TRIANGLE') {
                 p.push();
                 p.translate(b.pos.x, b.pos.y);
                 p.rotate(frame * 0.1);
                 p.triangle(-15, -15, 15, -15, 0, 15); // Inverted Triangle (Panty-ish)
                 p.pop();
            } else if (b.shape === 'METEOR') {
                 p.circle(b.pos.x, b.pos.y, 25);
                 // Trail
                 p.fill(255, 100);
                 p.circle(b.pos.x - b.vel.x*2, b.pos.y - b.vel.y*2, 15);
            } else if (b.shape === 'HEAL') {
                p.fill(0, 255, 0);
                p.textSize(10);
                p.textAlign(p.CENTER, p.CENTER);
                p.text("+", b.pos.x, b.pos.y);
            } else if (b.shape === 'KNIFE') {
                 p.push();
                 p.translate(b.pos.x, b.pos.y);
                 p.rotate(b.angle);
                 p.triangle(-5, -3, -5, 3, 10, 0);
                 p.pop();
            } else if (b.shape === 'BINARY') {
                 p.fill(0, 255, 100);
                 p.textSize(14);
                 p.textAlign(p.CENTER, p.CENTER);
                 p.text(b.text || '1', b.pos.x, b.pos.y);
            } else if (b.shape === 'GEOMETRY') {
                 p.push();
                 p.translate(b.pos.x, b.pos.y);
                 p.rotate(frame * 0.1);
                 if (b.subType === 'TRIANGLE') {
                     p.triangle(0, -10, 8, 8, -8, 8);
                 } else if (b.subType === 'SQUARE') {
                     p.rectMode(p.CENTER);
                     p.rect(0, 0, 16, 16);
                 } else { // Pentagon
                     p.beginShape();
                     for(let k=0; k<5; k++) {
                         let ang = (p.TWO_PI/5)*k - p.PI/2;
                         p.vertex(Math.cos(ang)*10, Math.sin(ang)*10);
                     }
                     p.endShape(p.CLOSE);
                 }
                 p.pop();
            }

            // Bounds
            if (b.pos.x < -50 || b.pos.x > p.width + 50 || b.pos.y < -50 || b.pos.y > p.height + 50) {
                enemyBullets.splice(i, 1);
            }
        }
      }

      // Player Bullets
      for (let i = player.bullets.length - 1; i >= 0; i--) {
        let b = player.bullets[i];
        
        if (b.homing) {
            let target = boss.active ? boss : null;
            let minDist = 10000;
            
            // Prioritize Minions if close
            for(let e of enemies) {
                let d = p.dist(b.pos.x, b.pos.y, e.pos.x, e.pos.y);
                if (d < minDist) { minDist = d; target = e; }
            }
            if (boss.active) {
                let d = p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y);
                if (d < minDist) target = boss;
            }

            if (target) {
                let angle = Math.atan2(target.pos.y - b.pos.y, target.pos.x - b.pos.x);
                b.vel.x = p.lerp(b.vel.x, Math.cos(angle) * BULLET_SPEED, 0.1);
                b.vel.y = p.lerp(b.vel.y, Math.sin(angle) * BULLET_SPEED, 0.1);
            }
        }

        b.pos.add(b.vel);
        
        p.fill(COLORS.PLAYER_BULLET);
        p.circle(b.pos.x, b.pos.y, 8);

        if (b.pos.y < -10 || b.pos.x < -10 || b.pos.x > p.width + 10) player.bullets.splice(i, 1);
      }

      // Power Ups
      for (let i = powerUps.length - 1; i >= 0; i--) { // Iterate BACKWARDS to safely splice
         let pu = powerUps[i];
         if (!pu.active) continue;
         
         pu.y += 2;
         let col = COLORS.POWERUP_SPREAD;
         if (pu.type === PowerUpType.RAPID) col = COLORS.POWERUP_RAPID;
         if (pu.type === PowerUpType.HOMING) col = COLORS.POWERUP_HOMING;
         if (pu.type === PowerUpType.HEAL) col = COLORS.POWERUP_HEAL;
         
         if (pu.trap) {
             col = COLORS.POWERUP_TRAP;
             // Glitch movement
             pu.x += p.random(-2, 2);
         }

         p.fill(col);
         // Pulse Animation
         let r = pu.radius + Math.sin(frame * 0.1) * 2;
         p.circle(pu.x, pu.y, r * 2);
         
         p.fill(0);
         p.textAlign(p.CENTER, p.CENTER);
         p.textSize(10);
         let label = "S";
         if (pu.type === PowerUpType.RAPID) label = "R";
         if (pu.type === PowerUpType.HOMING) label = "H";
         if (pu.type === PowerUpType.HEAL) label = "+";
         p.text(label, pu.x, pu.y);
         
         // Collision Check
         if (p.dist(player.pos.x, player.pos.y, pu.x, pu.y) < player.radius + pu.radius) {
               if (pu.trap) {
                   player.hp -= 30;
                   setHealth(player.hp);
                   createExplosion(player.pos.x, player.pos.y, COLORS.POWERUP_TRAP, 15);
                   p.fill(255, 0, 0); p.textSize(20); p.text("TRAP!", player.pos.x, player.pos.y - 20);
               } else {
                   if (pu.type === PowerUpType.HEAL) {
                       player.hp = Math.min(100, player.hp + 20);
                       setHealth(player.hp);
                   } else {
                       if (player.weaponType === pu.type) {
                           player.weaponLevel = Math.min(MAX_WEAPON_LEVEL, player.weaponLevel + 1);
                           player.weaponTimer = 600; // Reset timer on stack
                       } else {
                           player.weaponType = pu.type;
                           player.weaponLevel = 1;
                           player.weaponTimer = 600; // 10s
                       }
                   }
               }
               powerUps.splice(i, 1);
         } else if (pu.y > p.height + 20) {
             powerUps.splice(i, 1);
         }
      }
      
      // Stasis Orbs
      for (let i = stasisOrbs.length - 1; i >= 0; i--) {
          let o = stasisOrbs[i];
          if (globalTimeScale > 0) {
              // Track player slowly
              let angle = Math.atan2(player.pos.y - o.y, player.pos.x - o.x);
              o.vx = Math.cos(angle) * 1.5;
              o.vy = Math.sin(angle) * 1.5;
              o.x += o.vx;
              o.y += o.vy;
          }
          
          p.noStroke();
          p.fill(COLORS.BOSS_STASIS_ORB[0], COLORS.BOSS_STASIS_ORB[1], COLORS.BOSS_STASIS_ORB[2], 150);
          p.circle(o.x, o.y, o.radius * 2);
          p.fill(255);
          p.circle(o.x, o.y, o.radius);
          
          if (p.dist(player.pos.x, player.pos.y, o.x, o.y) < o.radius + PLAYER_HITBOX && player.invulnerable <= 0 && player.shieldTimer <= 0) {
              player.frozen = true;
              player.freezeTimer = 90; // 1.5s
              createExplosion(o.x, o.y, COLORS.BOSS_STASIS_ORB, 10);
              stasisOrbs.splice(i, 1);
          }
      }
      
      // Sand Traps (Visuals)
      for (let trap of sandTraps) {
          p.noStroke();
          p.fill(194, 178, 128, 100); // Sand color transparent
          p.circle(trap.x, trap.y, trap.r * 2);
          // Swirl effect
          p.stroke(150, 130, 80, 150);
          p.noFill();
          p.arc(trap.x, trap.y, trap.r*1.5, trap.r*1.5, frame*0.05, frame*0.05 + p.PI);
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        let part = particles[i];
        part.x += part.vx;
        part.y += part.vy;
        part.life -= 0.05;
        
        if (part.isShockwave) {
            p.noFill();
            p.stroke(part.color);
            p.strokeWeight(10 * part.life);
            part.size += 20;
            p.circle(part.x, part.y, part.size);
        } else {
            p.noStroke();
            let c = part.color;
            if (Array.isArray(c)) p.fill(c[0], c[1], c[2], part.life * 255);
            else p.fill(c, part.life * 255);
            p.circle(part.x, part.y, part.size);
        }

        if (part.life <= 0) particles.splice(i, 1);
      }
      
      // Time Stop Overlay
      if (boss.type === 'HOURGLASS' && boss.timeState === 'STOPPED') {
          // Grayscale filter
          p.filter(p.GRAY);
          
          // Clock overlay
          p.push();
          p.translate(boss.pos.x, boss.pos.y);
          p.noFill();
          p.stroke(255);
          p.strokeWeight(2);
          p.circle(0, 0, 100);
          // Ticking Hand
          let tickRatio = 1 - (boss.timeAbilityTimer / 90);
          let tickAngle = -p.PI/2 + (tickRatio * p.TWO_PI);
          p.line(0, 0, Math.cos(tickAngle)*45, Math.sin(tickAngle)*45);
          
          // Tick Marks
          for(let i=0; i<12; i++) {
              let a = (p.TWO_PI/12)*i;
              p.line(Math.cos(a)*40, Math.sin(a)*40, Math.cos(a)*48, Math.sin(a)*48);
          }
          p.pop();
      }

      // --- 5. Collision Detection ---
      if (gameState === GameState.PLAYING) {
        // Player Hit by Enemy Bullets
        if (player.invulnerable > 0) player.invulnerable--;
        
        // Draw Player
        if (player.invulnerable % 10 < 5) {
            p.fill(COLORS.PLAYER);
            p.noStroke();
            // Draw Ship
            p.triangle(player.pos.x, player.pos.y - PLAYER_RADIUS*1.5, player.pos.x - PLAYER_RADIUS, player.pos.y + PLAYER_RADIUS, player.pos.x + PLAYER_RADIUS, player.pos.y + PLAYER_RADIUS);
            
            // Hitbox
            p.fill(255, 0, 0);
            p.circle(player.pos.x, player.pos.y, PLAYER_HITBOX * 2);

            // Shield Visual
            if (player.shieldTimer > 0) {
                p.push();
                p.translate(player.pos.x, player.pos.y);
                p.rotate(frame * 0.1);
                p.noFill();
                p.stroke(COLORS.PLAYER_SHIELD);
                p.strokeWeight(2);
                p.circle(0, 0, 50);
                p.stroke(255, 255, 255, 100);
                p.arc(0, 0, 55, 55, 0, p.PI/2);
                p.arc(0, 0, 55, 55, p.PI, p.PI * 1.5);
                p.pop();
            }
        }
        
        // Player Hit Check
        for (let i = 0; i < enemyBullets.length; i++) {
          let b = enemyBullets[i];
          if (p.dist(player.pos.x, player.pos.y, b.pos.x, b.pos.y) < player.hitbox + b.r) {
             
             // Heal Bullet logic
             if (b.shape === 'HEAL') {
                 player.hp = Math.min(100, player.hp + 10);
                 setHealth(player.hp);
                 enemyBullets.splice(i, 1);
                 continue;
             }

             if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
               player.hp -= 10;
               setHealth(player.hp);
               player.invulnerable = 60;
               createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 10);
               enemyBullets.splice(i, 1);
               if (player.hp <= 0) {
                 setGameState(GameState.GAME_OVER);
                 createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 50);
               }
             } else {
                 // Shield absorbs bullet
                 enemyBullets.splice(i, 1);
             }
          }
        }

        // Check Boss Collision (Dash/Touch)
        let bossDist = p.dist(player.pos.x, player.pos.y, boss.pos.x, boss.pos.y);
        let touchDist = boss.radius + player.hitbox;
        if (boss.type === 'SQUARE') touchDist = BOSS_SQUARE_SIZE/2 + player.hitbox;
        
        if (bossDist < touchDist && player.invulnerable <= 0 && player.shieldTimer <= 0) {
             player.hp -= 20;
             setHealth(player.hp);
             player.invulnerable = 90;
             createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 20);
             // Bounce player back
             let angle = Math.atan2(player.pos.y - boss.pos.y, player.pos.x - boss.pos.x);
             player.pos.x += Math.cos(angle) * 50;
             player.pos.y += Math.sin(angle) * 50;
        }

        // Player Bullets hitting Enemies/Boss
        for (let i = player.bullets.length - 1; i >= 0; i--) {
           let b = player.bullets[i];
           let hit = false;

           // Minions
           for (let j = enemies.length - 1; j >= 0; j--) {
              let e = enemies[j];
              if (p.dist(b.pos.x, b.pos.y, e.pos.x, e.pos.y) < e.radius + 5) {
                 e.hp -= b.dmg * player.damageMult;
                 hit = true;
                 if (e.hp <= 0) {
                    enemies.splice(j, 1);
                    score += e.scoreVal;
                    setScore(score);
                    createExplosion(e.pos.x, e.pos.y, COLORS.ENEMY, 5);
                    if (p.random() < 0.5) spawnPowerUp(e.pos.x, e.pos.y); // 50% drop rate
                 }
                 break; 
              }
           }

           if (!hit && boss.active) {
              // Boss Collision
              let d = p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y);
              let r = boss.radius;
              if (boss.type === 'SQUARE') r = BOSS_SQUARE_SIZE/1.5;
              if (boss.type === 'HEART' && currentStageIndex >= 4) r = BOSS_RADIUS * 1.5;
              
              if (d < r) {
                 // Math Boss Invulnerability
                 if (boss.type === 'MATH' && boss.mathState !== 'SPIN') {
                     createExplosion(b.pos.x, b.pos.y, [200, 200, 200], 2); // Block effect
                     hit = true;
                     // No Damage
                 } else {
                     hit = true;
                     // Shield Mechanic (Heart Boss Stage 5)
                     if (boss.shield > 0) {
                         boss.shield -= b.dmg * player.damageMult;
                         createExplosion(b.pos.x, b.pos.y, COLORS.BOSS_SHIELD, 2);
                     } else {
                         let prevHp = boss.hp;
                         boss.hp -= b.dmg * player.damageMult;
                         setBossHealth((boss.hp / BOSS_MAX_HP) * 100);
                         createExplosion(b.pos.x, b.pos.y, COLORS[`BOSS_${boss.type}`], 2);
                         
                         // 5% HP Drop Mechanic
                         while (boss.hp < boss.nextPowerUpHp) {
                             spawnPowerUp(boss.pos.x, boss.pos.y);
                             boss.nextPowerUpHp -= (BOSS_MAX_HP * 0.05);
                         }
                     }

                     if (boss.hp <= 0) {
                        setGameState(GameState.VICTORY);
                        createExplosion(boss.pos.x, boss.pos.y, COLORS[`BOSS_${boss.type}`], 100);
                        boss.active = false;
                     }
                 }
              }
           }
           if (hit) player.bullets.splice(i, 1);
        }
      }
      
      // Stage Text
      if (stageTransitionTimer > 0) {
          stageTransitionTimer--;
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(40);
          p.fill(255, 0, 100, stageTransitionTimer * 2);
          p.text(`WARNING: LEVEL ${currentStageIndex + 1}`, p.width/2, p.height/2 - 50);
          p.textSize(20);
          p.text("THREAT INCREASING", p.width/2, p.height/2);
      }
    };

    p.startGame = (bossType) => {
        resetGame(bossType);
        gameState = GameState.PLAYING;
    };
  };
};
