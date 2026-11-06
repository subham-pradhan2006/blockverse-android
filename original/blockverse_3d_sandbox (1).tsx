import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars, PointerLockControls } from '@react-three/drei';
import {
  Play, Compass, Hammer, ShieldAlert, Sparkles, FolderOpen, Settings,
  Volume2, VolumeX, RotateCcw, RotateCw, Save, Download, Upload,
  Trash2, Plus, Heart, Flame, Award, Sun, Moon, HelpCircle,
  Maximize2, Layers, Check, X, ChevronRight, Sliders, Package, Pickaxe,
  Sword, Utensils, Skull, PawPrint, Zap
} from 'lucide-react';

// ============================================================================
// 1. PROCEDURAL NOISE & MATH UTILITIES
// ============================================================================
class FastSimplexNoise {
  constructor(seed = 1337) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    let s = typeof seed === 'string' ? this.hashString(seed) : seed;
    for (let i = 0; i < 256; i++) this.p[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const r = s % (i + 1);
      const t = this.p[i];
      this.p[i] = this.p[r];
      this.p[r] = t;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }
  hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return Math.abs(h) || 1337;
  }
  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const grad3 = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [1, 0], [-1, 0],
      [0, 1], [0, -1], [0, 1], [0, -1]
    ];
    let n0, n1, n2;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2); }
    return 70.0 * (n0 + n1 + n2);
  }
  fbm(x, y, octaves = 3, persistence = 0.5, scale = 0.03) {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }
}

// ============================================================================
// 2. WEB AUDIO SYNTHESIZER FOR SOUND EFFECTS
// ============================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  play(type) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === 'place') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(290, now + 0.08);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'break') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'step') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(95 + Math.random() * 25, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'relic') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.5, now + 0.24);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'craft') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.setValueAtTime(510, now + 0.07);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'hurt') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'sword') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'eat') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.setValueAtTime(310, now + 0.06);
        osc.frequency.setValueAtTime(250, now + 0.12);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'sheep') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(250, now + 0.22);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'cluck') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(790, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'zombie') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(105, now);
        osc.frequency.linearRampToValueAtTime(75, now + 0.28);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Ignore audio errors on restricted autoplay
    }
  }
}
const soundFX = new SoundEngine();

// ============================================================================
// 3. BLOCK DEFINITIONS, WEAPONS, MEAT/FOOD, MOBS & PROCEDURAL TEXTURES
// ============================================================================
const BLOCK_DEFS = {
  1:  { id: 1,  name: 'Grass Block',   hardness: 0.6, color: '#569c36', topColor: '#63b33e', sideGrass: true,  solid: true,  category: 'Nature' },
  2:  { id: 2,  name: 'Dirt',          hardness: 0.5, color: '#866043', solid: true,  category: 'Nature' },
  3:  { id: 3,  name: 'Stone',         hardness: 1.4, color: '#7d7d7d', solid: true,  category: 'Stone', drop: 4 },
  4:  { id: 4,  name: 'Cobblestone',   hardness: 1.5, color: '#686868', solid: true,  category: 'Stone', pattern: 'cobble' },
  5:  { id: 5,  name: 'Sand',          hardness: 0.5, color: '#dfd69f', solid: true,  category: 'Nature' },
  6:  { id: 6,  name: 'Oak Log',       hardness: 1.1, color: '#6b5130', topColor: '#a68556', sideBark: true,   solid: true,  category: 'Wood' },
  7:  { id: 7,  name: 'Oak Planks',    hardness: 1.0, color: '#a88754', solid: true,  category: 'Wood', pattern: 'planks' },
  8:  { id: 8,  name: 'Oak Leaves',    hardness: 0.2, color: '#3b7a28', solid: true,  category: 'Nature', pattern: 'leaves' },
  9:  { id: 9,  name: 'Water',         hardness: 999, color: '#2b65ec', solid: false, transparent: true, opacity: 0.68, category: 'Liquid' },
  10: { id: 10, name: 'Glass',         hardness: 0.3, color: '#d8f6ff', solid: true,  transparent: true, opacity: 0.45, pattern: 'glass', category: 'Building' },
  11: { id: 11, name: 'Brick Block',   hardness: 1.6, color: '#9c4535', solid: true,  pattern: 'brick', category: 'Building' },
  12: { id: 12, name: 'Gold Ore',      hardness: 2.0, color: '#7d7d7d', speckColor: '#f5d142', solid: true, category: 'Ore' },
  13: { id: 13, name: 'Diamond Block', hardness: 2.4, color: '#4aedd9', pattern: 'diamond', solid: true, category: 'Ore' },
  14: { id: 14, name: 'Glowstone',     hardness: 0.6, color: '#ffcf54', emissive: '#ffae19', pattern: 'glow', solid: true, category: 'Light' },
  15: { id: 15, name: 'Snow Block',    hardness: 0.4, color: '#f3f8fa', solid: true,  category: 'Nature' },
  16: { id: 16, name: 'Bookshelf',     hardness: 1.0, color: '#a88754', topColor: '#a88754', sideBooks: true, solid: true, category: 'Building' },
  17: { id: 17, name: 'TNT Block',     hardness: 0.4, color: '#d1382a', topColor: '#c93c2e', sideTNT: true, solid: true, category: 'Special' },
  18: { id: 18, name: 'Obsidian',      hardness: 3.5, color: '#1e162b', speckColor: '#3c2a56', solid: true, category: 'Stone' },
  19: { id: 19, name: 'Relic Crystal', hardness: 0.5, color: '#d946ef', emissive: '#c026d3', pattern: 'relic', solid: true, category: 'Special' },
  // New Expanded World Blocks (IDs 20 - 29)
  20: { id: 20, name: 'Lava Block',    hardness: 999, color: '#ff5500', emissive: '#ff3300', pattern: 'glow', solid: false, category: 'Liquid' },
  21: { id: 21, name: 'Packed Ice',    hardness: 0.6, color: '#9be2ff', transparent: true, opacity: 0.82, pattern: 'glass', solid: true, category: 'Nature' },
  22: { id: 22, name: 'White Wool',    hardness: 0.4, color: '#f1f5f9', solid: true, category: 'Building' },
  23: { id: 23, name: 'Hay Bale',      hardness: 0.5, color: '#eab308', topColor: '#ca8a04', sideBark: true, solid: true, category: 'Nature' },
  24: { id: 24, name: 'Furnace / Campfire', hardness: 1.4, color: '#52525b', speckColor: '#f97316', emissive: '#ea580c', solid: true, category: 'Special' },
  25: { id: 25, name: 'Lantern Torch', hardness: 0.3, color: '#fde047', emissive: '#facc15', pattern: 'glow', solid: true, category: 'Light' },
  26: { id: 26, name: 'Emerald Block', hardness: 2.2, color: '#10b981', pattern: 'diamond', solid: true, category: 'Ore' },
  27: { id: 27, name: 'Basalt Rock',   hardness: 1.5, color: '#33363f', pattern: 'cobble', solid: true, category: 'Stone' },
  28: { id: 28, name: 'Giant Mushroom',hardness: 0.6, color: '#e11d48', speckColor: '#fef2f2', solid: true, category: 'Nature' },

  // Craftable Pickaxes (IDs 101 - 103)
  101: { id: 101, name: 'Wood Pickaxe',  isTool: true, speedMultiplier: 2.2, damage: 3, color: '#a88754', category: 'Tool' },
  102: { id: 102, name: 'Stone Pickaxe', isTool: true, speedMultiplier: 3.8, damage: 4, color: '#7d7d7d', category: 'Tool' },
  103: { id: 103, name: 'Diamond Pick',  isTool: true, speedMultiplier: 7.0, damage: 5, color: '#4aedd9', category: 'Tool' },

  // Craftable Weapons / Swords (IDs 104 - 107)
  104: { id: 104, name: 'Wooden Sword',  isTool: true, isWeapon: true, speedMultiplier: 1.2, damage: 6,  color: '#a88754', category: 'Weapon' },
  105: { id: 105, name: 'Stone Sword',   isTool: true, isWeapon: true, speedMultiplier: 1.4, damage: 8,  color: '#9ca3af', category: 'Weapon' },
  106: { id: 106, name: 'Diamond Sword', isTool: true, isWeapon: true, speedMultiplier: 1.8, damage: 14, color: '#38bdf8', category: 'Weapon' },
  107: { id: 107, name: 'Ember Staff',   isTool: true, isWeapon: true, speedMultiplier: 2.0, damage: 18, color: '#f97316', category: 'Weapon' },

  // Meat, Food & Animal Drops (IDs 201 - 212)
  201: { id: 201, name: 'Raw Mutton',      isFood: true, hungerRestore: 3,  heal: 2,  color: '#f43f5e', cookedId: 202, category: 'Food' },
  202: { id: 202, name: 'Cooked Mutton',   isFood: true, hungerRestore: 8,  heal: 6,  color: '#9f1239', category: 'Food' },
  203: { id: 203, name: 'Raw Chicken',     isFood: true, hungerRestore: 2,  heal: 2,  color: '#fda4af', cookedId: 204, category: 'Food' },
  204: { id: 204, name: 'Roast Chicken',   isFood: true, hungerRestore: 7,  heal: 6,  color: '#d97706', category: 'Food' },
  205: { id: 205, name: 'Raw Beef',        isFood: true, hungerRestore: 3,  heal: 2,  color: '#dc2626', cookedId: 206, category: 'Food' },
  206: { id: 206, name: 'Cooked Steak',    isFood: true, hungerRestore: 9,  heal: 8,  color: '#78350f', category: 'Food' },
  207: { id: 207, name: 'Raw Porkchop',    isFood: true, hungerRestore: 3,  heal: 2,  color: '#fb7185', cookedId: 208, category: 'Food' },
  208: { id: 208, name: 'Cooked Porkchop', isFood: true, hungerRestore: 8,  heal: 7,  color: '#b45309', category: 'Food' },
  209: { id: 209, name: 'Fresh Egg',       isFood: true, hungerRestore: 2,  heal: 2,  color: '#fef3c7', category: 'Food' },
  210: { id: 210, name: 'Golden Apple',    isFood: true, hungerRestore: 10, heal: 14, color: '#facc15', category: 'Food' },
  211: { id: 211, name: 'Feather',         isItem: true, color: '#f8fafc', category: 'Material' },
  212: { id: 212, name: 'Leather Hide',    isItem: true, color: '#92400e', category: 'Material' }
};

const ALL_BLOCK_IDS = Object.keys(BLOCK_DEFS).map(Number);
const RENDERABLE_BLOCK_IDS = ALL_BLOCK_IDS.filter(
  id => !BLOCK_DEFS[id].isTool && !BLOCK_DEFS[id].isFood && !BLOCK_DEFS[id].isItem
);

const MOB_TYPES = {
  sheep: {
    type: 'sheep', name: 'Sheep', hostile: false, maxHp: 12, speed: 1.7,
    color: '#f8fafc', faceColor: '#334155', scale: [0.85, 0.75, 1.1],
    drops: [{ id: 201, count: 2 }, { id: 22, count: 1 }]
  },
  hen: {
    type: 'hen', name: 'Hen (Chicken)', hostile: false, maxHp: 6, speed: 2.3,
    color: '#ffffff', faceColor: '#f59e0b', wattle: '#ef4444', scale: [0.48, 0.5, 0.55],
    drops: [{ id: 203, count: 1 }, { id: 211, count: 2 }, { id: 209, count: 1 }]
  },
  cow: {
    type: 'cow', name: 'Cow', hostile: false, maxHp: 16, speed: 1.5,
    color: '#5c3a21', faceColor: '#d6c7b2', scale: [0.95, 0.88, 1.25],
    drops: [{ id: 205, count: 2 }, { id: 212, count: 1 }]
  },
  pig: {
    type: 'pig', name: 'Pig', hostile: false, maxHp: 12, speed: 1.8,
    color: '#f472b6', faceColor: '#fbcfe8', scale: [0.8, 0.68, 1.05],
    drops: [{ id: 207, count: 2 }]
  },
  zombie: {
    type: 'zombie', name: 'Zombie', hostile: true, maxHp: 22, speed: 2.7, damage: 3,
    color: '#4d7c0f', shirtColor: '#0284c7', pantsColor: '#312e81',
    drops: [{ id: 201, count: 1 }, { id: 12, count: 1 }]
  },
  skeleton: {
    type: 'skeleton', name: 'Skeleton', hostile: true, maxHp: 18, speed: 3.0, damage: 4,
    color: '#e2e8f0', shirtColor: '#94a3b8', pantsColor: '#64748b',
    drops: [{ id: 209, count: 2 }, { id: 25, count: 2 }]
  },
  spider: {
    type: 'spider', name: 'Cave Spider', hostile: true, maxHp: 16, speed: 3.9, damage: 3,
    color: '#1e1b4b', eyeColor: '#ef4444',
    drops: [{ id: 22, count: 2 }, { id: 26, count: 1 }]
  },
  slime: {
    type: 'slime', name: 'Magma Slime', hostile: true, maxHp: 16, speed: 2.5, damage: 4,
    color: '#f97316', coreColor: '#fde047',
    drops: [{ id: 14, count: 2 }, { id: 210, count: 1 }]
  }
};

