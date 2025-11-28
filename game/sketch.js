

import p5 from 'p5';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAYER_SPEED, PLAYER_RADIUS, BOSS_RADIUS, BOSS_SQUARE_SIZE, BOSS_TRIANGLE_SIZE, BOSS_HEXAGON_SIZE, BOSS_MAX_HP, BULLET_SPEED, PLAYER_HITBOX, ENEMY_BULLET_BASE_SPEED, MAX_WEAPON_LEVEL, BASE_BULLET_SPEED_SCALE, OVAL_BOSS_MOVE_SPEED } from '../constants.js';
import { GameState, PowerUpType, WeaponType } from '../types.js';
import { Patterns } from './patterns.js';

export const createSketch = (
  setScore,
  setHealth,
  setBossHealth,
  setGameState,
  setStage,
  setWeaponInfo
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
      weaponLevel: 1, // Added weapon level
      weaponTimer: 0,
      damageMult: 1,
      invulnerable: 0
    };

    // Boss
    let boss = {
      pos: p.createVector(CANVAS_WIDTH / 2, 100),
      vel: p.createVector(3, 2), // For Oval boss bouncing
      hp: BOSS_MAX_HP,
      maxHp: BOSS_MAX_HP,
      type: 'CIRCLE', // 'CIRCLE', 'SQUARE', 'TRIANGLE', 'HEART', 'OVAL', 'HEXAGON'
      phase: 0,
      radius: BOSS_RADIUS,
      angle: 0, // For rotation
      dashState: 'IDLE', // IDLE, CHARGE, DASH, RECOVER (Square boss)
      dashTimer: 0,
      targetPos: null,
      summonTimer: 0, // For Triangle boss
      teleportState: 'IDLE', // IDLE, OUT, WAIT, IN (Triangle boss)
      teleportTimer: 0,
      opacity: 255,
      laserPhase: 'COOLDOWN', // COOLDOWN, CHARGE, FIRE (Triangle Boss)
      laserTimer: 0,
      shield: 0, // For Heart Boss Stage 5
      maxShield: 2000,
      active: true,
      // Oval specific
      squash: { x: 1, y: 1 },
      squashTimer: 0,
      // Hexagon specific
      spinSpeed: 0.05,
      pendingAttacks: [] // Stores {type: 'meteor', x, y, dx, dy, timer, size}
    };

    // Game State Logic
    let currentStageIndex = 0;
    let stageTransitionTimer = 0;

    // Arrays
    let enemies = [];
    let enemyBullets = [];
    let powerUps = [];
    let particles = [];
    let blockers = []; // New blocker array for Square Boss
    
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
    };

    p.touchMoved = () => {
      return false;
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
      boss.shield = 0;
      boss.radius = BOSS_RADIUS;
      boss.laserPhase = 'COOLDOWN';
      boss.laserTimer = 120;
      boss.squash = { x: 1, y: 1 };
      boss.pendingAttacks = [];
      boss.spinSpeed = 0.05;
      
      // Select boss type
      if (bossType !== 'RANDOM') {
          boss.type = bossType;
      } else {
          const bosses = ['CIRCLE', 'SQUARE', 'TRIANGLE', 'HEART', 'OVAL', 'HEXAGON'];
          boss.type = p.random(bosses);
      }

      currentStageIndex = 0;
      stageTransitionTimer = 0;

      enemies = [];
      enemyBullets = [];
      powerUps = [];
      particles = [];
      blockers = [];
      score = 0;
      frame = 0;

      setScore(0);
      setHealth(100);
      setBossHealth(100);
      setStage(1);
      setWeaponInfo({ name: 'DEFAULT', level: 1, timer: 0 });
    };

    // --- Helpers ---
    const spawnEnemyBullet = (x, y, vx, vy, speed, color, shape = 'CIRCLE', bounces = 0) => {
      enemyBullets.push({
        pos: p.createVector(x, y),
        vel: p.createVector(vx * speed, vy * speed),
        color: color,
        r: 6,
        shape: shape, // 'CIRCLE', 'TRIANGLE', 'RECT', 'METEOR'
        angle: 0,
        bounces: bounces // Number of times it can bounce off walls
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

    const spawnMinion = (forcedType = null, forcedX = null, forcedY = null, parent = null) => {
      // Don't spawn if too many, but relax limit for orbiters/mini-boss
      if (enemies.length >= 25) return; // Increased limit slightly for Triangle chaos

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
      if (type === 'lust_orb') { hp = 3000; radius = 100; scoreVal = 2000; } // Increased Size and HP

      enemies.push({
        pos: p.createVector(x, y),
        vel: p.createVector(0, 0),
        hp: hp,
        maxHp: hp,
        radius: radius,
        type: type,
        shootTimer: p.random(60, 120),
        orbitAngle: p.random(p.TWO_PI), // For orbiters
        parent: parent, // For orbiters to know who to orbit
        scoreVal: scoreVal
      });
    };

    const spawnPowerUp = (x, y, guaranteedType) => {
      let type;
      let isTrap = false;
      
      // Heart boss has a chance to spawn traps
      if (boss.type === 'HEART' && p.random() < 0.3) {
          isTrap = true;
          type = PowerUpType.HEAL; // Traps masquerade as heals
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

    // Helper to check collision with active blockers
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
    
    // Line circle intersection helper for lasers
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

    // Helper for Hexagon Lightning
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
            
            // Draw jagged line between vertices
            p.vertex(x1, y1);
            // Midpoint jitter
            let mx = (x1 + x2) / 2 + p.random(-5, 5);
            let my = (y1 + y2) / 2 + p.random(-5, 5);
            p.vertex(mx, my);
        }
        p.endShape(p.CLOSE);
        
        // Inner electric arcs
        if (frame % 5 === 0) {
            p.stroke(255, 200);
            p.strokeWeight(1);
            p.line(p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius));
        }
        p.pop();
    };

    // --- Draw Loop ---
    p.draw = () => {
      p.background(COLORS.BACKGROUND, 100);

      // Camera Shake
      let shaking = stageTransitionTimer > 150;
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

      // --- 1. Player Movement ---
      let dx = 0;
      let dy = 0;
      let inputDetected = false;

      // Input
      if (p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(65)) { dx -= PLAYER_SPEED; inputDetected = true; }
      if (p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(68)) { dx += PLAYER_SPEED; inputDetected = true; }
      if (p.keyIsDown(p.UP_ARROW) || p.keyIsDown(87)) { dy -= PLAYER_SPEED; inputDetected = true; }
      if (p.keyIsDown(p.DOWN_ARROW) || p.keyIsDown(83)) { dy += PLAYER_SPEED; inputDetected = true; }

      // Mouse/Touch fallback
      if (!inputDetected) {
        let targetX = player.pos.x;
        let targetY = player.pos.y;
        
        if (p.touches.length > 0) {
           let t = p.touches[0];
           targetX = t.x;
           targetY = t.y - 40;
        } else if (p.mouseX >= 0 && p.mouseX <= CANVAS_WIDTH && p.mouseY >= 0 && p.mouseY <= CANVAS_HEIGHT) {
           if (p.dist(p.mouseX, p.mouseY, p.pmouseX, p.pmouseY) > 0) {
              targetX = p.mouseX;
              targetY = p.mouseY;
           }
        }
        dx = (targetX - player.pos.x) * 0.2;
        dy = (targetY - player.pos.y) * 0.2;
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
            let exColor = COLORS.BOSS_CIRCLE;
            if (boss.type === 'SQUARE') exColor = COLORS.BOSS_SQUARE;
            if (boss.type === 'TRIANGLE') exColor = COLORS.BOSS_TRIANGLE;
            if (boss.type === 'HEART') exColor = COLORS.BOSS_HEART;
            if (boss.type === 'OVAL') exColor = COLORS.BOSS_OVAL;
            if (boss.type === 'HEXAGON') exColor = COLORS.BOSS_HEXAGON;
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
                // Increase speed each stage
                let speedMult = 1 + (currentStageIndex * 0.25);
                if (boss.vel.x > 0) boss.vel.x = OVAL_BOSS_MOVE_SPEED * speedMult; else boss.vel.x = -OVAL_BOSS_MOVE_SPEED * speedMult;
                if (boss.vel.y > 0) boss.vel.y = OVAL_BOSS_MOVE_SPEED * 0.7 * speedMult; else boss.vel.y = -OVAL_BOSS_MOVE_SPEED * 0.7 * speedMult;
            }
            if (boss.type === 'HEXAGON') {
                // Increase spin speed
                boss.spinSpeed = 0.05 + (currentStageIndex * 0.05);
            }
        }

        // --- GLOBAL BULLET SPEED SCALING ---
        const baseSpeed = (ENEMY_BULLET_BASE_SPEED + (currentStageIndex * 0.5)) * BASE_BULLET_SPEED_SCALE;
        
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
            boss.angle -= 0.02; // Reduced Rotation Speed (was 0.05) to make lasers dodgeable
            boss.summonTimer++;

            // Teleport Logic
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

            // Prism Lasers (Stage 3+)
            // Cycle: COOLDOWN (120) -> CHARGE (60) -> FIRE (90)
            if (currentStageIndex >= 2 && boss.opacity > 200) {
                boss.laserTimer--;
                if (boss.laserTimer <= 0) {
                    if (boss.laserPhase === 'COOLDOWN') {
                        boss.laserPhase = 'CHARGE';
                        boss.laserTimer = 60; // 1 second warning
                    } else if (boss.laserPhase === 'CHARGE') {
                        boss.laserPhase = 'FIRE';
                        boss.laserTimer = 90; // 1.5 seconds fire
                    } else {
                        boss.laserPhase = 'COOLDOWN';
                        boss.laserTimer = 120; // 2 seconds cooldown
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
                            // Warning Line
                            p.stroke(COLORS.BOSS_LASER[0], COLORS.BOSS_LASER[1], COLORS.BOSS_LASER[2], 100);
                            p.strokeWeight(2);
                            p.drawingContext.setLineDash([10, 10]); // Dashed line
                            p.line(vx, vy, lx, ly);
                            p.drawingContext.setLineDash([]);
                        } else if (boss.laserPhase === 'FIRE') {
                             // Active Line
                            p.stroke(COLORS.BOSS_LASER);
                            p.strokeWeight(6);
                            p.line(vx, vy, lx, ly);
                            p.strokeWeight(2);
                            p.stroke(255);
                            p.line(vx, vy, lx, ly);
                            
                            // Laser Collision
                            if (lineCircleIntersect(vx, vy, lx, ly, player.pos.x, player.pos.y, PLAYER_HITBOX + 6)) {
                                if (player.invulnerable <= 0) {
                                    player.hp -= 3; // Higher damage for hit
                                    setHealth(player.hp);
                                    createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 1);
                                }
                            }
                        }
                    }
                }
            }

            // Patterns & Summoning
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
            // Heart Boss Movement
            boss.pos.x = CANVAS_WIDTH / 2 + Math.sin(frame * 0.02) * 100;
            boss.pos.y = 120 + Math.sin(frame * 0.04) * 30;
            
            if (stageTransitionTimer < 140) {
                // Stage 1: Heart Spread
                if (currentStageIndex >= 0) {
                    if (frame % 60 === 0) Patterns.heartSpread(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                }
                // Stage 2: Panty Shot (Triangle)
                if (currentStageIndex >= 1) {
                    if (frame % 60 === 0) Patterns.pantyShot(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 1);
                }
                // Stage 3: Magazine Stream (Rect)
                if (currentStageIndex >= 2) {
                    if (frame % 5 === 0) Patterns.magazineStream(p, boss.pos, frame, spawnEnemyBullet, baseSpeed + 2);
                }
                // Stage 4: Lust Orbs (Spawned in transition) + Mix
                if (currentStageIndex >= 3) {
                     if (frame % 40 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed);
                }
                // Stage 5: Shield + Chaos
                if (currentStageIndex >= 4) {
                     if (frame % 20 === 0) Patterns.chaos(p, boss.pos, spawnEnemyBullet, baseSpeed + 3);
                     if (frame % 90 === 0) Patterns.heartSpread(p, boss.pos, frame, spawnEnemyBullet, baseSpeed);
                }
            }
        } else if (boss.type === 'OVAL') {
            // OVAL BOSS: The Bouncer
            boss.pos.add(boss.vel);
            
            // Squash & Stretch Logic recovery
            boss.squash.x = p.lerp(boss.squash.x, 1, 0.1);
            boss.squash.y = p.lerp(boss.squash.y, 1, 0.1);

            const rX = 60; // Semi-axis X
            const rY = 40; // Semi-axis Y
            let bounced = false;
            
            // Bounce off walls
            if (boss.pos.x < rX || boss.pos.x > CANVAS_WIDTH - rX) {
                boss.vel.x *= -1;
                boss.pos.x = p.constrain(boss.pos.x, rX, CANVAS_WIDTH - rX);
                createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_OVAL, 10);
                // Squash Y, Stretch X (hitting side wall)
                boss.squash.x = 0.6; boss.squash.y = 1.4;
                bounced = true;
            }
            if (boss.pos.y < rY || boss.pos.y > CANVAS_HEIGHT - rY) {
                boss.vel.y *= -1;
                boss.pos.y = p.constrain(boss.pos.y, rY, CANVAS_HEIGHT - rY);
                createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_OVAL, 10);
                // Squash X, Stretch Y (hitting top/bottom wall)
                boss.squash.x = 1.4; boss.squash.y = 0.6;
                bounced = true;
            }
            
            // Wall Impact Nova (Stage 5 Feature)
            if (bounced && currentStageIndex >= 4) {
                 Patterns.ring(p, boss.pos, 16, (x, y, vx, vy, s, c) => spawnEnemyBullet(x, y, vx, vy, s, c, 'CIRCLE', 1), baseSpeed * 1.5);
            }
            
            if (stageTransitionTimer < 140) {
                // Stage 1: Kinetic Start - Single Aimed Bounce
                if (currentStageIndex >= 0 && frame % 50 === 0) {
                    Patterns.aimed(p, boss.pos, player.pos, (x, y, vx, vy, s, c) => spawnEnemyBullet(x, y, vx, vy, s, c, 'CIRCLE', 1), baseSpeed);
                }
                // Stage 2: Ricochet Ring - 10 Bullets, 1 Bounce, Rotating
                if (currentStageIndex >= 1 && frame % 90 === 0) {
                    // Added rotation offset based on frame for spinning web effect
                    const angleOffset = frame * 0.05;
                    for (let i = 0; i < 10; i++) {
                        const angle = (p.TWO_PI / 10) * i + angleOffset;
                        spawnEnemyBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 1);
                    }
                }
                // Stage 3: Bouncing Mines - Large, slow, 3 Bounces
                if (currentStageIndex >= 2 && frame % 120 === 0) {
                     for(let i=0; i<3; i++) {
                         let angle = p.random(p.TWO_PI);
                         spawnEnemyBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed * 0.7, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 3);
                     }
                }
                // Stage 4: Scatter Shot - Spread that bounces 2 times
                if (currentStageIndex >= 3 && frame % 60 === 0) {
                    Patterns.bounceSpread(p, boss.pos, player.pos, 5, spawnEnemyBullet, baseSpeed + 2, 2);
                }
                // Stage 5: Hyper Velocity - Chaos Stream, Multi-bounce + Wall Impact (handled above)
                if (currentStageIndex >= 4 && frame % 8 === 0) {
                    // Rapid fire single stream
                    let angle = Math.atan2(player.pos.y - boss.pos.y, player.pos.x - boss.pos.x) + p.random(-0.5, 0.5);
                    spawnEnemyBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed + 4, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 3);
                }
            }
        } else if (boss.type === 'HEXAGON') {
             // HEXAGON BOSS: The Blitz
             boss.angle += boss.spinSpeed;
             
             // Hex State Machine for Teleportation
             if (!boss.hexState) boss.hexState = 'IDLE';
             if (!boss.hexTimer) boss.hexTimer = 0;

             // State Machine
             switch(boss.hexState) {
                case 'IDLE':
                    if (currentStageIndex >= 1) { // Only teleport stage 2+
                        boss.hexTimer++;
                        // Higher stage = more frequent teleport
                        let teleportThreshold = 180;
                        if (currentStageIndex >= 3) teleportThreshold = 90;
                        if (currentStageIndex >= 4) teleportThreshold = 45; 
                        
                        if (boss.hexTimer > teleportThreshold) {
                            boss.hexState = 'TELEPORT_OUT';
                            boss.hexTimer = 0;
                            // Pre-teleport effect
                            createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 10);
                        }
                    }
                    // Drift
                    boss.pos.y += Math.sin(frame * 0.1) * 2;
                    break;
                case 'TELEPORT_OUT':
                    // Collapse visual
                    // just quick fade or shrink? Let's shrink
                    // For now, logic:
                    boss.hexState = 'TELEPORT_IN';
                    // Pick new position
                    let nx = p.random(100, CANVAS_WIDTH - 100);
                    let ny = p.random(50, 250);
                    if (currentStageIndex >= 4) ny = p.random(50, 400); // More aggressive
                    boss.pos.x = nx;
                    boss.pos.y = ny;
                    break;
                case 'TELEPORT_IN':
                     createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 15);
                     // Lightning attack immediately after teleport
                     if (currentStageIndex >= 1) {
                         Patterns.rapidStream(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 6);
                     }
                     boss.hexState = 'IDLE';
                     boss.hexTimer = 0;
                    break;
             }
             
             // Stage 5 Center Overload State Override
             if (currentStageIndex >= 4 && frame % 300 < 100) {
                 // Force center for huge attack
                 boss.pos.x = p.lerp(boss.pos.x, CANVAS_WIDTH/2, 0.1);
                 boss.pos.y = p.lerp(boss.pos.y, CANVAS_HEIGHT/2 - 100, 0.1);
             }

             if (stageTransitionTimer < 140) {
                 // --- METEOR ATTACK LOGIC ---
                 // Handle Pending Attacks (Warning lines -> Fire)
                 for (let i = boss.pendingAttacks.length - 1; i >= 0; i--) {
                     let atk = boss.pendingAttacks[i];
                     atk.timer--;
                     
                     // Draw JAGGED Warning Line
                     p.stroke(COLORS.BOSS_METEOR);
                     p.strokeWeight(Math.max(1, 4 * (1 - atk.timer/60))); 
                     if (atk.timer % 10 < 5) p.stroke(COLORS.BOSS_LIGHTNING); 
                     
                     // Draw Lightning Line
                     let segments = 10;
                     let lx = atk.x;
                     let ly = atk.y;
                     let tx = atk.x + atk.dx * 1200;
                     let ty = atk.y + atk.dy * 1200;
                     
                     p.noFill();
                     p.beginShape();
                     p.vertex(lx, ly);
                     for(let j=1; j<segments; j++) {
                         let t = j/segments;
                         let px = p.lerp(lx, tx, t);
                         let py = p.lerp(ly, ty, t);
                         // Jitter
                         px += p.random(-5, 5);
                         py += p.random(-5, 5);
                         p.vertex(px, py);
                     }
                     p.vertex(tx, ty);
                     p.endShape();
                     
                     if (atk.timer <= 0) {
                         // Fire Meteor - EXTREME SPEED
                         spawnEnemyBullet(atk.x, atk.y, atk.dx, atk.dy, baseSpeed * 6, COLORS.BOSS_METEOR, 'METEOR');
                         boss.pendingAttacks.splice(i, 1);
                         createExplosion(atk.x, atk.y, COLORS.BOSS_METEOR, 5);
                         // Add screen shake on launch
                         if (currentStageIndex >= 3) stageTransitionTimer = 5; // tiny shake
                     }
                 }

                 // Stage 1: Spin Cycle - Basic Corner Fire
                 if (currentStageIndex >= 0 && frame % 20 === 0) {
                     Patterns.hexagonSpin(p, boss.pos, boss.angle, BOSS_HEXAGON_SIZE, spawnEnemyBullet, baseSpeed * 1.5);
                 }

                 // Stage 2: Blitz Dash - Rapid Aimed (Handled in Teleport mostly)
                 if (currentStageIndex >= 1 && frame % 30 === 0 && boss.hexState === 'IDLE') {
                     Patterns.rapidStream(p, boss.pos, player.pos, spawnEnemyBullet, baseSpeed + 6);
                 }

                 // Stage 3: Meteor Stream - Vertical Rain
                 if (currentStageIndex >= 2 && frame % 25 === 0) { // Faster Rate
                     const startX1 = p.random(0, CANVAS_WIDTH);
                     spawnMeteorAttack(startX1, -50, startX1, CANVAS_HEIGHT, 40, 25);
                     // Double Tap
                     const startX2 = p.random(0, CANVAS_WIDTH);
                     spawnMeteorAttack(startX2, -50, startX2, CANVAS_HEIGHT, 40, 25);
                 }

                 // Stage 4: Crossfire - Grid
                 if (currentStageIndex >= 3 && frame % 50 === 0) { // Faster Rate
                     // Horizontal
                     spawnMeteorAttack(-50, player.pos.y, CANVAS_WIDTH, player.pos.y, 40, 20);
                     // Vertical
                     spawnMeteorAttack(player.pos.x, -50, player.pos.x, CANVAS_HEIGHT, 40, 20);
                 }

                 // Stage 5: Hyper Speed - Chaos
                 if (currentStageIndex >= 4 && frame % 10 === 0) { // Machine Gun Rate
                     const angle = p.random(p.TWO_PI);
                     const dist = 600;
                     const sx = CANVAS_WIDTH/2 + Math.cos(angle) * dist;
                     const sy = CANVAS_HEIGHT/2 + Math.sin(angle) * dist;
                     // Super fast telegraph
                     spawnMeteorAttack(sx, sy, player.pos.x, player.pos.y, 30, 30);
                 }
             }
        }
      }

      // --- 4. Minion & Enemy Logic ---
      
      if (boss.type !== 'TRIANGLE' && frame % 180 === 0 && boss.hp > 0 && stageTransitionTimer === 0) {
        if (boss.type === 'HEART' && p.random() < 0.3) {
           // Heart boss spawns less minions, relies on bullets/traps
        } else {
           spawnMinion();
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        
        if (e.type === 'drone') {
            e.pos.y += 2;
            e.pos.x += Math.sin(frame * 0.05 + i) * 1;
        } else if (e.type === 'swooper') {
            e.pos.y += 3;
            e.pos.x += Math.sin(frame * 0.1 + i) * 3;
        } else if (e.type === 'orbiter') {
            if (e.parent && e.parent.active) {
                e.orbitAngle += 0.05;
                const radius = 80;
                e.pos.x = e.parent.pos.x + Math.cos(e.orbitAngle) * radius;
                e.pos.y = e.parent.pos.y + Math.sin(e.orbitAngle) * radius;
            } else {
                e.pos.y += 5;
            }
        } else if (e.type === 'mini_boss') {
            e.pos.x = p.lerp(e.pos.x, CANVAS_WIDTH / 2 + Math.sin(frame * 0.02 + i) * 200, 0.02);
            e.pos.y = p.lerp(e.pos.y, 200 + Math.sin(frame * 0.04 + i) * 30, 0.02);
        } else if (e.type === 'lust_orb') {
            // Slowly track player
            const angle = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
            e.pos.x += Math.cos(angle) * 0.75; // Slower speed (was 1.5)
            e.pos.y += Math.sin(angle) * 0.75; // Slower speed (was 1.5)
            
            // Draw Lust Orb
            p.fill(COLORS.ENEMY_LUST_ORB);
            p.stroke(255);
            p.strokeWeight(3);
            p.circle(e.pos.x, e.pos.y, e.radius * 2);
            // Shine effect
            p.noStroke();
            p.fill(255, 100);
            p.circle(e.pos.x - e.radius*0.3, e.pos.y - e.radius*0.3, e.radius*0.5);

            // Draw HP
            p.noStroke();
            p.fill(0, 255, 0);
            p.rect(e.pos.x - 40, e.pos.y - e.radius - 15, 80 * (e.hp/e.maxHp), 6);
            
            // Collision with player
            if (player.invulnerable <= 0 && p.dist(e.pos.x, e.pos.y, player.pos.x, player.pos.y) < e.radius + player.hitbox) {
                player.hp -= 50; // Half HP damage
                setHealth(player.hp);
                player.invulnerable = 120;
                createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 20);
                // Don't destroy orb on collision, it's too big/tanky
            }
        }

        if (e.type !== 'lust_orb') {
            // --- ENEMY SHOOTING ---
            e.shootTimer--;
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
    
            // --- DRAW ENEMY ---
            p.stroke(255);
            p.strokeWeight(2);
            
            if (e.type === 'drone') {
                p.fill(COLORS.ENEMY);
                p.rect(e.pos.x - 10, e.pos.y - 10, 20, 20);
            } else if (e.type === 'swooper') {
                p.fill(COLORS.ENEMY);
                p.triangle(e.pos.x, e.pos.y + 10, e.pos.x - 10, e.pos.y - 10, e.pos.x + 10, e.pos.y - 10);
            } else if (e.type === 'orbiter') {
                p.fill(COLORS.ENEMY_ORBITER);
                p.circle(e.pos.x, e.pos.y, e.radius * 2);
            } else if (e.type === 'mini_boss') {
                p.fill(COLORS.ENEMY_MINI_BOSS);
                p.push();
                p.translate(e.pos.x, e.pos.y);
                p.rotate(frame * 0.1);
                p.triangle(0, -20, -17, 10, 17, 10);
                p.pop();
                p.noStroke();
                p.fill(255, 0, 0);
                p.rect(e.pos.x - 20, e.pos.y - 40, 40, 4);
                p.fill(0, 255, 0);
                p.rect(e.pos.x - 20, e.pos.y - 40, 40 * (e.hp/e.maxHp), 4);
            }
        }

        if (e.pos.y > CANVAS_HEIGHT + 50) {
          enemies.splice(i, 1);
        }
      }

      // --- Draw Blockers ---
      for (let b of blockers) {
          p.rectMode(p.CENTER);
          p.noFill();
          p.strokeWeight(3 + Math.sin(frame * 0.2) * 1);
          p.stroke(COLORS.BLOCKER[0], COLORS.BLOCKER[1], COLORS.BLOCKER[2]);
          p.rect(b.pos.x, b.pos.y, b.w, b.h);
          p.fill(COLORS.BLOCKER[0], COLORS.BLOCKER[1], COLORS.BLOCKER[2], 50);
          p.noStroke();
          p.rect(b.pos.x, b.pos.y, b.w, b.h);
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

        // Minion Hit
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
                    if (p.random() < 0.25) spawnPowerUp(e.pos.x, e.pos.y);
                }
                break;
            }
        }
        if (hit) {
            player.bullets.splice(i, 1);
            continue;
        }

        // Boss Hit
        if (boss.active) {
            // Check Shield
            if (boss.shield > 0) {
                if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < boss.radius + 15) {
                    boss.shield -= b.dmg;
                    player.bullets.splice(i, 1);
                    createExplosion(b.pos.x, b.pos.y, COLORS.BOSS_SHIELD, 2);
                    continue; // Bullet absorbed by shield
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
                // Approximate heart hit detection with circle for now
                if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < boss.radius) hitBoss = true;
            } else if (boss.type === 'OVAL') {
                // Approximate with horizontal ellipse collision
                 const dx = Math.abs(b.pos.x - boss.pos.x);
                 const dy = Math.abs(b.pos.y - boss.pos.y);
                 // semi-axes: 60, 40 (adjusted for squash if needed, but keeping hit calculation simple)
                 if ((dx*dx)/(60*60) + (dy*dy)/(40*40) <= 1) hitBoss = true;
            } else if (boss.type === 'HEXAGON') {
                 if (p.dist(b.pos.x, b.pos.y, boss.pos.x, boss.pos.y) < BOSS_HEXAGON_SIZE) hitBoss = true;
            }
            
            if (hitBoss && boss.opacity > 100) {
                boss.hp -= b.dmg;
                score += 10;
                setScore(score);
                setBossHealth((boss.hp / BOSS_MAX_HP) * 100);
                player.bullets.splice(i, 1);
                
                let exColor = COLORS.BOSS_CIRCLE;
                if (boss.type === 'SQUARE') exColor = COLORS.BOSS_SQUARE;
                if (boss.type === 'TRIANGLE') exColor = COLORS.BOSS_TRIANGLE;
                if (boss.type === 'HEART') exColor = COLORS.BOSS_HEART;
                if (boss.type === 'OVAL') exColor = COLORS.BOSS_OVAL;
                if (boss.type === 'HEXAGON') exColor = COLORS.BOSS_HEXAGON;
                
                createExplosion(b.pos.x, b.pos.y, exColor, 2);
                if (p.random() < 0.02) spawnPowerUp(p.random(50, CANVAS_WIDTH-50), 50);
            }
        }
      }

      // Enemy Bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.pos.add(b.vel);
        
        // --- BOUNCING LOGIC ---
        if (b.bounces > 0) {
            let bounced = false;
            if (b.pos.x < 0) { b.pos.x = 0; b.vel.x *= -1; bounced = true; }
            if (b.pos.x > CANVAS_WIDTH) { b.pos.x = CANVAS_WIDTH; b.vel.x *= -1; bounced = true; }
            if (b.pos.y < 0) { b.pos.y = 0; b.vel.y *= -1; bounced = true; }
            if (b.pos.y > CANVAS_HEIGHT) { b.pos.y = CANVAS_HEIGHT; b.vel.y *= -1; bounced = true; }
            
            if (bounced) {
                b.bounces--;
                // Slight sparkle
                createExplosion(b.pos.x, b.pos.y, b.color, 3);
            }
        }

        if (b.shape === 'RECT') {
            b.angle += 0.2;
            p.push();
            p.translate(b.pos.x, b.pos.y);
            p.rotate(b.angle);
            p.fill(b.color);
            p.rect(0, 0, 15, 8);
            p.pop();
        } else if (b.shape === 'TRIANGLE') {
            p.fill(b.color);
            // Draw Large Inverted Triangle ("Panty")
            p.triangle(
                b.pos.x - 15, b.pos.y - 10, // Top Left
                b.pos.x + 15, b.pos.y - 10, // Top Right
                b.pos.x, b.pos.y + 15       // Bottom Center
            );
        } else if (b.shape === 'METEOR') {
            p.fill(b.color);
            p.noStroke();
            p.circle(b.pos.x, b.pos.y, 20);
            // Meteor Trail
            particles.push({
                x: b.pos.x, y: b.pos.y,
                vx: p.random(-1, 1), vy: p.random(-1, 1),
                life: 0.5, color: COLORS.BOSS_METEOR, size: p.random(4, 10)
            });
        } else {
            p.fill(b.color);
            p.circle(b.pos.x, b.pos.y, b.r * 2);
        }

        if (b.pos.x < -100 || b.pos.x > CANVAS_WIDTH + 100 || b.pos.y < -100 || b.pos.y > CANVAS_HEIGHT + 100) {
          enemyBullets.splice(i, 1);
          continue;
        }

        if (player.invulnerable <= 0) {
           const d = p.dist(b.pos.x, b.pos.y, player.pos.x, player.pos.y);
           // Hitbox logic adjustments for large bullets
           let collisionSize = b.r;
           if (b.shape === 'TRIANGLE') collisionSize = 12;
           if (b.shape === 'METEOR') collisionSize = 15;

           if (d < player.hitbox + collisionSize) {
             player.hp -= b.shape === 'METEOR' ? 30 : 10;
             setHealth(player.hp);
             player.invulnerable = 60;
             createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 10);
             if (b.shape !== 'METEOR') enemyBullets.splice(i, 1); // Meteors punch through
           }
        }
      }

      // Boss Body Collision
      if (boss.active && player.invulnerable <= 0 && boss.opacity > 200) {
          let dist = p.dist(player.pos.x, player.pos.y, boss.pos.x, boss.pos.y);
          let threshold = boss.radius;
          if (boss.type === 'SQUARE') threshold = BOSS_SQUARE_SIZE/1.5;
          if (boss.type === 'TRIANGLE') threshold = BOSS_TRIANGLE_SIZE;
          if (boss.type === 'HEART') threshold = boss.radius;
          if (boss.type === 'OVAL') threshold = 40; // Approx minor axis
          if (boss.type === 'HEXAGON') threshold = BOSS_HEXAGON_SIZE;
          
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
            p.fill(COLORS.POWERUP_TRAP);
            // Glitch effect for trap
            if (frame % 10 < 5) p.fill(COLORS.POWERUP_HEAL);
            label = "+";
        } else {
            switch(pu.type) {
                case PowerUpType.SPREAD: p.fill(COLORS.POWERUP_SPREAD); label="S"; break;
                case PowerUpType.RAPID: p.fill(COLORS.POWERUP_RAPID); label="R"; break;
                case PowerUpType.HOMING: p.fill(COLORS.POWERUP_HOMING); label="H"; break;
                case PowerUpType.HEAL: p.fill(COLORS.POWERUP_HEAL); label="+"; break;
            }
        }
        
        p.circle(pu.x, pu.y, pu.radius * 2);
        p.fill(0);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(12);
        p.text(label, pu.x, pu.y);

        if (pu.y > CANVAS_HEIGHT + 20) {
            powerUps.splice(i, 1);
            continue;
        }

        const d = p.dist(pu.x, pu.y, player.pos.x, player.pos.y);
        if (d < player.radius + pu.radius) {
          if (pu.trap) {
              // TRAP DAMAGE
              player.hp -= 30;
              setHealth(player.hp);
              createExplosion(player.pos.x, player.pos.y, COLORS.POWERUP_TRAP, 15);
              player.invulnerable = 30;
          } else {
              // REAL POWERUP
              if (pu.type === PowerUpType.HEAL) {
                 player.hp = Math.min(100, player.hp + 20);
                 setHealth(player.hp);
              } else {
                 let newType = WeaponType.DEFAULT;
                 if (pu.type === PowerUpType.SPREAD) newType = WeaponType.SPREAD;
                 if (pu.type === PowerUpType.RAPID) newType = WeaponType.RAPID;
                 if (pu.type === PowerUpType.HOMING) newType = WeaponType.HOMING;
                 
                 if (player.weaponType === newType) {
                     player.weaponLevel = Math.min(MAX_WEAPON_LEVEL, player.weaponLevel + 1);
                     player.weaponTimer += 600; 
                 } else {
                     player.weaponType = newType;
                     player.weaponLevel = 1;
                     player.weaponTimer = 600;
                 }
              }
              score += 200;
          }
          powerUps.splice(i, 1);
        }
      }

      // Draw Player
      if (player.invulnerable % 10 < 5) {
        p.fill(COLORS.PLAYER);
        p.stroke(255);
        p.strokeWeight(2);
        p.triangle(
            player.pos.x, player.pos.y - PLAYER_RADIUS,
            player.pos.x - PLAYER_RADIUS, player.pos.y + PLAYER_RADIUS,
            player.pos.x + PLAYER_RADIUS, player.pos.y + PLAYER_RADIUS
        );
        p.fill(255, 0, 0);
        p.noStroke();
        p.circle(player.pos.x, player.pos.y, player.hitbox * 2);
      }
      if (player.invulnerable > 0) player.invulnerable--;

      // Draw Boss
      if (boss.active) {
        p.push();
        // Teleport Opacity (for Triangle)
        if (boss.type === 'TRIANGLE') {
             p.tint(255, boss.opacity);
             p.stroke(255, boss.opacity);
        }

        if (boss.type === 'CIRCLE') {
            p.fill(COLORS.BOSS_CIRCLE);
            p.stroke(255);
            p.strokeWeight(3);
            const br = boss.radius + Math.sin(frame * 0.1) * 5;
            p.circle(boss.pos.x, boss.pos.y, br * 2);
            p.noFill();
            p.stroke(255, 100);
            p.circle(boss.pos.x, boss.pos.y, br * 2 + 10);
        } else if (boss.type === 'SQUARE') {
            p.translate(boss.pos.x, boss.pos.y);
            p.rotate(boss.angle);
            p.fill(COLORS.BOSS_SQUARE);
            p.stroke(255);
            p.strokeWeight(3);
            p.rectMode(p.CENTER);
            p.rect(0, 0, BOSS_SQUARE_SIZE, BOSS_SQUARE_SIZE);
            p.noFill();
            p.stroke(255, 200, 0, 150);
            p.strokeWeight(2);
            p.rect(0, 0, BOSS_SQUARE_SIZE + 20 + Math.sin(frame * 0.1)*10, BOSS_SQUARE_SIZE + 20 + Math.sin(frame * 0.1)*10);
        } else if (boss.type === 'TRIANGLE') {
            p.translate(boss.pos.x, boss.pos.y);
            p.rotate(boss.angle);
            p.fill(COLORS.BOSS_TRIANGLE);
            p.stroke(255, boss.opacity);
            p.strokeWeight(3);
            const s = BOSS_TRIANGLE_SIZE;
            const h = s * Math.sqrt(3) / 2;
            p.triangle(0, -h, -s, h, s, h);
            p.noFill();
            p.stroke(200, 255, 200, boss.opacity);
            const s2 = s * (0.5 + Math.sin(frame * 0.1) * 0.2);
            const h2 = s2 * Math.sqrt(3) / 2;
            p.triangle(0, -h2, -s2, h2, s2, h2);
        } else if (boss.type === 'HEART') {
            p.translate(boss.pos.x, boss.pos.y);
            const scale = 1 + Math.sin(frame * 0.1) * 0.1;
            p.scale(scale);
            
            p.fill(COLORS.BOSS_HEART);
            p.stroke(255);
            p.strokeWeight(3);
            
            // Draw Heart
            p.beginShape();
            const r = boss.radius;
            // Bezier Heart approximation
            p.vertex(0, r/2); 
            p.bezierVertex(r, -r/2, r*2, -r/2, 0, r*1.5);
            p.bezierVertex(-r*2, -r/2, -r, -r/2, 0, r/2);
            p.endShape(p.CLOSE);

            // Shield Visual
            if (boss.shield > 0) {
                 p.noFill();
                 p.stroke(COLORS.BOSS_SHIELD);
                 p.strokeWeight(4);
                 p.circle(0, r/2, r * 2.5);
                 // Shield Bar
                 p.noStroke();
                 p.fill(COLORS.BOSS_SHIELD);
                 p.rectMode(p.CENTER);
                 p.rect(0, -r, r*2 * (boss.shield/boss.maxShield), 5);
            }
        } else if (boss.type === 'OVAL') {
             p.translate(boss.pos.x, boss.pos.y);
             // Squash & Stretch Transform
             p.scale(boss.squash.x, boss.squash.y);

             p.fill(COLORS.BOSS_OVAL);
             p.stroke(255);
             p.strokeWeight(3);
             // Stretched Circle (Oval)
             p.ellipse(0, 0, 120, 80);
             
             // Pulsing Core
             p.noStroke();
             p.fill(200, 150, 255, 200 + Math.sin(frame * 0.5) * 55);
             p.circle(0, 0, 30 + Math.sin(frame * 0.2) * 10);

             p.noFill();
             p.stroke(200, 100, 255, 150);
             p.strokeWeight(2);
             p.ellipse(0, 0, 140 + Math.sin(frame * 0.2)*10, 100 + Math.sin(frame * 0.2)*10);
        } else if (boss.type === 'HEXAGON') {
             p.translate(boss.pos.x, boss.pos.y);
             p.rotate(boss.angle);
             p.fill(COLORS.BOSS_HEXAGON);
             p.stroke(255);
             p.strokeWeight(3);
             drawLightningHex(0, 0, BOSS_HEXAGON_SIZE, 0, COLORS.BOSS_HEXAGON);
        }
        p.pop();
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
         let pt = particles[i];
         pt.x += pt.vx;
         pt.y += pt.vy;
         pt.life -= 0.05;
         
         p.noStroke();
         p.fill(pt.color[0], pt.color[1], pt.color[2], pt.life * 255);
         p.circle(pt.x, pt.y, pt.size);
         
         if (pt.life <= 0) particles.splice(i, 1);
      }

      if (shaking) {
          p.pop();
      }

      if (stageTransitionTimer > 0) {
        stageTransitionTimer--;
        p.push();
        p.textAlign(p.CENTER, p.CENTER);
        const alpha = p.map(Math.sin(frame * 0.5), -1, 1, 100, 255);
        p.fill(255, 0, 50, alpha);
        p.textSize(60);
        p.textStyle(p.BOLD);
        p.stroke(0);
        p.strokeWeight(4);
        p.text(`STAGE ${currentStageIndex + 1}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 20);
        p.textSize(24);
        p.fill(255, 200, 200);
        p.noStroke();
        p.text("THREAT LEVEL INCREASING", CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 40);
        p.pop();
      }

      if (boss.hp <= 0 && boss.active) {
        setGameState(GameState.VICTORY);
        gameState = GameState.VICTORY;
      }
      if (player.hp <= 0) {
        setGameState(GameState.GAME_OVER);
        gameState = GameState.GAME_OVER;
      }
    };

    p.resetGame = resetGame;
    p.startGame = (bossType) => {
      resetGame(bossType);
      gameState = GameState.PLAYING;
      setGameState(GameState.PLAYING);
    };
  };
};

