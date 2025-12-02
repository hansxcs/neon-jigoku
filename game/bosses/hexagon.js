


import { COLORS, BOSS_HEXAGON_SIZE } from '../../constants.js';
import { Patterns } from '../patterns.js';

export const HexagonBoss = {
    type: 'HEXAGON',
    color: COLORS.BOSS_HEXAGON,

    init: (boss) => {
        boss.spinSpeed = 0.05;
        boss.hexState = 'IDLE';
        boss.hexTimer = 0;
        boss.pendingAttacks = [];
        boss.scale = 1;
    },

    onStageChange: (boss, stage) => {
        boss.spinSpeed = 0.05 + (stage * 0.05);
    },

    drawIntro: (p, boss, introProgress, triggerEffect) => {
        // Lightning Strike
        if (introProgress < 0.5) {
             p.stroke(...COLORS.BOSS_LIGHTNING);
             p.strokeWeight(10 * introProgress);
             p.line(0, -500, 0, 0);
        } else {
             p.scale(p.map(introProgress, 0.5, 1, 0, 1));
             p.stroke(...COLORS.BOSS_HEXAGON); p.strokeWeight(4); p.noFill();
             p.beginShape();
             for(let i=0; i<6; i++) {
                let a = p.TWO_PI/6 * i;
                p.vertex(Math.cos(a)*BOSS_HEXAGON_SIZE, Math.sin(a)*BOSS_HEXAGON_SIZE);
             }
             p.endShape(p.CLOSE);
        }
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, createExplosion, spawnMeteorAttack, stageTransitionTimer } = data;

        boss.angle += boss.spinSpeed;
        if (!boss.hexState) boss.hexState = 'IDLE';

        // State Machine
        switch(boss.hexState) {
            case 'IDLE':
                boss.scale = p.lerp(boss.scale, 1, 0.2);
                if (stage >= 1) { 
                    boss.hexTimer++;
                    let teleportThreshold = 180;
                    if (stage >= 3) teleportThreshold = 90;
                    if (stage >= 4) teleportThreshold = 45; 
                    if (boss.hexTimer > teleportThreshold) { boss.hexState = 'TELEPORT_OUT'; boss.hexTimer = 0; createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 10); }
                }
                boss.pos.y += Math.sin(frame * 0.1) * 2;
                break;
            case 'TELEPORT_OUT':
                boss.scale = p.lerp(boss.scale, 0, 0.2);
                if (boss.scale <= 0.05) {
                    boss.hexState = 'TELEPORT_IN';
                    let nx = p.random(100, p.width - 100);
                    let ny = p.random(50, 250);
                    if (stage >= 4) ny = p.random(50, 400); 
                    boss.pos.x = nx; boss.pos.y = ny;
                }
                break;
            case 'TELEPORT_IN':
                 boss.scale = p.lerp(boss.scale, 1, 0.2);
                 if (boss.scale >= 0.95) {
                     createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 15);
                     // Spawn targeted meteor
                     if (stage >= 1) {
                         spawnMeteorAttack(player.pos.x + p.random(-100, 100), -50, player.pos.x, player.pos.y, 30, 30);
                     }
                     boss.hexState = 'IDLE'; boss.hexTimer = 0;
                 }
                break;
        }

        if (stage >= 4 && frame % 300 < 100) { 
            boss.pos.x = p.lerp(boss.pos.x, p.width/2, 0.1); 
            boss.pos.y = p.lerp(boss.pos.y, p.height/2 - 100, 0.1); 
        }

        // Attacks
        if (stageTransitionTimer < 140) {
             // Process Pending Meteor Attacks
             for (let i = boss.pendingAttacks.length - 1; i >= 0; i--) {
                 let atk = boss.pendingAttacks[i];
                 atk.timer--;
                 
                 // Render Warning Line
                 // Explicitly spread color arrays to avoid p5.js errors
                 if (Array.isArray(COLORS.BOSS_METEOR)) p.stroke(...COLORS.BOSS_METEOR); 
                 else p.stroke(255);
                 
                 p.strokeWeight(Math.max(1, 4 * (1 - atk.timer/60))); 
                 
                 if (atk.timer % 10 < 5) {
                     if (Array.isArray(COLORS.BOSS_LIGHTNING)) p.stroke(...COLORS.BOSS_LIGHTNING); 
                     else p.stroke(0, 255, 255);
                 }
                 
                 // Calculate extended line coordinates (Project backwards and forwards)
                 const EXTEND_DIST = 2000;
                 let startX = atk.x - atk.dx * EXTEND_DIST;
                 let startY = atk.y - atk.dy * EXTEND_DIST;
                 let endX = atk.x + atk.dx * EXTEND_DIST; 
                 let endY = atk.y + atk.dy * EXTEND_DIST;
                 
                 // Jagged Line Logic
                 p.noFill(); p.beginShape(); 
                 p.vertex(startX, startY);
                 
                 let segments = 20; // More segments for longer line
                 for(let j=1; j<segments; j++) { 
                     let t = j/segments; 
                     let px = p.lerp(startX, endX, t); 
                     let py = p.lerp(startY, endY, t); 
                     px += p.random(-5, 5); 
                     py += p.random(-5, 5); 
                     p.vertex(px, py); 
                 }
                 p.vertex(endX, endY); 
                 p.endShape();

                 if (atk.timer <= 0) {
                     spawnBullet(atk.x, atk.y, atk.dx, atk.dy, baseSpeed * 6, COLORS.BOSS_METEOR, 'METEOR');
                     boss.pendingAttacks.splice(i, 1);
                     createExplosion(atk.x, atk.y, COLORS.BOSS_METEOR, 5);
                 }
             }

             if (stage >= 0 && frame % 20 === 0) Patterns.hexagonSpin(p, boss.pos, boss.angle, BOSS_HEXAGON_SIZE, spawnBullet, baseSpeed * 1.5);
             
             // STAGE 1: Meteor Rain
             if (stage === 1 && frame % 50 === 0) {
                 const sx = p.random(p.width);
                 spawnMeteorAttack(sx, -50, sx, p.height, 50, 25);
             }
             
             // STAGE 2+: Heavier Rain
             if (stage >= 2 && frame % 25 === 0) { 
                 const startX1 = p.random(0, p.width); spawnMeteorAttack(startX1, -50, startX1, p.height, 40, 25); 
                 const startX2 = p.random(0, p.width); spawnMeteorAttack(startX2, -50, startX2, p.height, 40, 25); 
             }
             
             // STAGE 3+: Grid
             if (stage >= 3 && frame % 50 === 0) { 
                 spawnMeteorAttack(-50, player.pos.y, p.width, player.pos.y, 40, 20); 
                 spawnMeteorAttack(player.pos.x, -50, player.pos.x, p.height, 40, 20); 
             }
             
             // STAGE 4+: Overload
             if (stage >= 4 && frame % 10 === 0) { 
                 const angle = p.random(p.TWO_PI); const dist = 600; 
                 const sx = p.width/2 + Math.cos(angle) * dist; 
                 const sy = p.height/2 + Math.sin(angle) * dist; 
                 spawnMeteorAttack(sx, sy, player.pos.x, player.pos.y, 30, 30); 
             }
        }
    },

    draw: (p, boss, frame) => {
        p.scale(boss.scale);
        const radius = BOSS_HEXAGON_SIZE;
        
        if (boss.flashTimer > 0) { p.stroke(255); }
        else if (Array.isArray(boss.color)) p.stroke(...boss.color); else p.stroke(0, 255, 255);
        
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
            // Jitter midpoint
            let mx = (x1 + x2) / 2 + p.random(-5, 5);
            let my = (y1 + y2) / 2 + p.random(-5, 5);
            p.vertex(mx, my);
        }
        p.endShape(p.CLOSE);
        if (frame % 5 === 0 && boss.flashTimer <= 0) {
            p.stroke(255, 200);
            p.strokeWeight(1);
            p.line(p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius));
        }
    }
};