const CRAFTING_RECIPES = [
  { id: 'planks',   result: { id: 7, count: 4 },   ingredients: [{ id: 6, count: 1 }], desc: '1 Oak Log → 4 Oak Planks' },
  { id: 'wsword',   result: { id: 104, count: 1 }, ingredients: [{ id: 7, count: 2 }, { id: 6, count: 1 }], desc: '2 Planks + 1 Log → Wooden Sword (6 DMG)' },
  { id: 'ssword',   result: { id: 105, count: 1 }, ingredients: [{ id: 4, count: 2 }, { id: 6, count: 1 }], desc: '2 Cobble + 1 Log → Stone Sword (8 DMG)' },
  { id: 'dsword',   result: { id: 106, count: 1 }, ingredients: [{ id: 13, count: 1 }, { id: 6, count: 1 }], desc: '1 Diamond + 1 Log → Diamond Sword (14 DMG)' },
  { id: 'estaff',   result: { id: 107, count: 1 }, ingredients: [{ id: 12, count: 2 }, { id: 14, count: 1 }], desc: '2 Gold + 1 Glowstone → Ember Staff (18 DMG)' },
  { id: 'wpick',    result: { id: 101, count: 1 }, ingredients: [{ id: 7, count: 3 }, { id: 6, count: 1 }], desc: '3 Planks + 1 Log → Wood Pickaxe (2.2x Mine)' },
  { id: 'spick',    result: { id: 102, count: 1 }, ingredients: [{ id: 4, count: 3 }, { id: 6, count: 1 }], desc: '3 Cobble + 1 Log → Stone Pickaxe (3.8x Mine)' },
  { id: 'dpick',    result: { id: 103, count: 1 }, ingredients: [{ id: 13, count: 1 }, { id: 6, count: 1 }], desc: '1 Diamond + 1 Log → Diamond Pick (7x Mine)' },
  { id: 'furnace',  result: { id: 24, count: 1 },  ingredients: [{ id: 4, count: 4 }], desc: '4 Cobble → 1 Furnace / Campfire' },
  { id: 'torch',    result: { id: 25, count: 4 },  ingredients: [{ id: 6, count: 1 }], desc: '1 Oak Log → 4 Lantern Torches' },
  { id: 'gapple',   result: { id: 210, count: 1 }, ingredients: [{ id: 12, count: 1 }, { id: 209, count: 1 }], desc: '1 Gold Ore + 1 Egg → 1 Golden Apple (+14 HP)' },
  { id: 'bricks',   result: { id: 11, count: 2 },  ingredients: [{ id: 2, count: 2 }, { id: 4, count: 2 }], desc: '2 Dirt + 2 Cobble → 2 Bricks' },
  { id: 'glass',    result: { id: 10, count: 2 },  ingredients: [{ id: 5, count: 2 }], desc: '2 Sand → 2 Glass' },
  { id: 'glow',     result: { id: 14, count: 2 },  ingredients: [{ id: 12, count: 1 }, { id: 10, count: 1 }], desc: '1 Gold Ore + 1 Glass → 2 Glowstone' },
  { id: 'books',    result: { id: 16, count: 1 },  ingredients: [{ id: 7, count: 4 }], desc: '4 Oak Planks → 1 Bookshelf' },
  { id: 'tnt',      result: { id: 17, count: 1 },  ingredients: [{ id: 5, count: 2 }, { id: 4, count: 2 }], desc: '2 Sand + 2 Cobble → 1 TNT Block' },
  { id: 'diamond',  result: { id: 13, count: 1 },  ingredients: [{ id: 12, count: 3 }], desc: '3 Gold Ore → 1 Diamond Block' },
];

const COOKING_RECIPES = [
  { rawId: 201, cookedId: 202, label: 'Cook Raw Mutton → Cooked Mutton (+8 Hunger / +6 HP)' },
  { rawId: 203, cookedId: 204, label: 'Cook Raw Chicken → Roast Chicken (+7 Hunger / +6 HP)' },
  { rawId: 205, cookedId: 206, label: 'Cook Raw Beef → Cooked Steak (+9 Hunger / +8 HP)' },
  { rawId: 207, cookedId: 208, label: 'Cook Raw Porkchop → Cooked Porkchop (+8 Hunger / +7 HP)' },
];

// Generate 16x16 pixel art data URLs & Three.js CanvasTextures
const ICON_CACHE = {};
const MATERIAL_CACHE = {};

function shadeHex(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function createPixelCanvas(def, faceType = 'side') {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  if (def.isWeapon) {
    ctx.clearRect(0, 0, 16, 16);
    // Hilt & guard
    ctx.fillStyle = '#5c4028';
    ctx.fillRect(2, 12, 3, 3);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(4, 9, 4, 2);
    ctx.fillRect(5, 8, 2, 4);
    // Diagonal sword blade
    ctx.fillStyle = def.color;
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(6 + i, 8 - i, 3, 3);
    }
    ctx.fillStyle = shadeHex(def.color, 35);
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(6 + i, 8 - i, 1, 1);
    }
    return canvas;
  }

  if (def.isTool) {
    ctx.clearRect(0, 0, 16, 16);
    // Draw wooden handle
    ctx.fillStyle = '#6b5130';
    for (let i = 2; i < 13; i++) {
      ctx.fillRect(i, 15 - i, 2, 2);
    }
    // Draw pickaxe head
    ctx.fillStyle = def.color;
    ctx.fillRect(8, 2, 6, 2);
    ctx.fillRect(12, 4, 2, 6);
    ctx.fillRect(10, 3, 3, 3);
    return canvas;
  }

  if (def.isFood || def.isItem) {
    ctx.clearRect(0, 0, 16, 16);
    if (def.id === 209) {
      // Egg icon
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(5, 3, 6, 10);
      ctx.fillRect(4, 5, 8, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 4, 2, 2);
      return canvas;
    }
    // Drumstick / Steak / Golden Apple icon
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(2, 11, 4, 3);
    ctx.fillRect(1, 12, 2, 3);
    ctx.fillStyle = def.color;
    ctx.fillRect(4, 4, 9, 8);
    ctx.fillRect(5, 3, 7, 10);
    ctx.fillStyle = shadeHex(def.color, 28);
    ctx.fillRect(6, 5, 4, 3);
    ctx.fillStyle = shadeHex(def.color, -25);
    ctx.fillRect(5, 10, 6, 2);
    return canvas;
  }

  let baseColor = def.color;
  if (faceType === 'top' && def.topColor) baseColor = def.topColor;
  if (faceType === 'bottom' && def.id === 1) baseColor = '#866043';

  // Base noisy pixel fill
  let seed = def.id * 97 + (faceType === 'top' ? 13 : 31);
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed % 1000) / 1000;
  };

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const variance = (rand() - 0.5) * 14;
      ctx.fillStyle = shadeHex(baseColor, variance);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Special face overlays
  if (faceType === 'side' && def.sideGrass) {
    // Dirt body with green grass top fringe
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const grassDepth = 3 + ((x * 7 + 3) % 3);
        const col = y < grassDepth ? def.topColor : '#866043';
        ctx.fillStyle = shadeHex(col, (rand() - 0.5) * 14);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else if (faceType === 'side' && def.sideBark) {
    for (let x = 0; x < 16; x++) {
      const stripe = (x % 4 === 0) ? -12 : 4;
      for (let y = 0; y < 16; y++) {
        ctx.fillStyle = shadeHex(def.color, stripe + (rand() - 0.5) * 10);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else if (faceType === 'top' && def.sideBark) {
    ctx.strokeStyle = '#6b5130';
    ctx.lineWidth = 1;
    ctx.strokeRect(1.5, 1.5, 13, 13);
    ctx.strokeRect(4.5, 4.5, 7, 7);
  } else if (def.pattern === 'planks') {
    ctx.fillStyle = shadeHex(def.color, -18);
    for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    ctx.fillRect(7, 0, 1, 4);
    ctx.fillRect(12, 4, 1, 4);
    ctx.fillRect(4, 8, 1, 4);
    ctx.fillRect(10, 12, 1, 4);
  } else if (def.pattern === 'brick') {
    ctx.fillStyle = '#c8c2b8';
    for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    for (let y = 0; y < 16; y += 4) {
      const offset = (y % 8 === 0) ? 0 : 4;
      for (let x = offset; x < 16; x += 8) ctx.fillRect(x, y, 1, 4);
    }
  } else if (def.pattern === 'cobble') {
    ctx.fillStyle = shadeHex(def.color, -22);
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(Math.floor(rand() * 14), Math.floor(rand() * 14), 2, 1);
    }
  } else if (def.pattern === 'glass') {
    ctx.clearRect(1, 1, 14, 14);
    ctx.fillStyle = 'rgba(216, 246, 255, 0.25)';
    ctx.fillRect(1, 1, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
    ctx.fillRect(3, 3, 2, 1);
    ctx.fillRect(3, 4, 1, 2);
    ctx.fillRect(11, 11, 2, 1);
  } else if (def.speckColor) {
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = shadeHex(def.speckColor, (rand() - 0.5) * 20);
      ctx.fillRect(2 + Math.floor(rand() * 12), 2 + Math.floor(rand() * 12), 2, 2);
    }
  } else if (def.pattern === 'diamond' || def.pattern === 'relic' || def.pattern === 'glow') {
    ctx.fillStyle = shadeHex(def.color, 30);
    ctx.fillRect(2, 2, 12, 12);
    ctx.fillStyle = shadeHex(def.color, 55);
    ctx.fillRect(5, 5, 6, 6);
  } else if (faceType === 'side' && def.sideBooks) {
    ctx.fillStyle = '#3b2716';
    ctx.fillRect(0, 2, 16, 5);
    ctx.fillRect(0, 9, 16, 5);
    const bookColors = ['#b91c1c', '#1d4ed8', '#15803d', '#eab308', '#9333ea', '#0d9488'];
    for (let row of [3, 10]) {
      for (let x = 1; x < 15; x += 2) {
        ctx.fillStyle = bookColors[(x + row) % bookColors.length];
        ctx.fillRect(x, row, 2, 4);
      }
    }
  } else if (faceType === 'side' && def.sideTNT) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 5, 16, 6);
    ctx.fillStyle = '#111111';
    ctx.fillRect(2, 6, 3, 1); ctx.fillRect(3, 7, 1, 3);
    ctx.fillRect(6, 6, 1, 4); ctx.fillRect(7, 7, 1, 1); ctx.fillRect(8, 6, 1, 4);
    ctx.fillRect(11, 6, 3, 1); ctx.fillRect(12, 7, 1, 3);
  }

  // Subtle pixel border for crisp voxel aesthetic
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);

  return canvas;
}

function getBlockIconDataURL(id) {
  if (ICON_CACHE[id]) return ICON_CACHE[id];
  const def = BLOCK_DEFS[id];
  if (!def) return '';
  const c = createPixelCanvas(def, 'side');
  ICON_CACHE[id] = c.toDataURL();
  return ICON_CACHE[id];
}

function getBlockMaterial(id) {
  if (MATERIAL_CACHE[id]) return MATERIAL_CACHE[id];
  const def = BLOCK_DEFS[id];
  const makeTex = (face) => {
    const c = createPixelCanvas(def, face);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  if (def.sideGrass || def.sideBark || def.sideBooks || def.sideTNT) {
    const sideTex = makeTex('side');
    const topTex = makeTex('top');
    const botTex = makeTex('bottom');
    const mats = [
      new THREE.MeshLambertMaterial({ map: sideTex }),
      new THREE.MeshLambertMaterial({ map: sideTex }),
      new THREE.MeshLambertMaterial({ map: topTex }),
      new THREE.MeshLambertMaterial({ map: botTex }),
      new THREE.MeshLambertMaterial({ map: sideTex }),
      new THREE.MeshLambertMaterial({ map: sideTex }),
    ];
    MATERIAL_CACHE[id] = mats;
    return mats;
  }

  const tex = makeTex('side');
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: Boolean(def.transparent),
    opacity: def.opacity ?? 1,
    emissive: def.emissive ? new THREE.Color(def.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: def.emissive ? 0.55 : 0,
    depthWrite: def.id !== 9
  });
  MATERIAL_CACHE[id] = mat;
  return mat;
}

// ============================================================================
// 4. PROCEDURAL WORLD & MOB GENERATOR (EXPANDED BIOMES & CREATURES)
// ============================================================================
const kKey = (x, y, z) => `${x},${y},${z}`;
const parseKey = (k) => k.split(',').map(Number);

