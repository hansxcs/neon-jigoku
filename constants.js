export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export const PLAYER_SPEED = 5;
export const PLAYER_RADIUS = 8;
export const PLAYER_HITBOX = 4;

// --- GLOBAL BALANCE VARIABLES ---
export const BASE_BULLET_SPEED_SCALE = 1.0; // CHANGE THIS to globally speed up/slow down all enemy bullets
export const OVAL_BOSS_MOVE_SPEED = 4.0; 

export const BOSS_RADIUS = 40;
export const BOSS_SQUARE_SIZE = 60;
export const BOSS_TRIANGLE_SIZE = 50;
export const BOSS_HEXAGON_SIZE = 45;
export const BOSS_MAX_HP = 5000;

export const BULLET_SPEED = 7;
export const ENEMY_BULLET_BASE_SPEED = 4;

export const COLORS = {
  PLAYER: [0, 255, 255], // Cyan
  PLAYER_BULLET: [200, 255, 255],
  
  BOSS_CIRCLE: [255, 0, 100], // Pink/Red
  BOSS_SQUARE: [255, 200, 0], // Gold/Orange
  BOSS_TRIANGLE: [0, 255, 100], // Neon Green
  BOSS_HEART: [255, 20, 100], // Deep Pink
  BOSS_OVAL: [150, 0, 255], // Neon Purple
  BOSS_HEXAGON: [0, 255, 255], // Electric Cyan
  
  BOSS_BULLET_1: [255, 50, 50],
  BOSS_BULLET_2: [255, 150, 0],
  BOSS_BULLET_3: [255, 0, 255],
  BOSS_BULLET_SQUARE: [255, 255, 100],
  BOSS_BULLET_TRIANGLE: [100, 255, 150],
  BOSS_BULLET_HEART: [255, 100, 180],
  BOSS_BULLET_OVAL: [200, 100, 255],
  BOSS_BULLET_HEXAGON: [200, 255, 255],
  
  BOSS_LASER: [50, 255, 200],
  BOSS_SHIELD: [50, 150, 255], // Blue Shield
  BOSS_METEOR: [255, 255, 255], // Bright White
  BOSS_LIGHTNING: [50, 255, 255], // Electric Blue Lightning

  ENEMY: [255, 80, 80], // Light Red
  ENEMY_BULLET: [255, 150, 150],
  ENEMY_ORBITER: [100, 255, 255],
  ENEMY_MINI_BOSS: [50, 200, 100],
  ENEMY_LUST_ORB: [200, 0, 200],

  POWERUP_SPREAD: [0, 255, 100], // Green
  POWERUP_RAPID: [255, 255, 0],   // Yellow
  POWERUP_HOMING: [150, 100, 255], // Purple
  POWERUP_HEAL: [255, 100, 150], // Pink
  POWERUP_TRAP: [80, 0, 0], // Dark Red Glitch
  
  BLOCKER: [0, 200, 255], // Cyan Blue for blocker fields

  BACKGROUND: 10
};

export const STAGES = 5;
export const MAX_WEAPON_LEVEL = 3;