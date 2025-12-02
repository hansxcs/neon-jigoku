


import { COLORS, OVAL_BOSS_MOVE_SPEED } from '../../constants.js';
import { Patterns } from '../patterns.js';

export const OvalBoss = {
    type: 'OVAL',
    color: COLORS.BOSS_OVAL,

    init: (boss) => {
        boss.squash = { x: 1, y: 1 };
        boss.rollAngle = 0;
    },

    onStageChange: (boss, stage) => {
        let speedMult = 1 + (stage * 0.25);
        if (boss.vel.x > 0) boss.vel.x = OVAL_BOSS_MOVE_SPEED * speedMult; else boss.vel.x = -OVAL_BOSS_MOVE_SPEED * speedMult;
        if (boss.vel.y > 0) boss.vel.y = OVAL_BOSS_MOVE_SPEED * 0.7 * speedMult; else boss.vel.y = -OVAL_BOSS_MOVE_SPEED * 0.7 * speedMult;
    },

    drawIntro: (p, boss, introProgress, triggerEffect) => {
        // Slide in from side
        let xOffset = 600 * (1 - introProgress);
        p.translate(xOffset, 0);
        
        p.fill(...COLORS.BOSS_OVAL); p.noStroke();
        p.ellipse(0, 0, 100, 60);
        
        // Speed lines
        p.stroke(255, 100); p.strokeWeight(2);
        p.line(-60, -20, -100, -20);
        p.line(-60, 20, -100, 20);
        p.line(-60, 0, -120, 0);
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, createExplosion, stageTransitionTimer } = data;

        // Movement & Bouncing
        boss.pos.add(boss.vel);
        
        // Roll animation based on X velocity
        boss.rollAngle += boss.vel.x * 0.05;

        boss.squash.x = p.lerp(boss.squash.x, 1, 0.1);
        boss.squash.y = p.lerp(boss.squash.y, 1, 0.1);
        
        const rX = 60; const rY = 40; 
        let bounced = false;
        
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

        // On Bounce Attacks
        if (bounced && stage >= 4) {
             Patterns.ring(p, boss.pos, 16, (x, y, vx, vy, s, c) => spawnBullet(x, y, vx, vy, s, c, 'CIRCLE', 1), baseSpeed * 1.5);
        }

        if (stageTransitionTimer < 140) {
            if (stage >= 0 && frame % 50 === 0) Patterns.aimed(p, boss.pos, player.pos, (x, y, vx, vy, s, c) => spawnBullet(x, y, vx, vy, s, c, 'CIRCLE', 1), baseSpeed);
            if (stage >= 1 && frame % 90 === 0) {
                const angleOffset = frame * 0.05;
                for (let i = 0; i < 10; i++) {
                    const angle = (p.TWO_PI / 10) * i + angleOffset;
                    spawnBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 1);
                }
            }
            if (stage >= 2 && frame % 120 === 0) {
                 for(let i=0; i<3; i++) {
                     let angle = p.random(p.TWO_PI);
                     spawnBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed * 0.7, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 3);
                 }
            }
            if (stage >= 3 && frame % 60 === 0) Patterns.bounceSpread(p, boss.pos, player.pos, 5, spawnBullet, baseSpeed + 2, 2);
            if (stage >= 4 && frame % 8 === 0) {
                let angle = Math.atan2(player.pos.y - boss.pos.y, player.pos.x - boss.pos.x) + p.random(-0.5, 0.5);
                spawnBullet(boss.pos.x, boss.pos.y, Math.cos(angle), Math.sin(angle), baseSpeed + 4, COLORS.BOSS_BULLET_OVAL, 'CIRCLE', 3);
            }
        }
    },

    draw: (p, boss, frame) => {
        p.rotate(boss.rollAngle);
        
        if (boss.flashTimer > 0) { p.fill(255); p.stroke(255); }
        else { p.fill(...COLORS.BOSS_OVAL); p.noStroke(); }

        p.ellipse(0, 0, 100 * boss.squash.x, 60 * boss.squash.y);
        
        // Details
        if (boss.flashTimer <= 0) {
            p.noFill(); p.stroke(255, 200); p.strokeWeight(2);
            p.ellipse(0, 0, (60 + Math.sin(frame * 0.2)*10) * boss.squash.x, 30 * boss.squash.y);
            p.line(-40, 0, 40, 0); // Axle line to show rotation
        }
    }
};