function generateWorldData({ seed = 'BLOCKVERSE', terrainType = 'normal', gameMode = 'freeplay', radius = 44 }) {
  const noise = new FastSimplexNoise(seed);
  const blocks = new Map();
  const shrines = [];
  const initialMobs = [];
  const waterLevel = 4;

  const setB = (x, y, z, id) => {
    blocks.set(kKey(x, y, z), id);
  };

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      if (terrainType !== 'skyislands') {
        setB(x, 0, z, 18); // Bedrock floor
      }

      let h = 6;
      if (terrainType === 'flat') {
        h = 5;
      } else if (terrainType === 'mountains') {
        const n = noise.fbm(x, z, 4, 0.55, 0.025);
        const ridge = Math.abs(noise.noise2D(x * 0.018, z * 0.018));
        h = Math.floor(6 + (n + 0.5) * 13 + ridge * 8);
      } else if (terrainType === 'desert') {
        const n = noise.fbm(x, z, 3, 0.45, 0.02);
        h = Math.floor(5 + (n + 0.4) * 6);
      } else if (terrainType === 'islands') {
        const dist = Math.sqrt(x * x + z * z) / radius;
        const n = noise.fbm(x, z, 3, 0.5, 0.032);
        h = Math.floor(5 + n * 11 - dist * 5);
      } else if (terrainType === 'volcanic') {
        const n = noise.fbm(x, z, 4, 0.55, 0.028);
        const crater = Math.abs(noise.noise2D(x * 0.024, z * 0.024));
        h = Math.floor(5 + (n + 0.4) * 11 + crater * 6);
      } else if (terrainType === 'tundra') {
        const n = noise.fbm(x, z, 3, 0.5, 0.024);
        h = Math.floor(6 + (n + 0.35) * 9);
      } else if (terrainType === 'mushroom') {
        const n = noise.fbm(x, z, 3, 0.52, 0.028);
        h = Math.floor(6 + (n + 0.3) * 8);
      } else if (terrainType === 'skyislands') {
        const islandVal = noise.fbm(x, z, 3, 0.5, 0.036);
        if (islandVal < -0.02 && (Math.abs(x) > 5 || Math.abs(z) > 5)) {
          continue; // Open sky chasm
        }
        h = Math.floor(11 + islandVal * 9);
      } else {
        // Lush Continent (Default)
        const n = noise.fbm(x, z, 4, 0.5, 0.023);
        h = Math.floor(6 + n * 9);
      }
      h = Math.max(1, Math.min(26, h));

      const startY = terrainType === 'skyislands' ? Math.max(4, h - 4) : 1;

      for (let y = startY; y <= h; y++) {
        // Carve natural caves in thicker hills
        if (y > 2 && y < h - 1 && terrainType !== 'flat' && terrainType !== 'skyislands') {
          const caveNoise = noise.noise2D(x * 0.09 + y * 0.11, z * 0.09 - y * 0.07);
          if (caveNoise > 0.62) continue;
        }

        if (y === h) {
          if (terrainType === 'desert') {
            setB(x, y, z, h <= waterLevel + 1 ? 1 : 5);
          } else if (terrainType === 'volcanic') {
            setB(x, y, z, h >= 14 ? 18 : h <= waterLevel + 1 ? 20 : 27);
          } else if (terrainType === 'tundra') {
            setB(x, y, z, h <= waterLevel + 1 ? 21 : 15);
          } else if (terrainType === 'mushroom') {
            setB(x, y, z, (Math.abs(x + z) % 9 === 0) ? 26 : 1);
          } else if (h >= 16) {
            setB(x, y, z, 15);
          } else if (h <= waterLevel + 1 && terrainType !== 'flat' && terrainType !== 'skyislands') {
            setB(x, y, z, 5);
          } else {
            setB(x, y, z, 1);
          }
        } else if (y >= h - 2) {
          setB(x, y, z, terrainType === 'desert' ? 5 : terrainType === 'volcanic' ? 27 : 2);
        } else {
          const oreHash = Math.abs((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) % 100;
          if (y <= 6 && oreHash < 6) setB(x, y, z, 12); // Gold ore
          else if (y <= 5 && oreHash === 7) setB(x, y, z, 26); // Emerald ore
          else setB(x, y, z, terrainType === 'volcanic' ? 27 : 3);
        }
      }

      // Fill water, lava, or ice in basins
      if (terrainType !== 'flat' && terrainType !== 'skyislands' && h < waterLevel) {
        const liquidId = terrainType === 'volcanic' ? 20 : terrainType === 'tundra' ? 21 : 9;
        for (let y = h + 1; y <= waterLevel; y++) {
          setB(x, y, z, liquidId);
        }
      }
    }
  }

  // Generate Trees, Ice Spikes & Giant Mushrooms
  for (let x = -radius + 4; x <= radius - 4; x++) {
    for (let z = -radius + 4; z <= radius - 4; z++) {
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      const treeRoll = Math.abs((x * 31337 + z * 71933) % 1000);
      const treeChance = terrainType === 'desert' ? 3 : terrainType === 'flat' ? 4 : terrainType === 'volcanic' ? 4 : 15;
      if (treeRoll < treeChance) {
        let topY = -1;
        for (let y = 26; y >= 1; y--) {
          if (blocks.has(kKey(x, y, z))) { topY = y; break; }
        }
        const surfaceId = blocks.get(kKey(x, topY, z));
        if (topY > waterLevel && (surfaceId === 1 || surfaceId === 15 || surfaceId === 27)) {
          if (terrainType === 'tundra' && treeRoll % 3 === 0) {
            // Tall Ice Spike
            const spikeH = 5 + (treeRoll % 5);
            for (let sy = 1; sy <= spikeH; sy++) setB(x, topY + sy, z, 21);
          } else if (terrainType === 'mushroom' && treeRoll % 2 === 0) {
            // Giant Red Mushroom + Glowstone
            const stemH = 4 + (treeRoll % 2);
            for (let sy = 1; sy <= stemH; sy++) setB(x, topY + sy, z, 22);
            for (let lx = -2; lx <= 2; lx++) {
              for (let lz = -2; lz <= 2; lz++) {
                setB(x + lx, topY + stemH + 1, z + lz, 28);
              }
            }
            setB(x, topY + stemH, z, 14);
          } else if (terrainType === 'volcanic') {
            // Obsidian lava spire
            setB(x, topY + 1, z, 18);
            setB(x, topY + 2, z, 18);
            setB(x, topY + 3, z, 20);
          } else {
            // Standard Oak / Pine Tree
            const trunkH = 4 + (treeRoll % 2);
            const leafId = terrainType === 'tundra' ? 15 : 8;
            for (let ty = 1; ty <= trunkH; ty++) setB(x, topY + ty, z, 6);
            for (let lx = -2; lx <= 2; lx++) {
              for (let lz = -2; lz <= 2; lz++) {
                for (let ly = trunkH - 1; ly <= trunkH + 1; ly++) {
                  if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === trunkH + 1) continue;
                  if (lx === 0 && lz === 0 && ly <= trunkH) continue;
                  setB(x + lx, topY + ly, z + lz, leafId);
                }
              }
            }
            setB(x, topY + trunkH + 2, z, leafId);
          }
        }
      }
    }
  }

  // Generate Adventure Mode Shrines & Relic Crystals
  const shrineCoords = [
    [16, 16], [-18, 15], [15, -19], [-17, -17], [0, 24], [26, -6], [-25, 4]
  ];
  shrineCoords.forEach(([sx, sz], idx) => {
    if (Math.abs(sx) >= radius - 3 || Math.abs(sz) >= radius - 3) return;
    let sy = 6;
    for (let y = 26; y >= 1; y--) {
      const id = blocks.get(kKey(sx, y, sz));
      if (id && id !== 9 && id !== 20 && id !== 8) { sy = y; break; }
    }
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        setB(sx + dx, sy, sz + dz, 4);
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
          setB(sx + dx, sy + 1, sz + dz, 11);
          setB(sx + dx, sy + 2, sz + dz, 11);
          setB(sx + dx, sy + 3, sz + dz, 14);
        }
      }
    }
    setB(sx, sy + 1, sz, 18);
    setB(sx, sy + 2, sz, 19);
    shrines.push({ id: idx + 1, x: sx, y: sy + 2, z: sz });
  });

  // Spawn Initial Living Creatures (Sheep, Hens, Cows, Pigs) & Enemies
  const passivePool = ['sheep', 'hen', 'sheep', 'hen', 'cow', 'pig'];
  const hostilePool = ['zombie', 'skeleton', 'spider', 'slime'];
  let mobIdCounter = 1;

  const findSurfaceY = (mx, mz) => {
    for (let y = 27; y >= 1; y--) {
      const id = blocks.get(kKey(Math.round(mx), y, Math.round(mz)));
      if (id && id !== 9 && id !== 20 && id !== 8) return y + 1.2;
    }
    return null;
  };

  // Spawn 26 passive animals around the world
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2 + (i % 3) * 0.4;
    const dist = 6 + (i % 7) * 4.5;
    const mx = Math.round(Math.cos(angle) * dist);
    const mz = Math.round(Math.sin(angle) * dist);
    const my = findSurfaceY(mx, mz);
    if (my !== null) {
      const mType = passivePool[i % passivePool.length];
      const def = MOB_TYPES[mType];
      initialMobs.push({
        id: `mob-${mobIdCounter++}`,
        type: mType,
        x: mx,
        y: my,
        z: mz,
        vy: 0,
        yaw: Math.random() * Math.PI * 2,
        hp: def.maxHp,
        maxHp: def.maxHp,
        hurtTimer: 0,
        aiTimer: Math.random() * 2,
        moveState: 'walk',
        attackCooldown: 0
      });
    }
  }

  // Spawn 12 hostile enemies further out in the world
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const dist = 16 + (i % 4) * 5;
    const mx = Math.round(Math.cos(angle) * dist);
    const mz = Math.round(Math.sin(angle) * dist);
    const my = findSurfaceY(mx, mz);
    if (my !== null) {
      const mType = hostilePool[i % hostilePool.length];
      const def = MOB_TYPES[mType];
      initialMobs.push({
        id: `mob-${mobIdCounter++}`,
        type: mType,
        x: mx,
        y: my,
        z: mz,
        vy: 0,
        yaw: Math.random() * Math.PI * 2,
        hp: def.maxHp,
        maxHp: def.maxHp,
        hurtTimer: 0,
        aiTimer: Math.random() * 2,
        moveState: 'walk',
        attackCooldown: 0
      });
    }
  }

  return { blocks, shrines, initialMobs };
}

// ============================================================================
// 5. 3D SCENE COMPONENTS (VOXELS, LIVING MOBS, PARTICLES, CLOUDS, PLAYER)
// ============================================================================
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012));

// Articulated 3D Voxel Mob Renderer + Real-Time AI & Physics Loop
function VoxelMobEntity({ mob }) {
  const groupRef = useRef();
  const leg1Ref = useRef();
  const leg2Ref = useRef();
  const leg3Ref = useRef();
  const leg4Ref = useRef();
  const headRef = useRef();

  const def = MOB_TYPES[mob.type] || MOB_TYPES.sheep;
  const isHurt = mob.hurtTimer > 0;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(mob.x, mob.y, mob.z);
    groupRef.current.rotation.y = mob.yaw;

    const t = clock.getElapsedTime() * (def.speed * 3.2);
    const isMoving = mob.moveState === 'walk' || mob.moveState === 'chase';
    const swing = isMoving ? Math.sin(t + (mob.x + mob.z)) * 0.55 : 0;

    if (leg1Ref.current) leg1Ref.current.rotation.x = swing;
    if (leg2Ref.current) leg2Ref.current.rotation.x = -swing;
    if (leg3Ref.current) leg3Ref.current.rotation.x = -swing;
    if (leg4Ref.current) leg4Ref.current.rotation.x = swing;
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 1.7 + mob.x) * 0.22;
    }
  });

  const bodyColor = isHurt ? '#ef4444' : def.color;

  // Render Humanoid Enemy (Zombie / Skeleton)
  if (mob.type === 'zombie' || mob.type === 'skeleton') {
    return (
      <group ref={groupRef} position={[mob.x, mob.y, mob.z]}>
        {/* Legs */}
        <mesh ref={leg1Ref} position={[-0.14, -0.25, 0]} castShadow>
          <boxGeometry args={[0.22, 0.6, 0.22]} />
          <meshLambertMaterial color={isHurt ? '#ef4444' : def.pantsColor} />
        </mesh>
        <mesh ref={leg2Ref} position={[0.14, -0.25, 0]} castShadow>
          <boxGeometry args={[0.22, 0.6, 0.22]} />
          <meshLambertMaterial color={isHurt ? '#ef4444' : def.pantsColor} />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.52, 0.65, 0.28]} />
          <meshLambertMaterial color={isHurt ? '#ef4444' : def.shirtColor} />
        </mesh>
        {/* Outstretched Zombie / Skeleton Arms */}
        <mesh position={[-0.36, 0.5, 0.25]} rotation={[Math.PI / 2.2, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.62, 0.2]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        <mesh position={[0.36, 0.5, 0.25]} rotation={[Math.PI / 2.2, 0, 0]} castShadow>
          <boxGeometry args={[0.2, 0.62, 0.2]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        {/* Head + Eyes */}
        <group ref={headRef} position={[0, 0.9, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.48, 0.48, 0.48]} />
            <meshLambertMaterial color={bodyColor} />
          </mesh>
          <mesh position={[-0.11, 0.04, 0.25]}>
            <boxGeometry args={[0.09, 0.08, 0.04]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
          <mesh position={[0.11, 0.04, 0.25]}>
            <boxGeometry args={[0.09, 0.08, 0.04]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
        </group>
        {/* Health Bar when damaged */}
        {mob.hp < mob.maxHp && (
          <mesh position={[0, 1.38, 0]}>
            <boxGeometry args={[0.7 * (mob.hp / mob.maxHp), 0.08, 0.08]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        )}
      </group>
    );
  }

  // Render Spider
  if (mob.type === 'spider') {
    return (
      <group ref={groupRef} position={[mob.x, mob.y, mob.z]}>
        <mesh position={[0, -0.15, -0.15]} castShadow>
          <boxGeometry args={[0.75, 0.42, 0.85]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        <group ref={headRef} position={[0, -0.1, 0.42]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.38, 0.45]} />
            <meshLambertMaterial color={bodyColor} />
          </mesh>
          <mesh position={[-0.12, 0.05, 0.23]}>
            <boxGeometry args={[0.1, 0.1, 0.05]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0.12, 0.05, 0.23]}>
            <boxGeometry args={[0.1, 0.1, 0.05]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
        <mesh ref={leg1Ref} position={[-0.5, -0.25, 0.15]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.5, 0.12, 0.12]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        <mesh ref={leg2Ref} position={[0.5, -0.25, 0.15]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.5, 0.12, 0.12]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        <mesh ref={leg3Ref} position={[-0.5, -0.25, -0.25]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.5, 0.12, 0.12]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        <mesh ref={leg4Ref} position={[0.5, -0.25, -0.25]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.5, 0.12, 0.12]} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
      </group>
    );
  }

  // Render Bouncing Magma Slime
  if (mob.type === 'slime') {
    return (
      <group ref={groupRef} position={[mob.x, mob.y, mob.z]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.85, 0.85, 0.85]} />
          <meshLambertMaterial color={bodyColor} transparent opacity={0.78} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.45, 0.45, 0.45]} />
          <meshBasicMaterial color={def.coreColor} />
        </mesh>
      </group>
    );
  }

  // Render Hen (Chicken) with beak, red wattle, wings, and 2 legs
  if (mob.type === 'hen') {
    return (
      <group ref={groupRef} position={[mob.x, mob.y, mob.z]}>
        <mesh ref={leg1Ref} position={[-0.1, -0.35, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.08]} />
          <meshLambertMaterial color="#f59e0b" />
        </mesh>
        <mesh ref={leg2Ref} position={[0.1, -0.35, 0]}>
          <boxGeometry args={[0.08, 0.32, 0.08]} />
          <meshLambertMaterial color="#f59e0b" />
        </mesh>
        <mesh position={[0, -0.05, 0]} castShadow>
          <boxGeometry args={def.scale} />
          <meshLambertMaterial color={bodyColor} />
        </mesh>
        <group ref={headRef} position={[0, 0.28, 0.25]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.36, 0.3]} />
            <meshLambertMaterial color={bodyColor} />
          </mesh>
          {/* Yellow Beak */}
          <mesh position={[0, 0.02, 0.2]}>
            <boxGeometry args={[0.18, 0.1, 0.14]} />
            <meshLambertMaterial color="#f59e0b" />
          </mesh>
          {/* Red Wattle & Comb */}
          <mesh position={[0, -0.08, 0.18]}>
            <boxGeometry args={[0.1, 0.12, 0.1]} />
            <meshLambertMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.08, 0.12, 0.2]} />
            <meshLambertMaterial color="#ef4444" />
          </mesh>
        </group>
      </group>
    );
  }

  // Render 4-Legged Farm Animals (Sheep, Cow, Pig)
  const [bw, bh, bd] = def.scale;
  return (
    <group ref={groupRef} position={[mob.x, mob.y, mob.z]}>
      {/* 4 Articulated Legs */}
      <mesh ref={leg1Ref} position={[-bw * 0.32, -0.32, bd * 0.32]} castShadow>
        <boxGeometry args={[0.2, 0.45, 0.2]} />
        <meshLambertMaterial color={isHurt ? '#ef4444' : def.faceColor} />
      </mesh>
      <mesh ref={leg2Ref} position={[bw * 0.32, -0.32, bd * 0.32]} castShadow>
        <boxGeometry args={[0.2, 0.45, 0.2]} />
        <meshLambertMaterial color={isHurt ? '#ef4444' : def.faceColor} />
      </mesh>
      <mesh ref={leg3Ref} position={[-bw * 0.32, -0.32, -bd * 0.32]} castShadow>
        <boxGeometry args={[0.2, 0.45, 0.2]} />
        <meshLambertMaterial color={isHurt ? '#ef4444' : def.faceColor} />
      </mesh>
      <mesh ref={leg4Ref} position={[bw * 0.32, -0.32, -bd * 0.32]} castShadow>
        <boxGeometry args={[0.2, 0.45, 0.2]} />
        <meshLambertMaterial color={isHurt ? '#ef4444' : def.faceColor} />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[bw, bh, bd]} />
        <meshLambertMaterial color={bodyColor} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0, 0.42, bd * 0.52]}>
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.44, 0.46]} />
          <meshLambertMaterial color={isHurt ? '#ef4444' : def.faceColor} />
        </mesh>
        {mob.type === 'sheep' && (
          <mesh position={[0, 0.06, -0.03]}>
            <boxGeometry args={[0.52, 0.42, 0.42]} />
            <meshLambertMaterial color={bodyColor} />
          </mesh>
        )}
        {/* Eyes */}
        <mesh position={[-0.14, 0.05, 0.24]}>
          <boxGeometry args={[0.08, 0.08, 0.04]} />
          <meshBasicMaterial color="#111111" />
        </mesh>
        <mesh position={[0.14, 0.05, 0.24]}>
          <boxGeometry args={[0.08, 0.08, 0.04]} />
          <meshBasicMaterial color="#111111" />
        </mesh>
      </group>

      {mob.hp < mob.maxHp && (
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.75 * (mob.hp / mob.maxHp), 0.08, 0.08]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      )}
    </group>
  );
}

