
import { COLORS } from '../../constants.js';
import { Patterns } from '../patterns.js';

export const MathBoss = {
    type: 'MATH',
    color: COLORS.BOSS_MATH,

    init: (boss) => {
        boss.mathState = 'SPIN';
        boss.mathTimer = 120;
        boss.operands = [0, 0];
        boss.operator = '+';
        boss.mathResult = 0;
        boss.displayNums = [0, 0];
    },

    onStageChange: (boss, stage) => {
        // Init
    },

    update: (p, boss, player, data) => {
        const { frame, stage, baseSpeed, spawnBullet, spawnMathParticle, createExplosion, setHealth, stageTransitionTimer } = data;

        // Figure-8 Movement
        if (boss.mathState === 'SPIN') {
             boss.pos.x = p.width / 2 + Math.cos(frame * 0.05) * 100;
             boss.pos.y = 150 + Math.sin(frame * 0.1) * 30; 
        } else {
             boss.pos.x = p.lerp(boss.pos.x, p.width / 2, 0.05);
             boss.pos.y = p.lerp(boss.pos.y, 100, 0.05);
        }

        if (stageTransitionTimer < 140) {
            switch(boss.mathState) {
                case 'SPIN':
                    boss.mathTimer--;
                    if (frame % 5 === 0) {
                        let maxR = 9;
                        if (stage > 1) maxR = 20;
                        if (stage > 3) maxR = 99;
                        boss.displayNums[0] = Math.floor(p.random(1, maxR));
                        boss.displayNums[1] = Math.floor(p.random(1, maxR));
                    }
                    if (boss.mathTimer <= 0) {
                        boss.mathState = 'RESOLVE';
                    }
                    break;
                case 'RESOLVE':
                    const ops = ['+'];
                    if (stage >= 0) ops.push('-');
                    if (stage >= 1) ops.push('/');
                    if (stage >= 1) ops.push('%'); 
                    if (stage >= 2) ops.push('x'); 
                    if (stage >= 2) ops.push('tan'); 
                    if (stage >= 3) ops.push('^'); 
                    if (stage >= 3) ops.push('!'); 
                    if (stage >= 3) { 
                        if (p.random() < 0.3) ops.push('<');
                        if (p.random() < 0.3) ops.push('>');
                    }
                    if (stage >= 4) { 
                        if (p.random() < 0.6) ops.push('PHI'); 
                        if (p.random() < 0.6) ops.push('∫'); 
                    }
                    
                    boss.operator = p.random(ops);
                    
                    let maxRange = 9;
                    if (stage >= 1) maxRange = 20;
                    if (stage >= 2) maxRange = 30;
                    if (stage >= 3) maxRange = 50; 
                    if (stage >= 4) maxRange = 99;
                    
                    // Logic to calculate result based on operator (Moved from sketch)
                    // ... (Simplifying for brevity, copy math logic) ...
                    if (boss.operator === '+') {
                        boss.operands = [Math.floor(p.random(1, maxRange)), Math.floor(p.random(1, maxRange))];
                        boss.mathResult = boss.operands[0] + boss.operands[1];
                    } else if (boss.operator === '-') {
                         boss.operands = [Math.floor(p.random(1, maxRange)), Math.floor(p.random(1, maxRange))];
                         boss.mathResult = boss.operands[0] - boss.operands[1];
                    } else if (boss.operator === '/') {
                         boss.mathResult = Math.floor(p.random(2, 6 + stage)); 
                         const denominator = Math.floor(p.random(2, 5));
                         boss.operands[0] = boss.mathResult * denominator;
                         boss.operands[1] = denominator;
                    } else if (boss.operator === 'x') {
                         const a = Math.floor(p.random(3, 8 + stage));
                         const b = Math.floor(p.random(2, 6 + stage));
                         boss.operands = [a, b];
                         boss.mathResult = a * b; 
                    } else if (boss.operator === '^') {
                         boss.operands[0] = Math.floor(p.random(2, 6)); 
                         boss.operands[1] = Math.floor(p.random(2, 4)); 
                         boss.mathResult = Math.min(150, Math.pow(boss.operands[0], boss.operands[1]));
                    } else if (boss.operator === '%') { 
                         boss.operands[1] = Math.floor(p.random(50, 150)); 
                         boss.operands[0] = "x";
                         boss.mathResult = boss.operands[1];
                    } else if (boss.operator === '!') { 
                         boss.operands[0] = Math.floor(p.random(3, 6)); 
                         boss.operands[1] = 0;
                         let res = 1; for(let i=1; i<=boss.operands[0]; i++) res *= i;
                         boss.mathResult = res;
                    } else if (boss.operator === 'PHI') {
                         boss.mathResult = 150; 
                         boss.operands = [1, 1]; 
                    } else if (boss.operator === 'tan') {
                         boss.mathResult = 20; 
                         boss.operands = [90, 0];
                    } else if (boss.operator === '∫') {
                         boss.mathResult = 100; 
                         boss.operands = [0, 1]; 
                    } else if (boss.operator === '<' || boss.operator === '>') {
                         boss.operands[1] = p.random() > 0.5 ? 0 : 1; 
                         if (boss.operands[1] === 0) boss.operands[0] = Math.floor(p.random(p.width*0.3, p.width*0.7));
                         else boss.operands[0] = Math.floor(p.random(p.height*0.3, p.height*0.7));
                         boss.mathResult = "DANGER";
                    }
                    
                    if (boss.operator !== '<' && boss.operator !== '>') boss.displayNums = [...boss.operands];
                    boss.mathTimer = (boss.operator === '<' || boss.operator === '>') ? 120 : 30;
                    boss.mathState = 'ATTACK';
                    break;
                case 'ATTACK':
                    boss.mathTimer--;
                    // Execute Attack
                    if (boss.operator !== '<' && boss.operator !== '>' && boss.mathTimer === 20) {
                        if (boss.operator === '+') Patterns.mathPlus(p, boss.pos, player.pos, Math.min(boss.mathResult, 50), spawnBullet, baseSpeed + 2);
                        else if (boss.operator === '-') {
                            if (boss.mathResult < 0) { Patterns.mathSide(p, p.width, p.height, p.height/2, spawnBullet, baseSpeed, true); Patterns.mathSide(p, p.width, p.height, p.height/3, spawnBullet, baseSpeed, true); }
                            else { let c = Math.min(Math.abs(boss.mathResult), 20); for(let i=0; i<c; i++) setTimeout(() => Patterns.mathSide(p, p.width, p.height, p.random(100, p.height-100), spawnBullet, baseSpeed, false), i*100); }
                        }
                        else if (boss.operator === '/') Patterns.mathDiv(p, boss.pos, Math.min(boss.mathResult, 15), spawnBullet, baseSpeed);
                        else if (boss.operator === 'x') Patterns.matrixRain(p, p.width, Math.min(boss.mathResult * 2, 80), spawnBullet, baseSpeed);
                        else if (boss.operator === '^') Patterns.mathPowerSpiral(p, boss.pos, boss.mathResult, spawnBullet, baseSpeed);
                        else if (boss.operator === 'tan') Patterns.mathTangent(p, p.width, p.height, 15, spawnBullet, baseSpeed);
                        else if (boss.operator === '%') Patterns.mathModulo(p, p.width, p.height, boss.mathResult, spawnBullet, baseSpeed);
                        else if (boss.operator === '!') Patterns.mathFactorial(p, boss.pos, boss.mathResult, spawnBullet, baseSpeed);
                    }
                    if (boss.operator === 'PHI') Patterns.goldenSpiral(p, boss.pos, frame, spawnBullet, baseSpeed);
                    else if (boss.operator === '∫') Patterns.mathRiemann(p, p.width, p.height, frame, spawnBullet, baseSpeed);
                    else if (boss.operator === '<' || boss.operator === '>') {
                         const axis = boss.operands[1]; const val = boss.operands[0];
                         let danger = false; let x, y, w, h;
                         if (boss.operator === '<') { if (axis === 0) { x=0; y=0; w=val; h=p.height; if(player.pos.x < val) danger=true; } else { x=0; y=0; w=p.width; h=val; if(player.pos.y < val) danger=true; } } 
                         else { if (axis === 0) { x=val; y=0; w=p.width-val; h=p.height; if(player.pos.x > val) danger=true; } else { x=0; y=val; w=p.width; h=p.height-val; if(player.pos.y > val) danger=true; } }
                         
                         // Visuals
                         if (boss.mathTimer > 60) {
                             if (frame % 20 < 10) { p.noStroke(); p.fill(COLORS.BOSS_INEQUALITY_WARN); p.rectMode(p.CORNER); p.rect(x, y, w, h); p.fill(255); p.textSize(40); p.textAlign(p.CENTER, p.CENTER); p.text("WARNING", x + w/2, y + h/2); }
                         } else {
                             p.noStroke(); p.fill(COLORS.BOSS_INEQUALITY); p.rectMode(p.CORNER); p.rect(x, y, w, h); p.fill(255); p.textSize(40); p.textAlign(p.CENTER, p.CENTER); p.text("DANGER", x + w/2, y + h/2);
                             if (danger && player.invulnerable <= 0 && player.shieldTimer <= 0) { player.hp -= 2; setHealth(player.hp); createExplosion(player.pos.x, player.pos.y, COLORS.PLAYER, 1); }
                         }
                    }

                    if (boss.mathTimer <= 0) {
                        boss.mathState = 'SPIN';
                        boss.mathTimer = 60 - (stage * 5); 
                        if (boss.mathTimer < 20) boss.mathTimer = 20;
                    }
                    break;
            }
        }
    },

    draw: (p, boss, frame) => {
       p.rectMode(p.CENTER);
       p.stroke(255); p.strokeWeight(2); p.fill(50);
       p.rect(0, 0, 80, 80, 10);
       
       if (boss.mathState !== 'SPIN') {
           p.noFill(); p.stroke(150); p.strokeWeight(4);
           p.rect(0, 0, 90 + Math.sin(frame * 0.2)*5, 90 + Math.sin(frame * 0.2)*5, 15);
           p.stroke(255, 0, 0, 100); p.line(-40, -40, 40, 40); p.line(40, -40, -40, 40);
       }
       
       p.textAlign(p.CENTER, p.CENTER); p.textSize(40); p.fill(255); p.noStroke();
       if (boss.mathState === 'SPIN') {
           p.text(p.random(['+', '-', '/', 'x', '^', 'Φ', 'tan', '∫', '<', '>', '%', '!']), 0, 0);
           p.textSize(15); p.fill(0, 255, 0); if (frame % 10 < 5) p.text("VULNERABLE", 0, 60);
       } else {
           if (boss.operator === 'PHI') p.textSize(30);
           p.text(boss.operator === 'PHI' ? 'Φ' : boss.operator, 0, 0);
       }
       
       // Floating Numbers
       p.textSize(30); p.fill(200, 200, 255);
       if (boss.operator !== '<' && boss.operator !== '>') {
           p.text(boss.displayNums[0], -80 + Math.sin(frame * 0.1)*10, Math.cos(frame * 0.1)*10);
           p.text(boss.displayNums[1], 80 + Math.sin(frame * 0.1 + p.PI)*10, Math.cos(frame * 0.1 + p.PI)*10);
       }
       // Result
       if (boss.mathState === 'ATTACK' || boss.mathState === 'RESOLVE') {
           p.textSize(20); p.fill(100, 255, 100);
           let res = boss.mathResult;
           if (boss.operator === 'x' || boss.operator === '^' || boss.operator === 'tan' || boss.operator === '∫') res = 'MAX'; 
           if (boss.operator === 'PHI') res = 'GOLDEN';
           if (boss.operator === '<' || boss.operator === '>') res = 'ZONE';
           p.text("= " + res, 0, -60);
       }
       
       // Draw Grid
       p.push();
       p.resetMatrix(); // Reset transform to draw grid relative to screen
       // Actually grid is drawn in sketch.js main loop, so we don't need it here.
       p.pop();
    }
};
