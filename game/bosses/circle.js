


import { COLORS, BOSS_RADIUS } from '../../constants.js';
import { Patterns } from '../patterns.js';

export const CircleBoss = {
    type: 'CIRCLE',
    color: COLORS.BOSS_CIRCLE,
    
    init: (boss) => {
        boss.radius = BOSS_RADIUS;
    },

    onStageChange: (boss, stage) => {
        // No specific stage init for circle
    },

    drawIntro: (p, boss, introProgress, triggerEffect) => {
        // Expands from 0 to Full
        p.noStroke();
        p.fill(...COLORS.BOSS_CIRCLE);
        let currentR = BOSS_RADIUS * introProgress;
        
        // Pulse Effect
        let pulse = Math.sin(introProgress * p.PI * 4) * 10;
        p.circle(0, 0, (currentR * 2) + pulse);
        
        p.noFill(); p.stroke(255, 200 * introProgress); p.strokeWeight(2);
        p.circle(0, 0, (currentR * 2.5) - pulse);
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, stageTransitionTimer } = data;

        // Simple Hover Movement
        boss.pos.x = p.width / 2 + Math.sin(frame * 0.02) * 150;
        boss.pos.y = 100 + Math.sin(frame * 0.05) * 20;

        // Attacks
        if (stageTransitionTimer < 140) {
            if (frame % 60 === 0) Patterns.aimed(p, boss.pos, player.pos, spawnBullet, baseSpeed + 2);
            if (stage >= 0 && frame % 10 === 0) Patterns.spiral(p, boss.pos, frame, spawnBullet, baseSpeed);
            if (stage >= 1) if (frame % 120 === 0) Patterns.ring(p, boss.pos, 12 + stage * 2, spawnBullet, baseSpeed * 0.8);
            if (stage >= 2) if (frame % 90 === 0) Patterns.spread(p, boss.pos, player.pos, 5, p.PI/3, spawnBullet, baseSpeed);
            if (stage >= 3) if (frame % 5 === 0) Patterns.cross(p, boss.pos, frame, spawnBullet, baseSpeed);
            if (stage >= 4) if (frame % 60 === 0) Patterns.converge(p, player.pos, p.width, p.height, spawnBullet, baseSpeed * 0.5);
        }
    },

    draw: (p, boss, frame) => {
        if (boss.flashTimer > 0) { p.fill(255); p.stroke(255); }
        else { p.fill(...COLORS.BOSS_CIRCLE); p.noStroke(); }
        
        // Pulse Effect
        let pulse = Math.sin(frame * 0.1) * 5;
        p.circle(0, 0, (boss.radius * 2) + pulse);
        
        // Inner Ring
        if (boss.flashTimer <= 0) {
            p.noFill(); p.stroke(255, 150); p.strokeWeight(2);
            p.circle(0, 0, (boss.radius * 1.5) - pulse);
        }
    }
};