function LivingMobsManager({
  mobsRef,
  worldBlocks,
  playerPosRef,
  gameMode,
  isDaytime,
  onDamagePlayer,
  onDropEgg,
  uiModalOpen,
  mobVersion
}) {
  useFrame((_, delta) => {
    if (uiModalOpen) return;
    const dt = Math.min(delta, 0.08);
    const pPos = playerPosRef.current;

    for (let i = 0; i < mobsRef.current.length; i++) {
      const m = mobsRef.current[i];
      const def = MOB_TYPES[m.type] || MOB_TYPES.sheep;

      if (m.hurtTimer > 0) m.hurtTimer = Math.max(0, m.hurtTimer - dt);
      if (m.attackCooldown > 0) m.attackCooldown = Math.max(0, m.attackCooldown - dt);

      // AI state decision
      m.aiTimer -= dt;
      const dxToPlayer = pPos.x - m.x;
      const dzToPlayer = pPos.z - m.z;
      const distToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer);

      if (def.hostile && distToPlayer < 16 && gameMode !== 'creative') {
        m.moveState = 'chase';
        m.yaw = Math.atan2(dxToPlayer, dzToPlayer);
        // Attack player if within melee reach
        if (distToPlayer < 1.45 && m.attackCooldown <= 0) {
          m.attackCooldown = 1.35;
          onDamagePlayer(def.damage || 3, def.name);
          soundFX.play('zombie');
        }
      } else if (m.aiTimer <= 0) {
        m.aiTimer = 1.5 + Math.random() * 3.0;
        m.moveState = Math.random() < 0.68 ? 'walk' : 'idle';
        if (m.moveState === 'walk') {
          m.yaw += (Math.random() - 0.5) * 2.4;
        }
        // Occasional ambient animal sounds or hen laying an egg
        if (!def.hostile && distToPlayer < 15 && Math.random() < 0.08) {
          soundFX.play(m.type === 'hen' ? 'cluck' : 'sheep');
          if (m.type === 'hen' && Math.random() < 0.25) {
            onDropEgg();
          }
        }
      }

      // Horizontal movement & obstacle auto-jump
      if (m.moveState === 'walk' || m.moveState === 'chase') {
        const spd = m.moveState === 'chase' ? def.speed * 1.15 : def.speed;
        const vx = Math.sin(m.yaw) * spd;
        const vz = Math.cos(m.yaw) * spd;
        const nextX = m.x + vx * dt;
        const nextZ = m.z + vz * dt;

        const blockAhead = worldBlocks.current.get(
          kKey(Math.round(nextX), Math.round(m.y - 0.1), Math.round(nextZ))
        );
        const blockAboveAhead = worldBlocks.current.get(
          kKey(Math.round(nextX), Math.round(m.y + 0.9), Math.round(nextZ))
        );

        if (blockAhead && BLOCK_DEFS[blockAhead]?.solid) {
          // Jump up 1-block step if clear above
          if (!blockAboveAhead && m.vy === 0) {
            m.vy = 6.8;
          } else {
            m.yaw += Math.PI * 0.65;
          }
        } else {
          m.x = nextX;
          m.z = nextZ;
        }
      }

      // Gravity & Grounding
      m.vy -= 19.0 * dt;
      const nextY = m.y + m.vy * dt;
      const blockBelow = worldBlocks.current.get(
        kKey(Math.round(m.x), Math.round(nextY - 0.65), Math.round(m.z))
      );
      if (blockBelow && BLOCK_DEFS[blockBelow]?.solid) {
        m.y = Math.round(nextY - 0.65) + 1.15;
        m.vy = m.type === 'slime' ? 5.2 : 0;
      } else {
        m.y = nextY;
      }

      // Respawn if fallen off world
      if (m.y < -15) {
        m.y = 20;
        m.vy = 0;
      }
    }
  });

  return (
    <group key={mobVersion}>
      {mobsRef.current.map(m => (
        <VoxelMobEntity key={m.id} mob={m} />
      ))}
    </group>
  );
}

