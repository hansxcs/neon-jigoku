
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
    },

    onStageChange: (boss, stage) => {
        boss.spinSpeed = 0.05 + (stage * 0.05);
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, createExplosion, spawnMeteorAttack, stageTransitionTimer } = data;

        boss.angle += boss.spinSpeed;
        if (!boss.hexState) boss.hexState = 'IDLE';

        // State Machine
        switch(boss.hexState) {
            case 'IDLE':
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
                boss.hexState = 'TELEPORT_IN';
                let nx = p.random(100, p.width - 100);
                let ny = p.random(50, 250);
                if (stage >= 4) ny = p.random(50, 400); 
                boss.pos.x = nx; boss.pos.y = ny;
                break;
            case 'TELEPORT_IN':
                 createExplosion(boss.pos.x, boss.pos.y, COLORS.BOSS_LIGHTNING, 15);
                 // Spawn targeted meteor
                 if (stage >= 1) {
                     spawnMeteorAttack(player.pos.x + p.random(-100, 100), -50, player.pos.x, player.pos.y, 30, 30);
                 }
                 boss.hexState = 'IDLE'; boss.hexTimer = 0;
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
                 p.stroke(COLORS.BOSS_METEOR);
                 p.strokeWeight(Math.max(1, 4 * (1 - atk.timer/60))); 
                 if (atk.timer % 10 < 5) p.stroke(COLORS.BOSS_LIGHTNING); 
                 
                 let tx = atk.x + atk.dx * 1200; 
                 let ty = atk.y + atk.dy * 1200;
                 
                 // Jagged Line
                 p.noFill(); p.beginShape(); p.vertex(atk.x, atk.y);
                 let segments = 10;
                 for(let j=1; j<segments; j++) { 
                     let t = j/segments; 
                     let px = p.lerp(atk.x, tx, t); 
                     let py = p.lerp(atk.y, ty, t); 
                     px += p.random(-5, 5); 
                     py += p.random(-5, 5); 
                     p.vertex(px, py); 
                 }
                 p.vertex(tx, ty); p.endShape();

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
        const radius = BOSS_HEXAGON_SIZE;
        // Lightning Hexagon Visual
        p.stroke(boss.color);
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
        if (frame % 5 === 0) {
            p.stroke(255, 200);
            p.strokeWeight(1);
            p.line(p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius), p.random(-radius, radius));
        }
    }
};
