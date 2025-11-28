

import p5 from 'p5';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAYER_SPEED, PLAYER_RADIUS, BOSS_RADIUS, BOSS_SQUARE_SIZE, BOSS_TRIANGLE_SIZE, BOSS_HEXAGON_SIZE, BOSS_HOURGLASS_SIZE, BOSS_MAX_HP, BULLET_SPEED, PLAYER_HITBOX, ENEMY_BULLET_BASE_SPEED, MAX_WEAPON_LEVEL, BASE_BULLET_SPEED_SCALE, OVAL_BOSS_MOVE_SPEED, SHIELD_DURATION, MAX_SHIELD_CHARGES } from '../constants.js';
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
  bulletSpeedRef
) => {
  return (p) => {
    // --- Game Entities ---
    let gameState = GameState.MENU;
    let score = 0;
    
    // Player
    let player = {
      pos: p.createVector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100),
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
      pos: p.createVector(CANVAS_WIDTH / 2, 100),
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
      fateBeams: [] // Array of active beams
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
      p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
      p.frameRate(60);
      
      // Init stars
      for(let i=0; i<100; i++) {
        stars.push({
          x: p.random(CANVAS_WIDTH), 
          y: p.random(CANVAS_HEIGHT), 
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
      player.pos = p.createVector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100);
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
      boss.pos = p.createVector(CANVAS_WIDTH / 2, 100);
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
      
      // Select boss type
      if (bossType !== 'RANDOM') {
          boss.type = bossType;
      } else {
          const bosses = ['CIRCLE', 'SQUARE', 'TRIANGLE', 'HEART', 'OVAL', 'HEXAGON', 'HOURGLASS'];
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
    const spawnEnemyBullet = (x, y, vx, vy, speed, color, shape = 'CIRCLE', bounces = 0) => {
      enemyBullets.push({
        pos: p.createVector(x, y),
        vel: p.createVector(vx * speed, vy * speed),
        color: color,
        r: 6,
        shape: shape, 
        angle: 0,
        bounces: bounces 
      });
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
            x: p.random(50, CANVAS_WIDTH-50),
            y: p.random(50, 200),
            vx: p.random(-1, 1),
            vy: p.random(1, 2),
            radius: 20
        });
    };

    const spawnMinion = (forcedType = null, forcedX = null, forcedY = null, parent = null) => {
      if (enemies.length >= 25) return; 

      const type = forcedType || (p.random() > 0.5 ? 'drone' : 'swooper');
      const x = forcedX !== null ? forcedX : p.random(50, CANVAS_WIDTH - 50);
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
      powerUps.push({ x, y, type, radius: 10, active: true, trap: isTrap });
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
            const y = p.random(CANVAS_HEIGHT);
            const h = p.random(10, 50);
            const offset = p.random(-20, 20);
            p.image(p.get(0, y, CANVAS_WIDTH, h), offset, y);
            
            // Random rectangles
            p.fill(p.random([COLORS.BOSS_HOURGLASS, 255]), p.random(100));
            p.noStroke();
            p.rect(p.random(CANVAS_WIDTH), p.random(CANVAS_HEIGHT), p.random(50), p.random(10));
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
        if(star.y > CANVAS_HEIGHT) {
           star.y = 0;
           star.x = p.random(CANVAS_WIDTH);
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
            const scaleX = CANVAS_WIDTH / canvasRect.width;
            const scaleY = CANVAS_HEIGHT / canvasRect.height;
            
            if (p.touches.length > 0) {
               let t = p.touches[0];
               targetX = (t.x - canvasRect.left) * scaleX;
               // Offset Y slightly up so finger doesn't cover ship, especially on mobile
               targetY = (t.y - canvasRect.top) * scaleY - 60; 
            } else if (p.mouseX >= 0 && p.mouseX <= CANVAS_WIDTH && p.mouseY >= 0 && p.mouseY <= CANVAS_HEIGHT) {
               targetX = p.mouseX * (CANVAS_WIDTH / p.width);
               targetY = p.mouseY * (CANVAS_HEIGHT / p.height);
            }
            dx = (targetX - player.pos.x) * 0.2 * speedMult;
            dy = (targetY - player.pos.y) * 0.2 * speedMult;
          }
      }

      let nextX = player.pos.x + dx;
      if (!checkBlockerCollision(nextX, player.pos.y, PLAYER_RADIUS)) player.pos.x = nextX;
      let nextY = player.pos.y + dy;
      if (!checkBlockerCollision(player.pos.x, nextY, PLAYER_RADIUS)) player.pos.y = nextY;

      player.pos.x = p.constrain(player.pos.x, PLAYER_RADIUS, CANVAS_WIDTH - PLAYER_RADIUS);
      player.pos.y = p.constrain(player.pos.y, PLAYER_RADIUS, CANVAS_HEIGHT - PLAYER_RADIUS);

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

            createExplosion(boss.pos.x, boss.pos.y, exColor, 40);

            // Special Stage Start Logics
            if (boss.type === 'HEART') {
                if (currentStageIndex === 3) { // Stage 4: Lust Orbs
                    spawnMinion('lust_orb', 100, 100);
                    spawnMinion('lust_orb', CANVAS_WIDTH - 100, 100);
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
            boss.pos.x = CANVAS_WIDTH / 2 + Math.sin(frame * 0.02) * 150;
            boss.pos.y = 100 + Math.sin(frame * 0.05) * 20;
            
            if (stageTransitionTimer < 140) {
                 if (frame % 60 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 2);
                 if (currentStageIndex >= 0 && frame % 10 === 0) Patterns.spiral(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                 if (currentStageIndex >= 1) if (frame % 120 === 0) Patterns.ring(p, boss.pos, 12 + currentStageIndex * 2, spawnEnemyBullet, baseSpeed * 0.8);
                 if (currentStageIndex >= 2) if (frame % 90 === 0) Patterns.spread(p, boss.pos, player.pos, 5, p.PI/3, spawnEnemyBullet, baseSpeed);
                 if (currentStageIndex >= 3) if (frame % 5 === 0) Patterns.cross(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                 if (currentStageIndex >= 4) if (frame % 60 === 0) Patterns.converge(p, player.pos, CANVAS_WIDTH, CANVAS_HEIGHT, spawnEnemyBullet, baseSpeed * 0.5);
            }

        } else if (boss.type === 'SQUARE') {
            boss.angle += 0.02; 
            switch(boss.dashState) {
                case 'IDLE':
                    boss.pos.x = p.lerp(boss.pos.x, CANVAS_WIDTH/2 + Math.sin(frame * 0.01) * 100, 0.05);
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
                    boss.pos.x = p.lerp(boss.pos.x, CANVAS_WIDTH/2, 0.05);
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
                if (currentStageIndex >= 2) if (frame % 100 === 0) Patterns.wallDown(p, CANVAS_WIDTH, spawnEnemyBullet, baseSpeed * 0.8);
                if (currentStageIndex >= 3) if (frame % 30 === 0) Patterns.spread(p, boss.pos, player.pos, 7, p.PI/2, spawnEnemyBullet, baseSpeed);
                if (currentStageIndex >= 4) if (frame % 10 === 0) Patterns.chaos(p, boss.pos, spawnEnemyBullet, baseSpeed + 2);
            }

        } else if (boss.type === 'TRIANGLE') {
             boss.angle -= 0.02; 
            boss.summonTimer++;
            if (boss.teleportState === 'IDLE') {
                boss.pos.x = CANVAS_WIDTH / 2 + Math.sin(frame * 0.03) * 200;
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
                    boss.pos.x = p.random(100, CANVAS_WIDTH - 100);
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
             boss.pos.x = CANVAS_WIDTH / 2 + Math.sin(frame * 0.02) * 100;
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
            if (boss.pos.x < rX || boss.pos.x > CANVAS_WIDTH - rX) {
                boss.vel.x *= -1; boss.pos.x = p.constrain(boss.pos.x, rX, CANVAS_WIDTH - rX);
                createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_OVAL, 10);
                boss.squash.x = 0.6; boss.squash.y = 1.4; bounced = true;
            }
            if (boss.pos.y < rY || boss.pos.y > CANVAS_HEIGHT - rY) {
                boss.vel.y *= -1; boss.pos.y = p.constrain(boss.pos.y, rY, CANVAS_HEIGHT - rY);
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
                    let nx = p.random(100, CANVAS_WIDTH - 100);
                    let ny = p.random(50, 250);
                    if (currentStageIndex >= 4) ny = p.random(50, 400); 
                    boss.pos.x = nx; boss.pos.y = ny;
                    break;
                case 'TELEPORT_IN':
                     createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 15);
                     if (currentStageIndex >= 1) Patterns.rapidStream(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 6);
                     boss.hexState = 'IDLE'; boss.hexTimer = 0;
                    break;
             }
             if (currentStageIndex >= 4 && frame % 300 < 100) { boss.pos.x = p.lerp(boss.pos.x, CANVAS_WIDTH/2, 0.1); boss.pos.y = p.lerp(boss.pos.y, CANVAS_HEIGHT/2 - 100, 0.1); }
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
                 if (currentStageIndex >= 1 && frame % 30 === 0 && boss.hexState === 'IDLE') Patterns.rapidStream(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 6);
                 if (currentStageIndex >= 2 && frame % 25 === 0) { const startX1 = p.random(0, CANVAS_WIDTH); spawnMeteorAttack(startX1, -50, startX1, CANVAS_HEIGHT, 40, 25); const startX2 = p.random(0, CANVAS_WIDTH); spawnMeteorAttack(startX2, -50, startX2, CANVAS_HEIGHT, 40, 25); }
                 if (currentStageIndex >= 3 && frame % 50 === 0) { spawnMeteorAttack(-50, player.pos.y, CANVAS_WIDTH, player.pos.y, 40, 20); spawnMeteorAttack(player.pos.x, -50, player.pos.x, CANVAS_HEIGHT, 40, 20); }
                 if (currentStageIndex >= 4 && frame % 10 === 0) { const angle = p.random(p.TWO_PI); const dist = 600; const sx = CANVAS_WIDTH/2 + Math.cos(angle) * dist; const sy = CANVAS_HEIGHT/2 + Math.sin(angle) * dist; spawnMeteorAttack(sx, sy, player.pos.x, player.pos.y, 30, 30); }
             }

        } else if (boss.type === 'HOURGLASS') {
            boss.pos.x = CANVAS_WIDTH / 2 + Math.sin(frame * 0.01) * 100;
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
                p.translate(CANVAS_WIDTH/2, -50); // Anchor at top center
                p.rotate(boss.pendulum.angle);
                
                // Draw Chain
                p.stroke(COLORS.BOSS_PENDULUM);
                p.strokeWeight(4);
                p.line(0, 0, 0, boss.pendulum.length);
                
                // Pendulum Sand Trail
                if (globalTimeScale > 0 && frame % 5 === 0) {
                     const worldX = CANVAS_WIDTH/2 + Math.sin(boss.pendulum.angle) * boss.pendulum.length;
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
                const bladeWorldX = CANVAS_WIDTH/2 + Math.sin(boss.pendulum.angle) * boss.pendulum.length;
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
                        if (b.orientation === 'V') b.x = p.random(50, CANVAS_WIDTH - 50);
                        if (b.orientation === 'H') b.y = p.random(50, CANVAS_HEIGHT - 50);
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
                             p.rect(beam.x - beam.width/2, 0, beam.width, CANVAS_HEIGHT);
                             p.fill(255, 200); p.rect(beam.x - beam.width/6, 0, beam.width/3, CANVAS_HEIGHT);
                        } else {
                             p.rect(0, beam.y - beam.width/2, CANVAS_WIDTH, beam.width);
                             p.fill(255, 200); p.rect(0, beam.y - beam.width/6, CANVAS_WIDTH, beam.width/3);
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
                    for(let x=20; x<CANVAS_WIDTH; x+=40) {
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
                Patterns.sandGeyser(p, CANVAS_WIDTH, CANVAS_HEIGHT, spawnEnemyBullet, baseSpeed);
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
                    sources.push(p.createVector(CANVAS_WIDTH - boss.pos.x, boss.pos.y));
                }

                sources.forEach((source, index) => {
                    const isShadow = index === 1;
                    const c = isShadow ? COLORS.BOSS_SHADOW : undefined; 
                    
                    if (currentStageIndex >= 0 && frame % 60 === 0) {
                        Patterns.hourglassSplash(p, source, frame, (x,y,vx,vy,s,cl,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
                    }
                    if (currentStageIndex >= 1 && frame % 120 === 0) {
                        Patterns.sandstorm(p, source, CANVAS_WIDTH, (x,y,vx,vy,s,cl,sh,b) => spawnEnemyBullet(x,y,vx,vy,s,c||cl,sh,b), baseSpeed);
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
                    Patterns.timelineCollapse(p, CANVAS_WIDTH, CANVAS_HEIGHT, spawnEnemyBullet, baseSpeed);
                }
            }
        }
      }

      // --- 4. Minion & Enemy Logic ---
      
      if (boss.type !== 'TRIANGLE' && frame % 180 === 0 && boss.hp > 0 && stageTransitionTimer === 0 && globalTimeScale > 0) {
        if (boss.type === 'HEART' && p.random() < 0.3) {
        } else {
           spawnMinion();
        }
      }
      
      // Update Stasis Orbs
      for (let i = stasisOrbs.length - 1; i >= 0; i--) {
          let orb = stasisOrbs[i];
          if (globalTimeScale > 0) {
              // Homing Logic
              let angle = Math.atan2(player.pos.y - orb.y, player.pos.x - orb.x);
              orb.vx = p.lerp(orb.vx, Math.cos(angle) * 2, 0.05);
              orb.vy = p.lerp(orb.vy, Math.sin(angle) * 2, 0.05);
              orb.x += orb.vx * globalTimeScale;
              orb.y += orb.vy * globalTimeScale;
          }
          
          p.noStroke();
          p.fill(COLORS.BOSS_STASIS_ORB[0], COLORS.BOSS_STASIS_ORB[1], COLORS.BOSS_STASIS_ORB[2], 150);
          p.circle(orb.x, orb.y, orb.radius * 2);
          // Pulse
          p.stroke(255); p.strokeWeight(1); p.noFill();
          p.circle(orb.x, orb.y, orb.radius * 2 + Math.sin(frame * 0.2) * 5);

          if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
              if (p.dist(orb.x, orb.y, player.pos.x, player.pos.y) < orb.radius + player.hitbox) {
                  player.frozen = true;
                  player.freezeTimer = 90; // 1.5 Seconds freeze
                  stasisOrbs.splice(i, 1);
                  createExplosion(player.pos.x, player.pos.y, COLORS.BOSS_STASIS_ORB, 10);
              }
          }
          if (orb.y > CANVAS_HEIGHT + 50 || orb.y < -50) stasisOrbs.splice(i, 1);
      }
      
      // Sand Traps Logic
      if (boss.type === 'HOURGLASS' && currentStageIndex >= 1 && frame % 180 === 0 && globalTimeScale > 0) {
          sandTraps.push({ x: p.random(50, CANVAS_WIDTH-50), y: p.random(50, CANVAS_HEIGHT-50), r: 40, life: 300 });
      }
      for (let i = sandTraps.length - 1; i >= 0; i--) {
          let t = sandTraps[i];
          if (globalTimeScale > 0) t.life--;
          p.noStroke(); p.fill(COLORS.BOSS_BULLET_SAND[0], COLORS.BOSS_BULLET_SAND[1], COLORS.BOSS_BULLET_SAND[2], 100);
          p.circle(t.x, t.y, t.r * 2 + Math.sin(frame * 0.1) * 5);
          // Swirl effect
          p.stroke(200, 180, 100, 150); p.noFill(); p.arc(t.x, t.y, t.r*1.5, t.r*1.5, frame*0.1, frame*0.1 + 2);
          if (t.life <= 0) sandTraps.splice(i, 1);
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        
        // Update enemy pos based on time scale
        if (globalTimeScale > 0) {
            if (e.type === 'drone') {
                e.pos.y += 2 * globalTimeScale;
                e.pos.x += Math.sin(frame * 0.05 + i) * 1 * globalTimeScale;
            } else if (e.type === 'swooper') {
                e.pos.y += 3 * globalTimeScale;
                e.pos.x += Math.sin(frame * 0.1 + i) * 3 * globalTimeScale;
            } else if (e.type === 'orbiter') {
                if (e.parent && e.parent.active) {
                    e.orbitAngle += 0.05 * globalTimeScale;
                    const radius = 80;
                    e.pos.x = e.parent.pos.x + Math.cos(e.orbitAngle) * radius;
                    e.pos.y = e.parent.pos.y + Math.sin(e.orbitAngle) * radius;
                } else {
                    e.pos.y += 5 * globalTimeScale;
                }
            } else if (e.type === 'mini_boss') {
                e.pos.x = p.lerp(e.pos.x, CANVAS_WIDTH / 2 + Math.sin(frame * 0.02 + i) * 200, 0.02 * globalTimeScale);
                e.pos.y = p.lerp(e.pos.y, 200 + Math.sin(frame * 0.04 + i) * 30, 0.02 * globalTimeScale);
            } else if (e.type === 'lust_orb') {
                const angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                e.pos.x += Math.cos(angle) * 0.75 * globalTimeScale; 
                e.pos.y += Math.sin(angle) * 0.75 * globalTimeScale; 
            }
        }
        
        // Draw Lust Orb HP Bar
        if (e.type === 'lust_orb') {
             p.fill(COLORS.ENEMY_LUST_ORB);
            p.stroke(255);
            p.strokeWeight(3);
            p.circle(e.pos.x, e.pos.y, e.radius * 2);
            p.noStroke();
            p.fill(255, 100);
            p.circle(e.pos.x - e.radius*0.3, e.pos.y - e.radius*0.3, e.radius*0.5);
            p.noStroke(); p.fill(0, 255, 0); p.rect(e.pos.x - 40, e.pos.y - e.radius - 15, 80 * (e.hp/e.maxHp), 6);
            if (player.invulnerable <= 0 && player.shieldTimer <= 0 && p.dist(e.pos.x, e.pos.y, player.pos.x, player.pos.y) < e.radius + player.hitbox) {
                player.hp -= 50; setHealth(player.hp); player.invulnerable = 120; createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 20);
            }
        }

        if (e.type !== 'lust_orb' && globalTimeScale > 0) {
            e.shootTimer -= 1 * globalTimeScale;
            if (e.shootTimer <= 0) {
               if (e.type === 'drone') {
                  spawnEnemyBullet(e.pos.x, e.pos.y, 0, 1, 4 * BASE_BULLET_SPEED_SCALE, COLORS.ENEMY_BULLET);
                  e.shootTimer = 120;
               } else if (e.type === 'swooper') {
                  const angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                  spawnEnemyBullet(e.pos.x, e.pos.y, Math.cos(angle), Math.sin(angle), 4 * BASE_BULLET_SPEED_SCALE, COLORS.ENEMY_BULLET);
                  e.shootTimer = 120;
               } else if (e.type === 'orbiter') {
                  const angle = e.orbitAngle;
                  spawnEnemyBullet(e.pos.x, e.pos.y, Math.cos(angle), Math.sin(angle), 3 * BASE_BULLET_SPEED_SCALE, COLORS.ENEMY_ORBITER);
                  e.shootTimer = 180;
               } else if (e.type === 'mini_boss') {
                  Patterns.spread(p, e.pos, player.pos, 3, p.PI/4, spawnEnemyBullet, 4 * BASE_BULLET_SPEED_SCALE);
                  if (p.random() < 0.3) spawnMinion('drone', e.pos.x, e.pos.y + 20);
                  e.shootTimer = 100;
               }
            }
    
            // Minion Drawing
            p.stroke(255); p.strokeWeight(2);
            if (e.type === 'drone') { p.fill(COLORS.ENEMY); p.rect(e.pos.x - 10, e.pos.y - 10, 20, 20); } 
            else if (e.type === 'swooper') { p.fill(COLORS.ENEMY); p.triangle(e.pos.x, e.pos.y + 10, e.pos.x - 10, e.pos.y - 10, e.pos.x + 10, e.pos.y - 10); } 
            else if (e.type === 'orbiter') { p.fill(COLORS.ENEMY_ORBITER); p.circle(e.pos.x, e.pos.y, e.radius * 2); } 
            else if (e.type === 'mini_boss') { p.fill(COLORS.ENEMY_MINI_BOSS); p.push(); p.translate(e.pos.x, e.pos.y); p.rotate(frame * 0.1); p.triangle(0, -20, -17, 10, 17, 10); p.pop(); p.noStroke(); p.fill(255, 0, 0); p.rect(e.pos.x - 20, e.pos.y - 40, 40, 4); p.fill(0, 255, 0); p.rect(e.pos.x - 20, e.pos.y - 40, 40 * (e.hp/e.maxHp), 4); }
        }
        if (e.pos.y > CANVAS_HEIGHT + 50) { enemies.splice(i, 1); }
      }

      // --- Draw Blockers ---
      for (let b of blockers) {
          p.rectMode(p.CENTER); p.noFill(); p.strokeWeight(3 + Math.sin(frame * 0.2) * 1); p.stroke(COLORS.BLOCKER[0], COLORS.BLOCKER[1], COLORS.BLOCKER[2]); p.rect(b.pos.x, b.pos.y, b.w, b.h); p.fill(COLORS.BLOCKER[0], COLORS.BLOCKER[1], COLORS.BLOCKER[2], 50); p.noStroke(); p.rect(b.pos.x, b.pos.y, b.w, b.h);
      }

      // --- Collisions ---

      // Player Bullets
      for (let i = player.bullets.length - 1; i >= 0; i--) {
        const b = player.bullets[i];
        
        if (b.homing) {
            let target = null;
            let recordDist = Infinity;
            for (const e of enemies) {
                const d = p.dist(b.pos.x, b.pos.y, e.pos.x, e.pos.y);
                if (d < recordDist && d < 300) { 
                    recordDist = d;
                    target = e;
                }
            }
            if (!target && boss.active) {
                 const d = p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y);
                 if (d < 400) target = boss;
            }
            if (target) {
                const desired = p.createVector(target.pos.x - b.pos.x, target.pos.y - b.pos.y);
                desired.setMag(BULLET_SPEED * 1.5);
                const steer = p5.Vector.sub(desired, b.vel);
                steer.limit(0.2);
                b.vel.add(steer);
                b.vel.limit(BULLET_SPEED * 1.5);
            }
        }

        b.pos.add(b.vel);
        
        p.fill(COLORS.PLAYER_BULLET);
        p.noStroke();
        p.circle(b.pos.x, b.pos.y, 8);

        if (b.pos.y < -10 || b.pos.x < -10 || b.pos.x > CANVAS_WIDTH + 10 || b.pos.y > CANVAS_HEIGHT + 10) {
          player.bullets.splice(i, 1);
          continue;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (p.dist(b.pos.x, b.pos.y, e.pos.x, e.pos.y) < e.radius + 5) {
                e.hp -= b.dmg;
                hit = true;
                createExplosion(e.pos.x, e.pos.y, COLORS.ENEMY, 3);
                if (e.hp <= 0) {
                    enemies.splice(j, 1);
                    score += e.scoreVal || 100;
                    setScore(score);
                    createExplosion(e.pos.x, e.pos.y, COLORS.ENEMY, 10);
                    if (p.random() < 0.50) spawnPowerUp(e.pos.x, e.pos.y);
                }
                break;
            }
        }
        if (hit) {
            player.bullets.splice(i, 1);
            continue;
        }

        if (boss.active) {
            if (boss.shield > 0) {
                if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < boss.radius + 15) {
                    boss.shield -= b.dmg;
                    player.bullets.splice(i, 1);
                    createExplosion(b.pos.x, b.pos.y, COLORS.BOSS_SHIELD, 2);
                    continue; 
                }
            }

            let hitBoss = false;
            if (boss.type === 'CIRCLE') {
                if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < boss.radius) hitBoss = true;
            } else if (boss.type === 'SQUARE') {
                if (Math.abs(b.pos.x - boss.pos.x) < BOSS_SQUARE_SIZE/2 && Math.abs(b.pos.y - boss.pos.y) < BOSS_SQUARE_SIZE/2) hitBoss = true;
            } else if (boss.type === 'TRIANGLE') {
                if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < BOSS_TRIANGLE_SIZE) hitBoss = true;
            } else if (boss.type === 'HEART') {
                if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < boss.radius) hitBoss = true;
            } else if (boss.type === 'OVAL') {
                 const dx = Math.abs(b.pos.x - boss.pos.x);
                 const dy = Math.abs(b.pos.y - boss.pos.y);
                 if ((dx*dx)/(60*60) + (dy*dy)/(40*40) <= 1) hitBoss = true;
            } else if (boss.type === 'HEXAGON') {
                 if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < BOSS_HEXAGON_SIZE) hitBoss = true;
            } else if (boss.type === 'HOURGLASS') {
                 if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < BOSS_HOURGLASS_SIZE) hitBoss = true;
            }
            
            if (hitBoss && boss.opacity > 100) {
                boss.hp -= b.dmg;
                score += 10;
                setScore(score);
                setBossHealth((boss.hp / BOSS_MAX_HP) * 100);
                player.bullets.splice(i, 1);
                
                if (boss.hp <= boss.nextPowerUpHp) {
                     spawnPowerUp(p.random(50, CANVAS_WIDTH-50), p.random(100, 300));
                     boss.nextPowerUpHp -= (BOSS_MAX_HP * 0.05);
                     if (boss.hp <= boss.nextPowerUpHp) {
                         boss.nextPowerUpHp = Math.floor(boss.hp / (BOSS_MAX_HP * 0.05)) * (BOSS_MAX_HP * 0.05);
                     }
                }

                let exColor = COLORS.BOSS_CIRCLE;
                if (boss.type === 'SQUARE') exColor = COLORS.BOSS_SQUARE;
                if (boss.type === 'TRIANGLE') exColor = COLORS.BOSS_TRIANGLE;
                if (boss.type === 'HEART') exColor = COLORS.BOSS_HEART;
                if (boss.type === 'OVAL') exColor = COLORS.BOSS_OVAL;
                if (boss.type === 'HEXAGON') exColor = COLORS.BOSS_HEXAGON;
                if (boss.type === 'HOURGLASS') exColor = COLORS.BOSS_HOURGLASS;
                
                createExplosion(b.pos.x, b.pos.y, exColor, 2);
            }
        }
      }

      // Enemy Bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        
        // Scale bullet movement by globalTimeScale
        let scaledVel = b.vel.copy().mult(globalTimeScale);
        b.pos.add(scaledVel);
        
        // Visual Trails on Rewind
        if (timeRewindCycle > 240 && timeRewindCycle < 270 && globalTimeScale > 0) {
             p.noStroke();
             p.fill(255, 255, 0, 100);
             p.circle(b.pos.x - b.vel.x * 2, b.pos.y - b.vel.y * 2, b.r);
        }

        if (b.bounces > 0) {
            let bounced = false;
            if (b.pos.x < 0) { b.pos.x = 0; b.vel.x *= -1; bounced = true; }
            if (b.pos.x > CANVAS_WIDTH) { b.pos.x = CANVAS_WIDTH; b.vel.x *= -1; bounced = true; }
            if (b.pos.y < 0) { b.pos.y = 0; b.vel.y *= -1; bounced = true; }
            if (b.pos.y > CANVAS_HEIGHT) { b.pos.y = CANVAS_HEIGHT; b.vel.y *= -1; bounced = true; }
            
            if (bounced) {
                b.bounces--;
                createExplosion(b.pos.x, b.pos.y, b.color, 3);
            }
        }

        if (b.shape === 'RECT') {
            b.angle += 0.2 * globalTimeScale;
            p.push(); p.translate(b.pos.x, b.pos.y); p.rotate(b.angle); p.fill(b.color); p.rect(0, 0, 15, 8); p.pop();
        } else if (b.shape === 'TRIANGLE') {
            p.fill(b.color); p.triangle(b.pos.x - 15, b.pos.y - 10, b.pos.x + 15, b.pos.y - 10, b.pos.x, b.pos.y + 15);
        } else if (b.shape === 'METEOR') {
            p.fill(b.color); p.noStroke(); p.circle(b.pos.x, b.pos.y, 20);
            if (globalTimeScale > 0) particles.push({ x: b.pos.x, y: b.pos.y, vx: p.random(-1, 1), vy: p.random(-1, 1), life: 0.5, color: COLORS.BOSS_METEOR, size: p.random(4, 10) });
        } else if (b.shape === 'KNIFE') {
            p.push();
            p.translate(b.pos.x, b.pos.y);
            p.rotate(b.angle);
            p.fill(b.color);
            p.noStroke();
            // Draw knife pointing in direction of angle
            p.triangle(10, 0, -10, -5, -10, 5); 
            p.pop();
        } else {
            p.fill(b.color);
            p.circle(b.pos.x, b.pos.y, b.r * 2);
        }

        if (b.pos.x < -100 || b.pos.x > CANVAS_WIDTH + 100 || b.pos.y < -100 || b.pos.y > CANVAS_HEIGHT + 100) {
          enemyBullets.splice(i, 1);
          continue;
        }

        if (player.invulnerable <= 0 && player.shieldTimer <= 0) {
           const d = p.dist(b.pos.x, b.pos.y, player.pos.x, player.pos.y);
           let collisionSize = b.r;
           if (b.shape === 'TRIANGLE') collisionSize = 12;
           if (b.shape === 'METEOR') collisionSize = 15;
           if (b.shape === 'KNIFE') collisionSize = 8;

           if (d < player.hitbox + collisionSize) {
             player.hp -= b.shape === 'METEOR' ? 30 : 10;
             setHealth(player.hp);
             player.invulnerable = 60;
             createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 10);
             if (b.shape !== 'METEOR') enemyBullets.splice(i, 1); 
           }
        }
      }

      // Boss Body Collision
      if (boss.active && player.invulnerable <= 0 && player.shieldTimer <= 0 && boss.opacity > 200) {
          let dist = p.dist(player.pos.x, player.pos.y, boss.pos.x, boss.pos.y);
          let threshold = boss.radius;
          if (boss.type === 'SQUARE') threshold = BOSS_SQUARE_SIZE/1.5;
          if (boss.type === 'TRIANGLE') threshold = BOSS_TRIANGLE_SIZE;
          if (boss.type === 'HEART') threshold = boss.radius;
          if (boss.type === 'OVAL') threshold = 40; 
          if (boss.type === 'HEXAGON') threshold = BOSS_HEXAGON_SIZE;
          if (boss.type === 'HOURGLASS') threshold = BOSS_HOURGLASS_SIZE;
          
          if (dist < threshold + player.hitbox) {
              player.hp -= 20; 
              setHealth(player.hp);
              player.invulnerable = 90;
              createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 20);
              player.pos.y += 50;
          }
      }

      // PowerUps
      for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        pu.y += 1.5;
        p.noStroke();
        let label = "";
        if (pu.trap) {
            p.fill(COLORS.POWERUP_TRAP); if (frame % 10 < 5) p.fill(COLORS.POWERUP_HEAL); label = "+";
        } else {
            switch(pu.type) {
                case PowerUpType.SPREAD: p.fill(COLORS.POWERUP_SPREAD); label="S"; break;
                case PowerUpType.RAPID: p.fill(COLORS.POWERUP_RAPID); label="R"; break;
                case PowerUpType.HOMING: p.fill(COLORS.POWERUP_HOMING); label="H"; break;
                case PowerUpType.HEAL: p.fill(COLORS.POWERUP_HEAL); label="+"; break;
            }
        }
        p.circle(pu.x, pu.y, pu.radius * 2); p.fill(0); p.textAlign(p.CENTER, p.CENTER); p.textSize(12); p.text(label, pu.x, pu.y);
        if (pu.y > CANVAS_HEIGHT + 20) { powerUps.splice(i, 1); continue; }
        const d = p.dist(pu.x, pu.y, player.pos.x, player.pos.y);
        if (d < player.radius + pu.radius) {
          if (pu.trap) {
              player.hp -= 30; setHealth(player.hp); createExplosion(player.pos.x, player.pos.y, COLORS.POWERUP_TRAP, 15); player.invulnerable = 30;
          } else {
              if (pu.type === PowerUpType.HEAL) { player.hp = Math.min(100, player.hp + 20); setHealth(player.hp); } else {
                 let newType = WeaponType.DEFAULT;
                 if (pu.type === PowerUpType.SPREAD) newType = WeaponType.SPREAD; if (pu.type === PowerUpType.RAPID) newType = WeaponType.RAPID; if (pu.type === PowerUpType.HOMING) newType = WeaponType.HOMING;
                 if (player.weaponType === newType) { player.weaponLevel = Math.min(MAX_WEAPON_LEVEL, player.weaponLevel + 1); player.weaponTimer += 600; } else { player.weaponType = newType; player.weaponLevel = 1; player.weaponTimer = 600; }
              }
              score += 200;
          }
          powerUps.splice(i, 1);
        }
      }

      // Draw Player
      if (player.invulnerable % 10 < 5) {
        p.fill(COLORS.PLAYER);
        if (player.frozen) p.fill(150, 255, 255); // Visual cue for frozen player
        p.stroke(255);
        p.strokeWeight(2);
        p.triangle(player.pos.x, player.pos.y - PLAYER_RADIUS, player.pos.x - PLAYER_RADIUS, player.pos.y + PLAYER_RADIUS, player.pos.x + PLAYER_RADIUS, player.pos.y + PLAYER_RADIUS);
        p.fill(255, 0, 0); p.noStroke(); p.circle(player.pos.x, player.pos.y, player.hitbox * 2);
        
        if (player.shieldTimer > 0) {
            p.noFill(); p.stroke(COLORS.PLAYER_SHIELD); p.strokeWeight(3); p.push(); p.translate(player.pos.x, player.pos.y); p.rotate(frame * 0.1);
            const segments = 3; const r = PLAYER_RADIUS + 15;
            for(let i=0; i<segments; i++) { p.arc(0, 0, r*2, r*2, i * p.TWO_PI/segments, (i * p.TWO_PI/segments) + 1.5); }
            p.pop();
        }
      }
      if (player.invulnerable > 0) player.invulnerable--;

      // Draw Boss
      if (boss.active) {
        p.push();
        if (boss.type === 'CIRCLE') {
            p.fill(COLORS.BOSS_CIRCLE); p.stroke(255); p.strokeWeight(3);
            const br = boss.radius + Math.sin(frame * 0.1) * 5; p.circle(boss.pos.x, boss.pos.y, br * 2);
            p.noFill(); p.stroke(255, 100); p.circle(boss.pos.x, boss.pos.y, br * 2 + 10);
        } else if (boss.type === 'SQUARE') {
            p.translate(boss.pos.x, boss.pos.y); p.rotate(boss.angle);
            p.fill(COLORS.BOSS_SQUARE); p.stroke(255); p.strokeWeight(3); p.rectMode(p.CENTER); p.rect(0, 0, BOSS_SQUARE_SIZE, BOSS_SQUARE_SIZE);
            p.noFill(); p.stroke(255, 200, 0, 150); p.strokeWeight(2); p.rect(0, 0, BOSS_SQUARE_SIZE + 20 + Math.sin(frame * 0.1)*10, BOSS_SQUARE_SIZE + 20 + Math.sin(frame * 0.1)*10);
        } else if (boss.type === 'TRIANGLE') {
            p.translate(boss.pos.x, boss.pos.y); p.rotate(boss.angle);
            p.fill(COLORS.BOSS_TRIANGLE); p.stroke(255, boss.opacity); p.strokeWeight(3);
            const s = BOSS_TRIANGLE_SIZE; const h = s * Math.sqrt(3) / 2; p.triangle(0, -h, -s, h, s, h);
            p.noFill(); p.stroke(200, 255, 200, boss.opacity); const s2 = s * (0.5 + Math.sin(frame * 0.1) * 0.2); const h2 = s2 * Math.sqrt(3) / 2; p.triangle(0, -h2, -s2, h2, s2, h2);
        } else if (boss.type === 'HEART') {
            p.translate(boss.pos.x, boss.pos.y); const scale = 1 + Math.sin(frame * 0.1) * 0.1; p.scale(scale);
            p.fill(COLORS.BOSS_HEART); p.stroke(255); p.strokeWeight(3);
            p.beginShape(); const r = boss.radius; p.vertex(0, r/2); p.bezierVertex(r, -r/2, r*2, -r/2, 0, r*1.5); p.bezierVertex(-r*2, -r/2, -r, -r/2, 0, r/2); p.endShape(p.CLOSE);
            if (boss.shield > 0) { p.noFill(); p.stroke(COLORS.BOSS_SHIELD); p.strokeWeight(4); p.circle(0, r/2, r * 2.5); p.noStroke(); p.fill(COLORS.BOSS_SHIELD); p.rectMode(p.CENTER); p.rect(0, -r, r*2 * (boss.shield/boss.maxShield), 5); }
        } else if (boss.type === 'OVAL') {
             p.translate(boss.pos.x, boss.pos.y); p.scale(boss.squash.x, boss.squash.y);
             p.fill(COLORS.BOSS_OVAL); p.stroke(255); p.strokeWeight(3); p.ellipse(0, 0, 120, 80);
             p.noStroke(); p.fill(200, 150, 255, 200 + Math.sin(frame * 0.5) * 55); p.circle(0, 0, 30 + Math.sin(frame * 0.2) * 10);
             p.noFill(); p.stroke(200, 100, 255, 150); p.strokeWeight(2); p.ellipse(0, 0, 140 + Math.sin(frame * 0.2)*10, 100 + Math.sin(frame * 0.2)*10);
        } else if (boss.type === 'HEXAGON') {
             p.translate(boss.pos.x, boss.pos.y); p.rotate(boss.angle);
             p.fill(COLORS.BOSS_HEXAGON); p.stroke(255); p.strokeWeight(3);
             drawLightningHex(0, 0, BOSS_HEXAGON_SIZE, 0, COLORS.BOSS_HEXAGON);
        } else if (boss.type === 'HOURGLASS') {
             // Draw Ghost Echo first (behind)
             if (currentStageIndex >= 3 && boss.history.length > 30) {
                 const record = boss.history[boss.history.length - 30];
                 p.push();
                 p.translate(record.x, record.y);
                 p.rotate(record.angle);
                 p.tint(255, 100); // Transparent
                 
                 p.fill(COLORS.BOSS_GHOST);
                 p.stroke(255, 100);
                 p.strokeWeight(2);
                 p.triangle(-25, -40, 25, -40, 0, 0);
                 p.triangle(-25, 40, 25, 40, 0, 0);
                 
                 p.pop();
             }

             // --- DRAW SHADOW CLONE (Stage 5) ---
             if (currentStageIndex >= 4) {
                 p.push();
                 p.translate(CANVAS_WIDTH - boss.pos.x, boss.pos.y); // Mirror X
                 
                 p.rotate(boss.angle + Math.sin(frame * 0.05 + 1) * 0.1); 
                 p.fill(COLORS.BOSS_SHADOW);
                 p.stroke(255, 150);
                 p.strokeWeight(2);
                 p.triangle(-25, -40, 25, -40, 0, 0);
                 p.triangle(-25, 40, 25, 40, 0, 0);
                 p.pop();
             }

             p.translate(boss.pos.x, boss.pos.y);
             
             // Smooth rotation for flipping
             boss.angle = p.lerp(boss.angle, boss.targetAngle, 0.1);
             p.rotate(boss.angle + Math.sin(frame * 0.05) * 0.1); 

             p.fill(COLORS.BOSS_HOURGLASS);
             p.stroke(255);
             p.strokeWeight(3);
             
             // Top Triangle
             p.triangle(-25, -40, 25, -40, 0, 0);
             // Bottom Triangle
             p.triangle(-25, 40, 25, 40, 0, 0);
             
             // Sand Animation
             p.noStroke();
             p.fill(255, 255, 200);
             
             // Calculate sand flow based on global frame
             const sandCycle = 120; // Frames for full flow
             const sandLevel = (frame % sandCycle) / sandCycle;
             
             // Top Sand (Decreasing)
             if (globalTimeScale > 0) {
                 p.push();
                 p.translate(0, -20);
                 p.scale(1 - sandLevel);
                 p.triangle(-15, -10, 15, -10, 0, 20); 
                 p.pop();
                 
                 // Bottom Sand (Increasing)
                 p.push();
                 p.translate(0, 20);
                 p.scale(sandLevel);
                 p.triangle(-20, 20, 20, 20, 0, -10);
                 p.pop();
                 
                 // Flow Line
                 p.stroke(255, 255, 200);
                 p.strokeWeight(2);
                 p.line(0, 0, 0, 20);
             } else {
                 // Frozen Sand
                 p.triangle(-15, -30, 15, -30, 0, -10);
                 p.triangle(-15, 30, 15, 30, 0, 10);
             }
        }
        p.pop();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
         let pt = particles[i];
         pt.life -= 0.05;
         
         if (pt.isShockwave) {
             p.noFill();
             p.stroke(pt.color);
             p.strokeWeight(10 * pt.life);
             pt.size += 20;
             p.circle(pt.x, pt.y, pt.size);
         } else {
            pt.x += pt.vx; pt.y += pt.vy;
            p.noStroke(); p.fill(pt.color[0], pt.color[1], pt.color[2], pt.life * 255); p.circle(pt.x, pt.y, pt.size);
         }
         if (pt.life <= 0) particles.splice(i, 1);
      }

      if (shaking) { p.pop(); }

      // Time Stop Overlay
      if (globalTimeScale === 0) {
          p.filter(p.GRAY); // Grayscale effect
          p.noStroke();
          p.fill(COLORS.TIME_FREEZE_OVERLAY);
          p.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          
          p.fill(255);
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(40);
          p.text("TIME STOPPED", CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 50);

          // Ticking Clock Visual
          p.push();
          p.translate(CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 30);
          p.noFill();
          p.stroke(255);
          p.strokeWeight(4);
          p.circle(0, 0, 60);
          
          // Ticks
          for(let i=0; i<12; i++) {
              let a = i * p.TWO_PI/12;
              let x1 = Math.cos(a) * 25;
              let y1 = Math.sin(a) * 25;
              let x2 = Math.cos(a) * 30;
              let y2 = Math.sin(a) * 30;
              p.line(x1, y1, x2, y2);
          }

          // Rotating Hand
          let handAngle = p.map(boss.timeAbilityTimer, 90, 0, 0, p.TWO_PI * 2);
          p.stroke(255, 255, 0);
          p.strokeWeight(3);
          p.line(0, 0, Math.cos(handAngle - p.PI/2) * 25, Math.sin(handAngle - p.PI/2) * 25);
          
          p.fill(255, 255, 0);
          p.noStroke();
          p.circle(0, 0, 6);
          p.pop();
      }

      if (stageTransitionTimer > 0) {
        stageTransitionTimer--;
        p.push(); p.textAlign(p.CENTER, p.CENTER);
        const alpha = p.map(Math.sin(frame * 0.5), -1, 1, 100, 255);
        p.fill(255, 0, 50, alpha); p.textSize(60); p.textStyle(p.BOLD); p.stroke(0); p.strokeWeight(4); p.text(`STAGE ${currentStageIndex + 1}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);
        p.textSize(24); p.fill(255, 200, 200); p.noStroke(); p.text("THREAT LEVEL INCREASING", CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 40);
        p.pop();
      }

      if (boss.hp <= 0 && boss.active) { setGameState(GameState.VICTORY); gameState = GameState.VICTORY; }
      if (player.hp <= 0) { setGameState(GameState.GAME_OVER); gameState = GameState.GAME_OVER; }
    };

    p.resetGame = resetGame;
    p.startGame = (bossType) => {
      resetGame(bossType);
      gameState = GameState.PLAYING;
      setGameState(GameState.PLAYING);
    };
  };
};