function InstancedVoxelWorld({ worldBlocks, worldVersion }) {
  const meshRefs = useRef({});
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Group coordinates by block ID
  const grouped = useMemo(() => {
    const groups = {};
    RENDERABLE_BLOCK_IDS.forEach(id => { groups[id] = []; });
    worldBlocks.current.forEach((id, key) => {
      // Simple culling: if all 6 neighbors are opaque solid blocks, skip rendering
      if (id !== 9 && id !== 10) {
        const [x, y, z] = parseKey(key);
        const n1 = worldBlocks.current.get(kKey(x + 1, y, z));
        const n2 = worldBlocks.current.get(kKey(x - 1, y, z));
        const n3 = worldBlocks.current.get(kKey(x, y + 1, z));
        const n4 = worldBlocks.current.get(kKey(x, y - 1, z));
        const n5 = worldBlocks.current.get(kKey(x, y, z + 1));
        const n6 = worldBlocks.current.get(kKey(x, y, z - 1));
        if (
          n1 && n1 !== 9 && n1 !== 10 &&
          n2 && n2 !== 9 && n2 !== 10 &&
          n3 && n3 !== 9 && n3 !== 10 &&
          n4 && n4 !== 9 && n4 !== 10 &&
          n5 && n5 !== 9 && n5 !== 10 &&
          n6 && n6 !== 9 && n6 !== 10
        ) {
          return;
        }
        if (groups[id]) groups[id].push([x, y, z]);
      } else {
        const [x, y, z] = parseKey(key);
        // For water, only render top surface or exposed sides
        if (id === 9 && worldBlocks.current.get(kKey(x, y + 1, z)) === 9) return;
        if (groups[id]) groups[id].push([x, y, z]);
      }
    });
    return groups;
  }, [worldVersion]);

  useEffect(() => {
    RENDERABLE_BLOCK_IDS.forEach(id => {
      const mesh = meshRefs.current[id];
      const list = grouped[id] || [];
      if (!mesh) return;
      mesh.count = list.length;
      for (let i = 0; i < list.length; i++) {
        const [x, y, z] = list[i];
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [grouped, dummy]);

  // Subtle water animation
  useFrame(({ clock }) => {
    const waterMesh = meshRefs.current[9];
    if (waterMesh) {
      waterMesh.position.y = Math.sin(clock.getElapsedTime() * 2.2) * 0.04 - 0.05;
    }
  });

  return (
    <group>
      {RENDERABLE_BLOCK_IDS.map(id => {
        const count = (grouped[id]?.length || 0);
        const maxAlloc = Math.max(count + 250, 500);
        const mat = getBlockMaterial(id);
        return (
          <instancedMesh
            key={`${id}-${maxAlloc}`}
            ref={el => { meshRefs.current[id] = el; }}
            args={[boxGeometry, mat, maxAlloc]}
            castShadow={id !== 9}
            receiveShadow
          />
        );
      })}
    </group>
  );
}

function BreakParticles({ bursts }) {
  const groupRef = useRef();
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach(child => {
      if (child.userData.vel) {
        child.position.addScaledVector(child.userData.vel, dt);
        child.userData.vel.y -= 18 * dt;
        child.rotation.x += 5 * dt;
        child.rotation.y += 5 * dt;
        child.scale.multiplyScalar(0.95);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {bursts.map(b =>
        b.particles.map((p, idx) => (
          <mesh
            key={`${b.id}-${idx}`}
            position={[p.x, p.y, p.z]}
            userData={{ vel: new THREE.Vector3(p.vx, p.vy, p.vz) }}
          >
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshLambertMaterial color={b.color} />
          </mesh>
        ))
      )}
    </group>
  );
}

function VoxelClouds() {
  const cloudsRef = useRef();
  const cloudData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 18; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 110,
        y: 28 + (i % 3) * 2,
        z: (Math.random() - 0.5) * 110,
        w: 6 + (i % 5) * 2,
        d: 5 + (i % 4) * 2
      });
    }
    return arr;
  }, []);

  useFrame((_, dt) => {
    if (!cloudsRef.current) return;
    cloudsRef.current.children.forEach(c => {
      c.position.x += dt * 0.9;
      if (c.position.x > 60) c.position.x = -60;
    });
  });

  return (
    <group ref={cloudsRef}>
      {cloudData.map((c, idx) => (
        <mesh key={idx} position={[c.x, c.y, c.z]}>
          <boxGeometry args={[c.w, 1.2, c.d]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function FirstPersonPlayer({
  worldBlocks,
  mobsRef,
  playerPosRef,
  gameMode,
  isFlying,
  setIsFlying,
  uiModalOpen,
  selectedBlockId,
  onPlaceBlock,
  onBreakBlock,
  onAttackMob,
  onEatFood,
  onSwingHand,
  onHudUpdate,
  onDamagePlayer,
  spawnTrigger,
  settings
}) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 18, 0));
  const vel = useRef(new THREE.Vector3(0, 0, 0));
  const keys = useRef({});
  const mouseButtons = useRef({ left: false, right: false });
  const isGrounded = useRef(false);
  const highestAirY = useRef(18);
  const stepTimer = useRef(0);
  const miningState = useRef({ targetKey: null, progress: 0 });
  const placeCooldown = useRef(0);
  const attackCooldown = useRef(0);

  const [targetVoxel, setTargetVoxel] = useState(null);

  // Find safe spawn on world load or respawn
  useEffect(() => {
    let topY = 16;
    for (let y = 30; y >= 1; y--) {
      const id = worldBlocks.current.get(kKey(0, y, 0));
      if (id && id !== 9) {
        topY = y + 2.6;
        break;
      }
    }
    pos.current.set(0, topY, 0);
    vel.current.set(0, 0, 0);
    highestAirY.current = topY;
    camera.position.copy(pos.current);
  }, [spawnTrigger, camera, worldBlocks]);

  // Keyboard & mouse listeners
  useEffect(() => {
    const onKeyDown = (e) => {
      keys.current[e.code] = true;
      if (e.code === 'KeyF' && !uiModalOpen && (gameMode === 'freeplay' || gameMode === 'creative')) {
        setIsFlying(f => !f);
        vel.current.y = 0;
      }
    };
    const onKeyUp = (e) => {
      keys.current[e.code] = false;
    };
    const onMouseDown = (e) => {
      if (uiModalOpen || !document.pointerLockElement) return;
      if (e.button === 0) mouseButtons.current.left = true;
      if (e.button === 2) mouseButtons.current.right = true;
    };
    const onMouseUp = (e) => {
      if (e.button === 0) {
        mouseButtons.current.left = false;
        miningState.current = { targetKey: null, progress: 0 };
        onHudUpdate({ breakProgress: 0 });
      }
      if (e.button === 2) mouseButtons.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [uiModalOpen, gameMode, setIsFlying, onHudUpdate]);

  // Voxel AABB collision check
  const checkCollision = useCallback((px, py, pz) => {
    const r = 0.32;
    const minX = Math.floor(px - r + 0.5);
    const maxX = Math.floor(px + r + 0.5);
    const minY = Math.floor(py - 1.5 + 0.5);
    const maxY = Math.floor(py + 0.18 + 0.5);
    const minZ = Math.floor(pz - r + 0.5);
    const maxZ = Math.floor(pz + r + 0.5);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = worldBlocks.current.get(kKey(x, y, z));
          if (id && BLOCK_DEFS[id]?.solid) return true;
        }
      }
    }
    return false;
  }, [worldBlocks]);

  // Accurate voxel raycast along camera view
  const raycastVoxel = useCallback(() => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    let prevX = Math.round(origin.x);
    let prevY = Math.round(origin.y);
    let prevZ = Math.round(origin.z);

    for (let d = 0.2; d <= 6.2; d += 0.06) {
      const vx = Math.round(origin.x + dir.x * d);
      const vy = Math.round(origin.y + dir.y * d);
      const vz = Math.round(origin.z + dir.z * d);
      const id = worldBlocks.current.get(kKey(vx, vy, vz));
      if (id && id !== 9) {
        return {
          hit: [vx, vy, vz],
          place: [prevX, prevY, prevZ],
          id
        };
      }
      prevX = vx;
      prevY = vy;
      prevZ = vz;
    }
    return null;
  }, [camera, worldBlocks]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.08);
    if (uiModalOpen) return;

    // Update camera FOV
    if (camera.fov !== settings.fov) {
      camera.fov = settings.fov;
      camera.updateProjectionMatrix();
    }

    // Check if in water
    const footBlock = worldBlocks.current.get(
      kKey(Math.round(pos.current.x), Math.round(pos.current.y - 1.0), Math.round(pos.current.z))
    );
    const inWater = footBlock === 9;

    // Movement vectors
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3();
    if (keys.current['KeyW'] || keys.current['ArrowUp']) moveDir.add(forward);
    if (keys.current['KeyS'] || keys.current['ArrowDown']) moveDir.sub(forward);
    if (keys.current['KeyD'] || keys.current['ArrowRight']) moveDir.add(right);
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) moveDir.sub(right);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const sprinting = keys.current['ShiftLeft'] || keys.current['ShiftRight'];
    const baseSpeed = isFlying ? (sprinting ? 14 : 9) : inWater ? 3.6 : (sprinting ? 7.2 : 4.8);

    vel.current.x = moveDir.x * baseSpeed;
    vel.current.z = moveDir.z * baseSpeed;

    if (isFlying) {
      vel.current.y = 0;
      if (keys.current['Space']) vel.current.y = 7.5;
      if (sprinting) vel.current.y = -7.5;
      highestAirY.current = pos.current.y;
    } else if (inWater) {
      vel.current.y -= 6.5 * dt;
      vel.current.y = Math.max(vel.current.y, -2.5);
      if (keys.current['Space']) vel.current.y = 4.2;
      highestAirY.current = pos.current.y;
    } else {
      vel.current.y -= 23.0 * dt;
      if (keys.current['Space'] && isGrounded.current) {
        vel.current.y = 8.4;
        isGrounded.current = false;
      }
    }

    // Apply X movement
    const nextX = pos.current.x + vel.current.x * dt;
    if (!checkCollision(nextX, pos.current.y, pos.current.z)) {
      pos.current.x = nextX;
    }
    // Apply Z movement
    const nextZ = pos.current.z + vel.current.z * dt;
    if (!checkCollision(pos.current.x, pos.current.y, nextZ)) {
      pos.current.z = nextZ;
    }
    // Apply Y movement
    const nextY = pos.current.y + vel.current.y * dt;
    if (!checkCollision(pos.current.x, nextY, pos.current.z)) {
      pos.current.y = nextY;
      isGrounded.current = false;
      if (pos.current.y > highestAirY.current) highestAirY.current = pos.current.y;
    } else {
      if (vel.current.y < 0) {
        // Landed on ground: check fall damage in Survival/Adventure
        const fallDist = highestAirY.current - pos.current.y;
        if (!isFlying && !inWater && (gameMode === 'survival' || gameMode === 'adventure') && fallDist > 4.6) {
          const dmg = Math.floor((fallDist - 3.5) * 1.5);
          if (dmg > 0) onDamagePlayer(dmg);
        }
        isGrounded.current = true;
      }
      vel.current.y = 0;
      highestAirY.current = pos.current.y;
    }

    // Void rescue
    if (pos.current.y < -15) {
      pos.current.set(0, 22, 0);
      vel.current.set(0, 0, 0);
    }

    camera.position.copy(pos.current);
    playerPosRef.current.copy(pos.current);

    // Footstep sound
    if (isGrounded.current && moveDir.lengthSq() > 0.1) {
      stepTimer.current += dt * (sprinting ? 1.5 : 1);
      if (stepTimer.current > 0.42) {
        stepTimer.current = 0;
        soundFX.play('step');
      }
    }

    if (attackCooldown.current > 0) attackCooldown.current -= dt;

    // Raycast for Living Mob / Enemy within 4.5 blocks
    const findTargetMob = () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = camera.position;
      let closestMob = null;
      let bestDist = 4.6;

      for (const m of mobsRef.current) {
        const mobCenter = new THREE.Vector3(m.x, m.y + 0.15, m.z);
        const toMob = mobCenter.clone().sub(origin);
        const dist = toMob.length();
        if (dist > bestDist) continue;
        const proj = toMob.dot(dir);
        if (proj < 0) continue;
        const perpDistSq = toMob.lengthSq() - proj * proj;
        if (perpDistSq < 0.65) {
          bestDist = dist;
          closestMob = m;
        }
      }
      return closestMob;
    };

    const aimedMob = findTargetMob();
    const hitInfo = raycastVoxel();
    setTargetVoxel(!aimedMob && hitInfo ? hitInfo.hit : null);

    // Handle Left Click (Attack Creature/Enemy OR Mine Block)
    if (mouseButtons.current.left) {
      if (aimedMob && attackCooldown.current <= 0) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        onAttackMob(aimedMob.id, dir);
        onSwingHand();
        attackCooldown.current = 0.28;
        mouseButtons.current.left = false;
      } else if (hitInfo) {
        const [hx, hy, hz] = hitInfo.hit;
        const tKey = kKey(hx, hy, hz);
        const blockDef = BLOCK_DEFS[hitInfo.id];
        onSwingHand();

        if (gameMode === 'creative' || gameMode === 'freeplay') {
          onBreakBlock(hx, hy, hz, hitInfo.id);
          mouseButtons.current.left = false;
        } else {
          // Survival & Adventure progressive mining
          if (miningState.current.targetKey !== tKey) {
            miningState.current = { targetKey: tKey, progress: 0 };
          }
          const heldDef = BLOCK_DEFS[selectedBlockId];
          const toolMult = heldDef?.isTool ? heldDef.speedMultiplier : 1.0;
          const speed = toolMult / (blockDef?.hardness || 1.0);
          miningState.current.progress += dt * speed * 1.45;
          onHudUpdate({ breakProgress: Math.min(1, miningState.current.progress) });

          if (Math.random() < 0.2) soundFX.play('hit');

          if (miningState.current.progress >= 1) {
            onBreakBlock(hx, hy, hz, hitInfo.id);
            miningState.current = { targetKey: null, progress: 0 };
            onHudUpdate({ breakProgress: 0 });
          }
        }
      }
    } else if (!mouseButtons.current.left && miningState.current.progress > 0) {
      miningState.current = { targetKey: null, progress: 0 };
      onHudUpdate({ breakProgress: 0 });
    }

    // Handle Right Click (Eat Held Meat/Food OR Place Block)
    if (placeCooldown.current > 0) placeCooldown.current -= dt;
    if (mouseButtons.current.right && placeCooldown.current <= 0) {
      const heldDef = BLOCK_DEFS[selectedBlockId];
      if (heldDef?.isFood) {
        onEatFood(selectedBlockId);
        onSwingHand();
        placeCooldown.current = 0.45;
        mouseButtons.current.right = false;
      } else if (hitInfo) {
        const [px, py, pz] = hitInfo.place;
        const dx = Math.abs(px - pos.current.x);
        const dz = Math.abs(pz - pos.current.z);
        const dyTop = pos.current.y + 0.2 - (py - 0.5);
        const dyBot = (py + 0.5) - (pos.current.y - 1.5);
        const overlapsPlayer = dx < 0.78 && dz < 0.78 && dyTop > 0 && dyBot > 0;

        if (!overlapsPlayer) {
          onPlaceBlock(px, py, pz);
          onSwingHand();
          placeCooldown.current = 0.22;
        }
      }
    }

    // Periodic HUD coordinate & target update
    if (Math.floor(state.clock.elapsedTime * 10) % 2 === 0) {
      const mobLabel = aimedMob
        ? `${MOB_TYPES[aimedMob.type]?.name} (${aimedMob.hp}/${aimedMob.maxHp} HP)`
        : null;
      onHudUpdate({
        coords: [Math.round(pos.current.x), Math.round(pos.current.y - 1), Math.round(pos.current.z)],
        targetName: mobLabel || (hitInfo ? BLOCK_DEFS[hitInfo.id]?.name : null)
      });
    }
  });

  return (
    <>
      {targetVoxel && (
        <lineSegments position={targetVoxel} geometry={edgesGeometry}>
          <lineBasicMaterial color="#111111" linewidth={2} />
        </lineSegments>
      )}
    </>
  );
}

// ============================================================================
// 6. MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // Screen & Modal States
  const [screen, setScreen] = useState('menu'); // 'menu' | 'create' | 'load' | 'settings' | 'playing'
  const [uiModal, setUiModal] = useState(null); // null | 'inventory' | 'pause' | 'help'
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // World & Mode Settings
  const [worldName, setWorldName] = useState('New Blockverse');
  const [worldSeed, setWorldSeed] = useState('BLOCKVERSE-2026');
  const [terrainType, setTerrainType] = useState('normal');
  const [gameMode, setGameMode] = useState('freeplay'); // 'freeplay' | 'creative' | 'survival' | 'adventure'
  const [isFlying, setIsFlying] = useState(false);

  // Game Settings
  const [settings, setSettings] = useState({
    fov: 75,
    daySpeed: 1,
    sound: true,
    worldRadius: 44
  });

  // World Voxel Map, Living Mobs & Version counters
  const worldBlocks = useRef(new Map());
  const mobsRef = useRef([]);
  const playerPosRef = useRef(new THREE.Vector3(0, 18, 0));
  const [worldVersion, setWorldVersion] = useState(0);
  const [mobVersion, setMobVersion] = useState(0);
  const [spawnTrigger, setSpawnTrigger] = useState(0);
  const [handSwing, setHandSwing] = useState(false);

  // Undo / Redo Stacks
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  // Player Status (Survival & Adventure)
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [relicsFound, setRelicsFound] = useState(0);
  const [totalRelics, setTotalRelics] = useState(5);
  const [toastMsg, setToastMsg] = useState(null);

  // Hotbar & Inventory State
  const [hotbar, setHotbar] = useState([106, 1, 4, 6, 7, 202, 24, 25, 13]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [inventoryCounts, setInventoryCounts] = useState({});

  // HUD live telemetry
  const [hudState, setHudState] = useState({
    coords: [0, 10, 0],
    targetName: null,
    breakProgress: 0
  });
  const [timeOfDay, setTimeOfDay] = useState(0.28); // 0..1 (0.25 = Noon, 0.75 = Midnight)
  const [bursts, setBursts] = useState([]);

  // Saved Worlds in LocalStorage
  const [savedWorlds, setSavedWorlds] = useState(() => {
    try {
      const raw = localStorage.getItem('blockverse_saves_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(prev => (prev === msg ? null : prev)), 3200);
  }, []);

  useEffect(() => {
    soundFX.enabled = settings.sound;
  }, [settings.sound]);

  // Day/Night cycle progression & Survival hunger
  useEffect(() => {
    if (screen !== 'playing' || uiModal) return;
    const interval = setInterval(() => {
      if (settings.daySpeed > 0) {
        setTimeOfDay(t => (t + 0.0015 * settings.daySpeed) % 1);
      }
      if (gameMode === 'survival') {
        setHunger(h => Math.max(2, h - 0.02));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [screen, uiModal, settings.daySpeed, gameMode]);

  // Start a new world with selected configuration
  const startNewGame = useCallback((modeOverride, terrainOverride, nameOverride) => {
    const activeMode = modeOverride || gameMode;
    const activeTerrain = terrainOverride || terrainType;
    const activeName = nameOverride || worldName || 'Blockverse World';

    setGameMode(activeMode);
    setTerrainType(activeTerrain);
    setWorldName(activeName);

    const { blocks, shrines, initialMobs } = generateWorldData({
      seed: worldSeed,
      terrainType: activeTerrain,
      gameMode: activeMode,
      radius: settings.worldRadius
    });

    worldBlocks.current = blocks;
    mobsRef.current = initialMobs;
    undoStack.current = [];
    redoStack.current = [];
    setHistoryCounts({ undo: 0, redo: 0 });
    setHealth(20);
    setHunger(20);
    setRelicsFound(0);
    setTotalRelics(shrines.length || 5);
    setIsFlying(activeMode === 'creative');

    // Initialize inventory quantities based on mode
    if (activeMode === 'survival') {
      setInventoryCounts({ 104: 1, 101: 1, 202: 3, 25: 6 });
      setHotbar([104, 101, 202, 1, 4, 6, 7, 24, 25]);
    } else if (activeMode === 'adventure') {
      setInventoryCounts({ 105: 1, 102: 1, 206: 5, 7: 24, 14: 12, 4: 24 });
      setHotbar([105, 102, 206, 7, 14, 4, 25, 19, 210]);
    } else {
      setHotbar([106, 1, 4, 6, 7, 206, 24, 25, 13]);
    }

    setWorldVersion(v => v + 1);
    setMobVersion(v => v + 1);
    setSpawnTrigger(s => s + 1);
    setUiModal(null);
    setScreen('playing');
    showToast(`Entered ${activeMode.toUpperCase()} Mode — Sheep, Hens & Mobs Spawned!`);
  }, [gameMode, terrainType, worldName, worldSeed, settings.worldRadius, showToast]);

  const triggerHandSwing = useCallback(() => {
    setHandSwing(true);
    setTimeout(() => setHandSwing(false), 160);
  }, []);

  // Particle burst helper
  const spawnParticles = useCallback((x, y, z, blockId, customColor) => {
    const color = customColor || BLOCK_DEFS[blockId]?.color || '#ffffff';
    const particles = [];
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 0.5,
        y: y + (Math.random() - 0.5) * 0.5,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 4.5,
        vy: 1.5 + Math.random() * 3.5,
        vz: (Math.random() - 0.5) * 4.5
      });
    }
    const burstId = Date.now() + Math.random();
    setBursts(prev => [...prev.slice(-6), { id: burstId, color, particles }]);
  }, []);

  // Attack Creature or Enemy Handler
  const handleAttackMob = useCallback((mobId, lookDir) => {
    const idx = mobsRef.current.findIndex(m => m.id === mobId);
    if (idx === -1) return;
    const mob = mobsRef.current[idx];
    const def = MOB_TYPES[mob.type] || MOB_TYPES.sheep;

    const heldDef = BLOCK_DEFS[hotbar[selectedSlot]];
    const attackDamage = heldDef?.damage || 2;

    mob.hp -= attackDamage;
    mob.hurtTimer = 0.35;
    // Apply knockback
    mob.x += lookDir.x * 0.85;
    mob.z += lookDir.z * 0.85;
    mob.vy = 4.5;

    soundFX.play('sword');
    spawnParticles(mob.x, mob.y + 0.2, mob.z, 1, '#ef4444');

    if (mob.hp <= 0) {
      // Drop meat, wool, feathers, or loot!
      mobsRef.current.splice(idx, 1);
      setMobVersion(v => v + 1);
      const dropNames = [];
      (def.drops || []).forEach(d => {
        setInventoryCounts(prev => ({
          ...prev,
          [d.id]: (prev[d.id] || 0) + d.count
        }));
        dropNames.push(`${d.count}x ${BLOCK_DEFS[d.id]?.name}`);
        setHotbar(prev => {
          if (prev.includes(d.id)) return prev;
          const emptySlot = prev.findIndex(sId => (inventoryCounts[sId] || 0) === 0 && !BLOCK_DEFS[sId]?.isTool);
          if (emptySlot !== -1) {
            const copy = [...prev];
            copy[emptySlot] = d.id;
            return copy;
          }
          return prev;
        });
      });
      showToast(`Hunted ${def.name}! Collected: ${dropNames.join(', ')}`);
    } else {
      showToast(`Hit ${def.name} for ${attackDamage} DMG! (${mob.hp}/${mob.maxHp} HP)`);
    }
  }, [hotbar, selectedSlot, inventoryCounts, spawnParticles, showToast]);

  // Spawn Mob on Demand (Creative / Free Play / Inventory button)
  const spawnMobNearPlayer = useCallback((mobType) => {
    const p = playerPosRef.current;
    const def = MOB_TYPES[mobType] || MOB_TYPES.sheep;
    const angle = Math.random() * Math.PI * 2;
    const mx = Math.round(p.x + Math.cos(angle) * 3.5);
    const mz = Math.round(p.z + Math.sin(angle) * 3.5);
    mobsRef.current.push({
      id: `mob-${Date.now()}-${Math.random()}`,
      type: mobType,
      x: mx,
      y: p.y + 1,
      z: mz,
      vy: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: def.maxHp,
      maxHp: def.maxHp,
      hurtTimer: 0,
      aiTimer: 1,
      moveState: 'walk',
      attackCooldown: 0
    });
    setMobVersion(v => v + 1);
    showToast(`Spawned ${def.name}!`);
  }, [showToast]);

  // Eat Meat / Food Item Handler
  const handleEatFood = useCallback((foodId) => {
    const def = BLOCK_DEFS[foodId];
    if (!def?.isFood) return;

    if (gameMode === 'survival' || gameMode === 'adventure') {
      const qty = inventoryCounts[foodId] || 0;
      if (qty <= 0) {
        showToast(`No ${def.name} left to eat!`);
        return;
      }
      setInventoryCounts(prev => ({
        ...prev,
        [foodId]: Math.max(0, (prev[foodId] || 0) - 1)
      }));
    }

    soundFX.play('eat');
    setHunger(h => Math.min(20, h + (def.hungerRestore || 4)));
    setHealth(hp => Math.min(20, hp + (def.heal || 4)));
    showToast(`Ate ${def.name}! (+${def.heal} Health, +${def.hungerRestore} Hunger)`);
  }, [gameMode, inventoryCounts, showToast]);

  // Cook Raw Meat into Cooked Meat
  const handleCookMeat = useCallback((cookRec) => {
    const inSurvival = gameMode === 'survival' || gameMode === 'adventure';
    if (inSurvival) {
      if ((inventoryCounts[cookRec.rawId] || 0) < 1) {
        showToast(`Need 1x ${BLOCK_DEFS[cookRec.rawId]?.name} to cook!`);
        return;
      }
      setInventoryCounts(prev => ({
        ...prev,
        [cookRec.rawId]: (prev[cookRec.rawId] || 0) - 1,
        [cookRec.cookedId]: (prev[cookRec.cookedId] || 0) + 1
      }));
    } else {
      setInventoryCounts(prev => ({
        ...prev,
        [cookRec.cookedId]: (prev[cookRec.cookedId] || 0) + 1
      }));
    }
    setHotbar(prev => {
      if (prev.includes(cookRec.cookedId)) return prev;
      const copy = [...prev];
      copy[selectedSlot] = cookRec.cookedId;
      return copy;
    });
    soundFX.play('craft');
    showToast(`Cooked ${BLOCK_DEFS[cookRec.cookedId]?.name}! Right-click to eat.`);
  }, [gameMode, inventoryCounts, selectedSlot, showToast]);

  // Break Block Handler
  const handleBreakBlock = useCallback((x, y, z, currentId) => {
    if (y === 0 && currentId === 18 && gameMode === 'survival') {
      showToast('Bedrock layer cannot be broken in Survival!');
      return;
    }
    const key = kKey(x, y, z);
    worldBlocks.current.delete(key);

    // TNT chain reaction
    if (currentId === 17) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (dx * dx + dy * dy + dz * dz <= 5 && y + dy > 0) {
              worldBlocks.current.delete(kKey(x + dx, y + dy, z + dz));
            }
          }
        }
      }
      showToast('BOOM! TNT detonated!');
    }

    undoStack.current.push({ type: 'break', key, prevId: currentId, newId: null });
    redoStack.current = [];
    setHistoryCounts({ undo: undoStack.current.length, redo: 0 });

    // Collect resource in Survival / Adventure
    const dropId = BLOCK_DEFS[currentId]?.drop || currentId;
    if (gameMode === 'survival' || gameMode === 'adventure') {
      setInventoryCounts(prev => ({
        ...prev,
        [dropId]: (prev[dropId] || 0) + 1
      }));
      // Put in hotbar if not present
      setHotbar(prev => {
        if (prev.includes(dropId)) return prev;
        const emptyIdx = prev.findIndex(id => (inventoryCounts[id] || 0) === 0 && !BLOCK_DEFS[id]?.isTool);
        if (emptyIdx !== -1) {
          const copy = [...prev];
          copy[emptyIdx] = dropId;
          return copy;
        }
        return prev;
      });
    }

    // Adventure Relic check
    if (currentId === 19) {
      soundFX.play('relic');
      setRelicsFound(r => {
        const next = r + 1;
        showToast(`Relic Crystal Collected! (${next}/${totalRelics})`);
        return next;
      });
    } else {
      soundFX.play('break');
    }

    spawnParticles(x, y, z, currentId);
    setWorldVersion(v => v + 1);
  }, [gameMode, inventoryCounts, showToast, spawnParticles, totalRelics]);

  // Place Block Handler
  const handlePlaceBlock = useCallback((x, y, z) => {
    const selectedId = hotbar[selectedSlot];
    if (!selectedId || BLOCK_DEFS[selectedId]?.isTool || BLOCK_DEFS[selectedId]?.isFood || BLOCK_DEFS[selectedId]?.isItem) return;

    if (gameMode === 'survival' || gameMode === 'adventure') {
      const available = inventoryCounts[selectedId] || 0;
      if (available <= 0) {
        showToast(`Out of ${BLOCK_DEFS[selectedId]?.name}! Mine or craft more.`);
        return;
      }
      setInventoryCounts(prev => ({
        ...prev,
        [selectedId]: Math.max(0, (prev[selectedId] || 0) - 1)
      }));
    }

    const key = kKey(x, y, z);
    const prevId = worldBlocks.current.get(key) || null;
    worldBlocks.current.set(key, selectedId);

    undoStack.current.push({ type: 'place', key, prevId, newId: selectedId });
    redoStack.current = [];
    setHistoryCounts({ undo: undoStack.current.length, redo: 0 });

    soundFX.play('place');
    setWorldVersion(v => v + 1);
  }, [hotbar, selectedSlot, gameMode, inventoryCounts, showToast]);

  // Undo / Redo Actions
  const handleUndo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) {
      showToast('Nothing to undo');
      return;
    }
    if (action.prevId) worldBlocks.current.set(action.key, action.prevId);
    else worldBlocks.current.delete(action.key);
    redoStack.current.push(action);
    setHistoryCounts({ undo: undoStack.current.length, redo: redoStack.current.length });
    setWorldVersion(v => v + 1);
    showToast('Undid last block action');
  }, [showToast]);

  const handleRedo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) {
      showToast('Nothing to redo');
      return;
    }
    if (action.newId) worldBlocks.current.set(action.key, action.newId);
    else worldBlocks.current.delete(action.key);
    undoStack.current.push(action);
    setHistoryCounts({ undo: undoStack.current.length, redo: redoStack.current.length });
    setWorldVersion(v => v + 1);
    showToast('Redid block action');
  }, [showToast]);

  // Global Hotkeys (1-9, E, P, Z, Y, Scroll)
  useEffect(() => {
    if (screen !== 'playing') return;
    const onKeyDown = (e) => {
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) setSelectedSlot(num - 1);
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock();
        setUiModal(m => (m === 'inventory' ? null : 'inventory'));
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (uiModal) {
          setUiModal(null);
        } else {
          if (document.pointerLockElement) document.exitPointerLock();
          setUiModal('pause');
        }
      } else if (e.code === 'KeyZ' && !uiModal) {
        handleUndo();
      } else if (e.code === 'KeyY' && !uiModal) {
        handleRedo();
      }
    };
    const onWheel = (e) => {
      if (uiModal) return;
      if (e.deltaY > 0) setSelectedSlot(s => (s + 1) % 9);
      else if (e.deltaY < 0) setSelectedSlot(s => (s + 8) % 9);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', onWheel);
    };
  }, [screen, uiModal, handleUndo, handleRedo]);

  // Damage Player (Fall damage or Hostile Mob Attack)
  const handleDamagePlayer = useCallback((dmg, sourceName = 'Fall') => {
    soundFX.play('hurt');
    setHealth(h => {
      const next = h - dmg;
      if (next <= 0) {
        showToast(`Defeated by ${sourceName}! Respawning with full health...`);
        setSpawnTrigger(s => s + 1);
        return 20;
      }
      showToast(`${sourceName} dealt ${dmg} damage!`);
      return next;
    });
  }, [showToast]);

  // Crafting Handler
  const handleCraft = (recipe) => {
    if (gameMode === 'survival' || gameMode === 'adventure') {
      for (const ing of recipe.ingredients) {
        if ((inventoryCounts[ing.id] || 0) < ing.count) {
          showToast(`Need ${ing.count}x ${BLOCK_DEFS[ing.id].name} to craft!`);
          return;
        }
      }
      setInventoryCounts(prev => {
        const next = { ...prev };
        for (const ing of recipe.ingredients) {
          next[ing.id] = (next[ing.id] || 0) - ing.count;
        }
        next[recipe.result.id] = (next[recipe.result.id] || 0) + recipe.result.count;
        return next;
      });
    }
    // Place crafted item into active hotbar slot if not already on hotbar
    setHotbar(prev => {
      if (prev.includes(recipe.result.id)) return prev;
      const copy = [...prev];
      copy[selectedSlot] = recipe.result.id;
      return copy;
    });
    soundFX.play('craft');
    showToast(`Crafted ${recipe.result.count}x ${BLOCK_DEFS[recipe.result.id].name}!`);
  };

  // World Save / Load / Export
  const saveCurrentWorld = () => {
    try {
      const entries = Array.from(worldBlocks.current.entries());
      const saveObj = {
        id: Date.now(),
        name: worldName || 'My Blockverse',
        date: new Date().toLocaleString(),
        gameMode,
        terrainType,
        seed: worldSeed,
        hotbar,
        inventoryCounts,
        relicsFound,
        entries
      };
      const updated = [saveObj, ...savedWorlds.filter(w => w.name !== saveObj.name)].slice(0, 8);
      localStorage.setItem('blockverse_saves_v1', JSON.stringify(updated));
      setSavedWorlds(updated);
      showToast(`Saved world "${saveObj.name}" (${entries.length} blocks)`);
    } catch (e) {
      showToast('Storage quota reached — use Export JSON to save locally!');
    }
  };

  const loadSavedWorld = (saveObj) => {
    worldBlocks.current = new Map(saveObj.entries);
    setWorldName(saveObj.name);
    setGameMode(saveObj.gameMode || 'freeplay');
    setTerrainType(saveObj.terrainType || 'normal');
    if (saveObj.hotbar) setHotbar(saveObj.hotbar);
    if (saveObj.inventoryCounts) setInventoryCounts(saveObj.inventoryCounts);
    setRelicsFound(saveObj.relicsFound || 0);
    undoStack.current = [];
    redoStack.current = [];
    setWorldVersion(v => v + 1);
    setSpawnTrigger(s => s + 1);
    setUiModal(null);
    setScreen('playing');
    showToast(`Loaded world "${saveObj.name}"!`);
  };

  const exportWorldJSON = () => {
    const entries = Array.from(worldBlocks.current.entries());
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      name: worldName,
      gameMode,
      terrainType,
      hotbar,
      inventoryCounts,
      entries
    }));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${(worldName || 'blockverse').replace(/\s+/g, '_')}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Exported world JSON file');
  };

  const importWorldJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.entries) {
          loadSavedWorld(parsed);
        }
      } catch {
        showToast('Invalid world JSON file');
      }
    };
    reader.readAsText(file);
  };

  // Compute sun position & sky colors from timeOfDay
  const sunAngle = timeOfDay * Math.PI * 2;
  const sunPosition = [Math.cos(sunAngle) * 60, Math.sin(sunAngle) * 60, 20];
  const isDaytime = Math.sin(sunAngle) > -0.1;
  const skyBgColor = Math.sin(sunAngle) > 0.15
    ? '#7ec0ee'
    : Math.sin(sunAngle) > -0.15
    ? '#d97757'
    : '#0b1021';

  // ============================================================================
  // 7. RENDER MENU SCREENS OR ACTIVE 3D GAMEPLAY
  // ============================================================================
  if (screen !== 'playing') {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-slate-950 text-white font-sans select-none flex flex-col justify-between">
        {/* Animated Voxel Grid Backdrop */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 25%, #22c55e 0%, transparent 45%), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
            backgroundSize: '100% 100%, 40px 40px, 40px 40px'
          }}
        />

        {/* Top Bar */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-emerald-300">
              <Layers className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-black tracking-wider text-lg bg-gradient-to-r from-emerald-400 via-lime-300 to-cyan-400 bg-clip-text text-transparent">
                BLOCKVERSE 3D
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                VOXEL SANDBOX ENGINE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-medium transition"
            >
              {settings.sound ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
              {settings.sound ? 'SFX On' : 'SFX Muted'}
            </button>
            <button
              onClick={() => setScreen('settings')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-medium transition"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              Settings
            </button>
          </div>
        </header>

        {/* Main Center Content */}
        <main className="relative z-10 flex-1 flex items-center justify-center p-4 overflow-y-auto">
          {screen === 'menu' && (
            <div className="max-w-3xl w-full bg-slate-900/85 border border-white/15 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
              <div className="text-center mb-8">
                <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-2 bg-gradient-to-b from-white via-emerald-200 to-emerald-500 bg-clip-text text-transparent drop-shadow">
                  BLOCKVERSE 3D
                </h1>
                <p className="text-slate-400 text-sm sm:text-base">
                  Procedural Voxel World • Real-Time Lighting • Mining, Crafting & Unlimited Building
                </p>
              </div>

              {/* Primary Play Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => startNewGame('freeplay', 'normal', 'Free Play Valley')}
                  className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-400 hover:to-green-600 text-left shadow-lg shadow-emerald-950/60 border border-emerald-300/40 transition transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-black/30 rounded text-emerald-200">
                      Default Mode
                    </span>
                    <Compass className="w-6 h-6 text-white/90 group-hover:rotate-12 transition" />
                  </div>
                  <div className="text-2xl font-black text-white">Quick Free Play</div>
                  <p className="text-xs text-emerald-100/90 mt-1">
                    Instant unrestricted exploration, building, flying toggle (F), and undo/redo.
                  </p>
                </button>

                <button
                  onClick={() => setScreen('create')}
                  className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-indigo-600 to-blue-800 hover:from-indigo-500 hover:to-blue-700 text-left shadow-lg border border-indigo-300/30 transition transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-black/30 rounded text-indigo-200">
                      Custom World
                    </span>
                    <Play className="w-6 h-6 text-white/90 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="text-2xl font-black text-white">Play / Create World</div>
                  <p className="text-xs text-indigo-100/90 mt-1">
                    Choose custom World Name, Seed, Biome Terrain Type, and Game Mode.
                  </p>
                </button>
              </div>

              {/* 4 Selectable Game Mode Cards */}
              <div className="mb-6">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Or Launch Directly Into Any Game Mode:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => startNewGame('freeplay', 'normal', 'Free Play World')}
                    className="p-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-emerald-500/30 text-left transition group"
                  >
                    <Compass className="w-5 h-5 text-emerald-400 mb-1.5 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm">Free Play</div>
                    <div className="text-[11px] text-slate-400">No limits, walk or fly</div>
                  </button>

                  <button
                    onClick={() => startNewGame('creative', 'normal', 'Creative Realm')}
                    className="p-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-amber-500/30 text-left transition group"
                  >
                    <Hammer className="w-5 h-5 text-amber-400 mb-1.5 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm">Creative Mode</div>
                    <div className="text-[11px] text-slate-400">Infinite blocks & flight</div>
                  </button>

                  <button
                    onClick={() => startNewGame('survival', 'normal', 'Survival Frontier')}
                    className="p-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-rose-500/30 text-left transition group"
                  >
                    <ShieldAlert className="w-5 h-5 text-rose-400 mb-1.5 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm">Survival Mode</div>
                    <div className="text-[11px] text-slate-400">Mine, craft & health</div>
                  </button>

                  <button
                    onClick={() => startNewGame('adventure', 'mountains', 'Relic Adventure')}
                    className="p-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-purple-500/30 text-left transition group"
                  >
                    <Sparkles className="w-5 h-5 text-purple-400 mb-1.5 group-hover:scale-110 transition" />
                    <div className="font-bold text-sm">Adventure Mode</div>
                    <div className="text-[11px] text-slate-400">Find 5 Shrine Relics</div>
                  </button>
                </div>
              </div>

              {/* Load & Settings Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setScreen('load')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm font-semibold transition"
                  >
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    Load World ({savedWorlds.length})
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm font-semibold cursor-pointer transition">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    Import JSON
                    <input type="file" accept=".json" onChange={importWorldJSON} className="hidden" />
                  </label>
                </div>

                <div className="text-xs text-slate-400">
                  Controls: <span className="text-white font-semibold">WASD</span> Move • <span className="text-white font-semibold">LMB/RMB</span> Mine/Build • <span className="text-white font-semibold">E</span> Inventory • <span className="text-white font-semibold">F</span> Fly
                </div>
              </div>
            </div>
          )}

          {/* WORLD CREATION SCREEN */}
          {screen === 'create' && (
            <div className="max-w-2xl w-full bg-slate-900/90 border border-white/15 rounded-2xl p-7 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Plus className="w-6 h-6 text-emerald-400" /> Create New World
                </h2>
                <button
                  onClick={() => setScreen('menu')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  Back to Menu
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">World Name</label>
                    <input
                      type="text"
                      value={worldName}
                      onChange={e => setWorldName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-400"
                      placeholder="Enter world name..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">World Seed</label>
                    <input
                      type="text"
                      value={worldSeed}
                      onChange={e => setWorldSeed(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-emerald-400"
                      placeholder="Any word or number..."
                    />
                  </div>
                </div>

                {/* Terrain Type Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">World Biome & Terrain Generator</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'normal', label: 'Lush Continent', desc: 'Hills, caves, rivers & animals' },
                      { id: 'volcanic', label: 'Volcanic Ashlands', desc: 'Lava lakes, obsidian & slimes' },
                      { id: 'tundra', label: 'Frozen Tundra', desc: 'Ice spikes, snow & pines' },
                      { id: 'mushroom', label: 'Mushroom Kingdom', desc: 'Giant mushrooms & emeralds' },
                      { id: 'skyislands', label: 'Sky Islands', desc: 'Floating islands over void' },
                      { id: 'mountains', label: 'Alpine Peaks', desc: 'High snow mountain ridges' },
                      { id: 'desert', label: 'Desert Oasis', desc: 'Sand dunes & oases' },
                      { id: 'flat', label: 'Flat Builder', desc: 'Clean building canvas' },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTerrainType(t.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          terrainType === t.id
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-slate-800/70 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold text-xs">{t.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Mode Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Game Mode</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'freeplay', label: 'Free Play', desc: 'Unrestricted sandbox (Default)' },
                      { id: 'creative', label: 'Creative', desc: 'Infinite blocks & flying' },
                      { id: 'survival', label: 'Survival', desc: 'Mine resources, health & craft' },
                      { id: 'adventure', label: 'Adventure', desc: 'Find hidden Shrine Relics' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setGameMode(m.id)}
                        className={`p-3 rounded-xl border text-left transition ${
                          gameMode === m.id
                            ? 'bg-indigo-500/25 border-indigo-400 text-white'
                            : 'bg-slate-800/70 border-white/10 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold text-xs">{m.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => startNewGame(gameMode, terrainType, worldName)}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 font-black text-base shadow-lg shadow-emerald-950 transition"
                >
                  Generate & Launch World
                </button>
              </div>
            </div>
          )}

          {/* LOAD SAVED WORLD SCREEN */}
          {screen === 'load' && (
            <div className="max-w-2xl w-full bg-slate-900/90 border border-white/15 rounded-2xl p-7 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <FolderOpen className="w-6 h-6 text-amber-400" /> Saved Worlds
                </h2>
                <button
                  onClick={() => setScreen('menu')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  Back to Menu
                </button>
              </div>

              {savedWorlds.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-dashed border-white/10 rounded-xl">
                  No worlds saved in browser storage yet. Build something and press Save in the Pause Menu!
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {savedWorlds.map(w => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-800/80 border border-white/10 hover:border-emerald-400/50 transition"
                    >
                      <div>
                        <div className="font-bold text-base text-white">{w.name}</div>
                        <div className="text-xs text-slate-400">
                          Mode: <span className="text-emerald-300 uppercase">{w.gameMode}</span> • Terrain: {w.terrainType} • Saved: {w.date}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadSavedWorld(w)}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
                        >
                          Load World
                        </button>
                        <button
                          onClick={() => {
                            const next = savedWorlds.filter(item => item.id !== w.id);
                            setSavedWorlds(next);
                            localStorage.setItem('blockverse_saves_v1', JSON.stringify(next));
                          }}
                          className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS SCREEN */}
          {screen === 'settings' && (
            <div className="max-w-xl w-full bg-slate-900/90 border border-white/15 rounded-2xl p-7 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <Sliders className="w-6 h-6 text-cyan-400" /> Game Settings
                </h2>
                <button
                  onClick={() => setScreen('menu')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  Done
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-semibold">Camera Field of View (FOV)</span>
                    <span className="text-emerald-400 font-bold">{settings.fov}°</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="100"
                    value={settings.fov}
                    onChange={e => setSettings({ ...settings, fov: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-semibold">World Generation Size (Radius)</span>
                    <span className="text-emerald-400 font-bold">{settings.worldRadius * 2}x{settings.worldRadius * 2} Blocks</span>
                  </div>
                  <input
                    type="range"
                    min="28"
                    max="64"
                    step="4"
                    value={settings.worldRadius}
                    onChange={e => setSettings({ ...settings, worldRadius: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-semibold">Day / Night Cycle Speed</span>
                    <span className="text-emerald-400 font-bold">{settings.daySpeed === 0 ? 'Paused (Always Day)' : `${settings.daySpeed}x`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={settings.daySpeed}
                    onChange={e => setSettings({ ...settings, daySpeed: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-slate-300 font-semibold">Synthesized Sound Effects (Web Audio)</span>
                  <button
                    onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))}
                    className={`px-4 py-2 rounded-lg font-bold text-xs ${
                      settings.sound ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {settings.sound ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="relative z-10 px-6 py-3 text-center text-xs text-slate-500 border-t border-white/5 bg-slate-950/80">
          BLOCKVERSE 3D • Built with React, Three.js & React Three Fiber • Instanced Voxel Rendering
        </footer>
      </div>
    );
  }

  // ============================================================================
  // 8. ACTIVE 3D SANDBOX GAMEPLAY & HUD OVERLAY
  // ============================================================================
  const activeBlockDef = BLOCK_DEFS[hotbar[selectedSlot]];

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none font-sans"
      style={{ backgroundColor: skyBgColor, transition: 'background-color 0.8s linear' }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* 3D R3F Canvas */}
      <Canvas
        shadows
        camera={{ fov: settings.fov, near: 0.1, far: 220 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={[skyBgColor, 35, 95]} />
        <ambientLight intensity={isDaytime ? 0.65 : 0.22} />
        <directionalLight
          castShadow
          position={sunPosition}
          intensity={isDaytime ? 1.15 : 0.18}
          color={isDaytime ? '#fffbeb' : '#60a5fa'}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />

        {isDaytime ? (
          <Sky sunPosition={sunPosition} turbidity={0.3} rayleigh={0.6} />
        ) : (
          <Stars radius={80} depth={40} count={2500} factor={4} fade />
        )}

        <VoxelClouds />

        <InstancedVoxelWorld worldBlocks={worldBlocks} worldVersion={worldVersion} />

        <LivingMobsManager
          mobsRef={mobsRef}
          worldBlocks={worldBlocks}
          playerPosRef={playerPosRef}
          gameMode={gameMode}
          isDaytime={isDaytime}
          onDamagePlayer={handleDamagePlayer}
          onDropEgg={() => {
            setInventoryCounts(prev => ({ ...prev, 209: (prev[209] || 0) + 1 }));
          }}
          uiModalOpen={Boolean(uiModal)}
          mobVersion={mobVersion}
        />

        <BreakParticles bursts={bursts} />

        <FirstPersonPlayer
          worldBlocks={worldBlocks}
          mobsRef={mobsRef}
          playerPosRef={playerPosRef}
          gameMode={gameMode}
          isFlying={isFlying}
          setIsFlying={setIsFlying}
          uiModalOpen={Boolean(uiModal)}
          selectedBlockId={hotbar[selectedSlot]}
          onPlaceBlock={handlePlaceBlock}
          onBreakBlock={handleBreakBlock}
          onAttackMob={handleAttackMob}
          onEatFood={handleEatFood}
          onSwingHand={triggerHandSwing}
          onHudUpdate={patch => setHudUpdate => setHudState(prev => ({ ...prev, ...patch }))}
          onDamagePlayer={handleDamagePlayer}
          spawnTrigger={spawnTrigger}
          settings={settings}
        />

        {!uiModal && (
          <PointerLockControls
            onLock={() => setIsPointerLocked(true)}
            onUnlock={() => setIsPointerLocked(false)}
          />
        )}
      </Canvas>

      {/* FIRST-PERSON HELD ITEM / WEAPON / MEAT VIEWMODEL (BOTTOM RIGHT) */}
      {!uiModal && activeBlockDef && (
        <div
          className={`pointer-events-none fixed bottom-6 right-8 z-20 transition-transform duration-150 ${
            handSwing ? '-rotate-45 -translate-x-8 translate-y-4 scale-110' : 'rotate-6'
          }`}
        >
          <div className="relative p-3 rounded-2xl bg-slate-900/40 backdrop-blur-xs border border-white/10 shadow-2xl">
            <img
              src={getBlockIconDataURL(activeBlockDef.id)}
              alt={activeBlockDef.name}
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_12px_12px_rgba(0,0,0,0.65)]"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </div>
      )}

      {/* CENTER CROSSHAIR & MINING PROGRESS BAR */}
      {!uiModal && (
        <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center z-20">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="w-4 h-0.5 bg-white/90 shadow" />
            <div className="h-4 w-0.5 bg-white/90 shadow absolute" />
          </div>
          {hudState.breakProgress > 0 && (
            <div className="mt-3 w-24 h-2 bg-black/70 rounded-full overflow-hidden border border-white/30">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${hudState.breakProgress * 100}%` }}
              />
            </div>
          )}
          {hudState.targetName && (
            <div className="mt-1.5 px-2 py-0.5 rounded bg-black/55 text-[11px] text-white/90 font-medium">
              {hudState.targetName}
            </div>
          )}
        </div>
      )}

      {/* CLICK TO FOCUS PROMPT BANNER */}
      {!isPointerLocked && !uiModal && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 border border-emerald-400/50 text-white px-5 py-2.5 rounded-xl shadow-2xl text-center animate-pulse">
          <div className="text-sm font-bold text-emerald-300">Click anywhere on the 3D view to lock mouse & look around</div>
          <div className="text-[11px] text-slate-300">Press E for Inventory/Crafting • P or ESC for Pause & Save</div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="pointer-events-none fixed top-20 right-6 z-30 bg-slate-900/90 border border-emerald-400/40 text-emerald-200 px-4 py-2 rounded-xl shadow-xl text-xs font-semibold">
          {toastMsg}
        </div>
      )}

      {/* TOP LEFT HUD: WORLD INFO, COORDS, MODE & ADVENTURE QUEST */}
      <div className="fixed top-3 left-3 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs tracking-wider text-emerald-400">BLOCKVERSE 3D</span>
            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-white/10 font-bold text-amber-300">
              {gameMode}
            </span>
            {isFlying && (
              <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-cyan-500/30 border border-cyan-400/40 font-bold text-cyan-200">
                FLYING (F)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-300 mt-1 font-mono">
            XYZ: {hudState.coords[0]} / {hudState.coords[1]} / {hudState.coords[2]} •{' '}
            {isDaytime ? '☀️ Day' : '🌙 Night'} • 🐾 Mobs: {mobsRef.current.length}
          </div>
        </div>

        {gameMode === 'adventure' && (
          <div className="bg-purple-950/80 backdrop-blur-md border border-purple-400/40 rounded-xl px-3.5 py-2 text-white shadow-lg">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
              <Award className="w-4 h-4" /> Adventure Quest: Relic Shrines
            </div>
            <div className="text-xs text-purple-100 mt-0.5">
              Relic Crystals Mined: <span className="font-black text-amber-300">{relicsFound} / {totalRelics}</span>
            </div>
          </div>
        )}
      </div>

      {/* TOP RIGHT QUICK ACTION BUTTONS */}
      <div className="fixed top-3 right-3 z-20 flex items-center gap-2">
        <button
          onClick={handleUndo}
          title="Undo (Z)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-white/15 text-white text-xs font-semibold shadow"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Undo</span> ({historyCounts.undo})
        </button>
        <button
          onClick={handleRedo}
          title="Redo (Y)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-white/15 text-white text-xs font-semibold shadow"
        >
          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Redo</span> ({historyCounts.redo})
        </button>
        <button
          onClick={() => setTimeOfDay(t => (t + 0.25) % 1)}
          title="Toggle Day / Night"
          className="p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-white/15 text-white shadow"
        >
          {isDaytime ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-300" />}
        </button>
        <button
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setUiModal('inventory');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-300/30 text-white text-xs font-bold shadow"
        >
          <Package className="w-3.5 h-3.5" /> Inventory (E)
        </button>
        <button
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setUiModal('pause');
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-white/15 text-white text-xs font-bold shadow"
        >
          Menu (P)
        </button>
      </div>

      {/* BOTTOM HUD: SURVIVAL HEARTS/HUNGER & 9-SLOT HOTBAR */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {/* Survival Hearts & Hunger Bar */}
        {(gameMode === 'survival' || gameMode === 'adventure') && (
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-0.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-white/10">
              {Array.from({ length: 10 }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.ceil(health / 2) ? 'text-rose-500 fill-rose-500' : 'text-slate-600'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-white/10">
              {Array.from({ length: 10 }).map((_, i) => (
                <Flame
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.ceil(hunger / 2) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Active Item Label */}
        <div className="px-3 py-0.5 rounded-full bg-slate-950/80 border border-white/15 text-xs font-bold text-white shadow">
          {activeBlockDef?.name || 'Empty'}
          {activeBlockDef?.isWeapon && ` (${activeBlockDef.damage} Attack DMG — Left-Click Mobs)`}
          {activeBlockDef?.isTool && !activeBlockDef?.isWeapon && ` (${activeBlockDef.speedMultiplier}x Mine Speed)`}
          {activeBlockDef?.isFood && ` (+${activeBlockDef.heal} HP / +${activeBlockDef.hungerRestore} Hunger — Right-Click to Eat)`}
        </div>

        {/* 9-Slot Hotbar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/85 border-2 border-white/20 backdrop-blur-md shadow-2xl">
          {hotbar.map((blockId, idx) => {
            const def = BLOCK_DEFS[blockId];
            const isSelected = selectedSlot === idx;
            const qty = inventoryCounts[blockId] ?? 0;
            return (
              <button
                key={idx}
                onClick={() => setSelectedSlot(idx)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition ${
                  isSelected
                    ? 'bg-emerald-500/30 border-2 border-emerald-400 scale-105 shadow-lg'
                    : 'bg-slate-900/90 border border-white/10 hover:bg-slate-800'
                }`}
              >
                <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-400">
                  {idx + 1}
                </span>
                {def && (
                  <img
                    src={getBlockIconDataURL(blockId)}
                    alt={def.name}
                    className="w-8 h-8 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
                {(gameMode === 'survival' || gameMode === 'adventure') && !def?.isTool && (
                  <span className="absolute bottom-0.5 right-1.5 text-[11px] font-black text-white drop-shadow">
                    {qty}
                  </span>
                )}
                {gameMode !== 'survival' && gameMode !== 'adventure' && !def?.isTool && (
                  <span className="absolute bottom-0.5 right-1.5 text-[10px] font-bold text-emerald-300">
                    {qty > 0 ? qty : '∞'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* INVENTORY, COOKING, CRAFTING & MOB SPAWNER MODAL (KEY E)             */}
      {/* ==================================================================== */}
      {uiModal === 'inventory' && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-5xl w-full bg-slate-900 border border-white/20 rounded-2xl p-6 text-white shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  <Package className="w-6 h-6 text-emerald-400" /> Inventory, Furnace Cooking, Weapons & Mob Spawner
                </h2>
                <p className="text-xs text-slate-400">
                  Click any Block, Sword, or Meat to equip it in Hotbar Slot #{selectedSlot + 1} • Right-click with Meat to eat!
                </p>
              </div>
              <button
                onClick={() => setUiModal(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instant Creature & Enemy Spawner Bar */}
            <div className="my-3 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <PawPrint className="w-4 h-4" /> Spawn Creatures & Enemies Near You:
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.values(MOB_TYPES).map(mob => (
                  <button
                    key={mob.type}
                    onClick={() => spawnMobNearPlayer(mob.type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                      mob.hostile
                        ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/40 text-emerald-200'
                    }`}
                  >
                    + {mob.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 py-2 overflow-y-auto flex-1">
              {/* Block, Sword & Meat Catalog */}
              <div className="lg:col-span-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Blocks, Weapons & Meat/Food (Click to Equip into Slot #{selectedSlot + 1})
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[46vh] overflow-y-auto pr-1">
                  {ALL_BLOCK_IDS.map(id => {
                    const def = BLOCK_DEFS[id];
                    const count = inventoryCounts[id] || 0;
                    const inSurvival = gameMode === 'survival' || gameMode === 'adventure';
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          const next = [...hotbar];
                          next[selectedSlot] = id;
                          setHotbar(next);
                          soundFX.play('place');
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                          hotbar[selectedSlot] === id
                            ? 'bg-emerald-500/25 border-emerald-400'
                            : 'bg-slate-800/80 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <img
                          src={getBlockIconDataURL(id)}
                          alt={def.name}
                          className="w-8 h-8"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <div className="text-[10px] font-bold text-center leading-tight line-clamp-1">
                          {def.name}
                        </div>
                        <div className="text-[9px] text-emerald-300 font-mono">
                          {inSurvival
                            ? def.isTool
                              ? count > 0 ? 'Owned' : 'Craft'
                              : `Qty: ${count}`
                            : def.isWeapon
                            ? `${def.damage} DMG`
                            : def.isFood
                            ? `+${def.heal} HP`
                            : '∞'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Furnace Cooking + Crafting Recipes Panel */}
              <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3.5 flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-2 flex items-center gap-1.5">
                    <Utensils className="w-4 h-4" /> Campfire / Furnace Meat Cooking
                  </div>
                  <div className="space-y-2">
                    {COOKING_RECIPES.map(c => {
                      const cookedDef = BLOCK_DEFS[c.cookedId];
                      const rawCount = inventoryCounts[c.rawId] || 0;
                      return (
                        <div
                          key={c.rawId}
                          className="p-2 rounded-xl bg-slate-900 border border-orange-500/20 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={getBlockIconDataURL(c.cookedId)}
                              alt={cookedDef.name}
                              className="w-7 h-7"
                              style={{ imageRendering: 'pixelated' }}
                            />
                            <div>
                              <div className="text-xs font-bold text-white">{cookedDef.name}</div>
                              <div className="text-[10px] text-slate-400">
                                Raw Owned: {rawCount} • Restores {cookedDef.heal} HP
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCookMeat(c)}
                            className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-xs transition"
                          >
                            Cook
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                    <Pickaxe className="w-4 h-4" /> Weapon & Block Crafting
                  </div>
                  <div className="space-y-2">
                    {CRAFTING_RECIPES.map(r => {
                      const resDef = BLOCK_DEFS[r.result.id];
                      return (
                        <div
                          key={r.id}
                          className="p-2 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={getBlockIconDataURL(r.result.id)}
                              alt={resDef.name}
                              className="w-7 h-7"
                              style={{ imageRendering: 'pixelated' }}
                            />
                            <div>
                              <div className="text-xs font-bold text-white">
                                {r.result.count}x {resDef.name}
                              </div>
                              <div className="text-[10px] text-slate-400">{r.desc}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCraft(r)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition"
                          >
                            Craft
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Hotbar Selector Strip inside Inventory */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                {hotbar.map((id, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlot(idx)}
                    className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                      selectedSlot === idx
                        ? 'bg-emerald-500/30 border-emerald-400'
                        : 'bg-slate-800 border-white/10'
                    }`}
                  >
                    <img
                      src={getBlockIconDataURL(id)}
                      alt=""
                      className="w-7 h-7"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </button>
                ))}
              </div>
              <button
                onClick={() => setUiModal(null)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm"
              >
                Resume Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PAUSE & SAVE MENU MODAL (ESC / KEY P)                                */}
      {/* ==================================================================== */}
      {uiModal === 'pause' && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-white/20 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-xl font-black">Game Paused</h2>
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                {worldName}
              </span>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => setUiModal(null)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm transition"
              >
                Resume Gameplay
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={saveCurrentWorld}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs transition"
                >
                  <Save className="w-4 h-4" /> Save World
                </button>
                <button
                  onClick={exportWorldJSON}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 font-bold text-xs transition"
                >
                  <Download className="w-4 h-4 text-cyan-400" /> Export JSON
                </button>
              </div>

              {/* Quick Mode Switcher */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10">
                <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">Switch Game Mode On-The-Fly</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {['freeplay', 'creative', 'survival', 'adventure'].map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        setGameMode(m);
                        if (m === 'survival' || m === 'adventure') setIsFlying(false);
                        showToast(`Switched to ${m.toUpperCase()} mode`);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize border ${
                        gameMode === m
                          ? 'bg-emerald-500/30 border-emerald-400 text-white'
                          : 'bg-slate-800 border-white/5 text-slate-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls Reference */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-1 text-slate-300">
                <div className="font-bold text-white mb-1">Controls Summary:</div>
                <div>• <span className="text-emerald-300 font-semibold">W, A, S, D</span> : Move / Strafe</div>
                <div>• <span className="text-emerald-300 font-semibold">Space / Shift</span> : Jump / Sprint (Up/Down in Fly)</div>
                <div>• <span className="text-emerald-300 font-semibold">Left / Right Click</span> : Mine Block / Place Block</div>
                <div>• <span className="text-emerald-300 font-semibold">E</span> : Inventory & Crafting • <span className="text-emerald-300 font-semibold">F</span> : Toggle Flying</div>
                <div>• <span className="text-emerald-300 font-semibold">Z / Y</span> : Undo / Redo Building Actions</div>
              </div>

              <button
                onClick={() => {
                  setUiModal(null);
                  setScreen('menu');
                }}
                className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-xs transition"
              >
                Exit to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}