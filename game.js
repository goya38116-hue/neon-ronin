"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const panel = document.querySelector("#startPanel");
const startButton = document.querySelector("#startButton");
const W = canvas.width;
const H = canvas.height;

const keys = { up: false, down: false, left: false, right: false, attack: false, dash: false };
const particles = [];
const slashes = [];
let enemies = [];
let state = "menu";
let score = 0;
let highScore = Number(localStorage.getItem("neonRoninHighScore") || 0);
let wave = 1;
let waveDelay = 0;
let shake = 0;
let flash = 0;
let lastTime = performance.now();

const player = {
  x: W / 2, y: H / 2, r: 15, speed: 220, hp: 100,
  facing: 0, attackTimer: 0, attackCooldown: 0,
  dashTimer: 0, dashCooldown: 0, invuln: 0,
  combo: 0, comboTimer: 0
};

const random = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function resetGame() {
  Object.assign(player, {
    x: W / 2, y: H / 2, hp: 100, facing: 0, attackTimer: 0,
    attackCooldown: 0, dashTimer: 0, dashCooldown: 0, invuln: 0,
    combo: 0, comboTimer: 0
  });
  enemies = [];
  particles.length = 0;
  slashes.length = 0;
  score = 0;
  wave = 1;
  waveDelay = 0;
  spawnWave();
  state = "playing";
  panel.classList.add("hidden");
}

function spawnWave() {
  const count = Math.min(4 + wave * 2, 22);
  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);
    const pos = side < 2
      ? { x: side ? W + 30 : -30, y: random(75, H - 35) }
      : { x: random(25, W - 25), y: side === 2 ? 65 : H + 30 };
    const brute = wave >= 3 && Math.random() < Math.min(.12 + wave * .015, .32);
    enemies.push({
      ...pos, r: brute ? 21 : 13, hp: brute ? 3 : 1,
      speed: (brute ? 44 : random(66, 88)) + wave * 3,
      hit: 0, attack: random(0, .5), brute, dead: false
    });
  }
}

function burst(x, y, color, amount = 12, force = 150) {
  for (let i = 0; i < amount; i++) {
    const a = random(0, Math.PI * 2);
    const v = random(force * .25, force);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: random(.18, .55), max: .55, color, size: random(2, 6) });
  }
}

function attack() {
  if (player.attackCooldown > 0 || state !== "playing") return;
  player.attackTimer = .18;
  player.attackCooldown = .28;
  slashes.push({ x: player.x, y: player.y, angle: player.facing, life: .16 });
  let hitSomething = false;
  for (const enemy of enemies) {
    const d = distance(player, enemy);
    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    const delta = Math.atan2(Math.sin(angle - player.facing), Math.cos(angle - player.facing));
    if (!enemy.dead && d < 92 + enemy.r && Math.abs(delta) < 1.15) {
      enemy.hp -= 1;
      enemy.hit = .14;
      enemy.x += Math.cos(player.facing) * 24;
      enemy.y += Math.sin(player.facing) * 24;
      hitSomething = true;
      burst(enemy.x, enemy.y, enemy.brute ? "#ff9b42" : "#ff3cac", 8, 110);
      if (enemy.hp <= 0) killEnemy(enemy);
    }
  }
  if (hitSomething) shake = Math.max(shake, 5);
}

function dash() {
  if (player.dashCooldown > 0 || state !== "playing") return;
  player.dashTimer = .16;
  player.dashCooldown = 1.05;
  player.invuln = .26;
  burst(player.x, player.y, "#35f2ff", 14, 120);
}

function killEnemy(enemy) {
  enemy.dead = true;
  player.combo = player.comboTimer > 0 ? player.combo + 1 : 1;
  player.comboTimer = 2.4;
  score += 100 * Math.min(player.combo, 10) * (enemy.brute ? 3 : 1);
  burst(enemy.x, enemy.y, enemy.brute ? "#ff9b42" : "#ff3cac", enemy.brute ? 24 : 16, 210);
}

function update(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; p.life -= dt;
  });
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
  slashes.forEach(s => s.life -= dt);
  for (let i = slashes.length - 1; i >= 0; i--) if (slashes[i].life <= 0) slashes.splice(i, 1);
  shake = Math.max(0, shake - dt * 28);
  flash = Math.max(0, flash - dt * 4);
  if (state !== "playing") return;

  player.attackTimer = Math.max(0, player.attackTimer - dt);
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.comboTimer = Math.max(0, player.comboTimer - dt);
  if (!player.comboTimer) player.combo = 0;

  let dx = Number(keys.right) - Number(keys.left);
  let dy = Number(keys.down) - Number(keys.up);
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  if (dx || dy) player.facing = Math.atan2(dy, dx);
  const moveSpeed = player.speed * (player.dashTimer > 0 ? 3.25 : 1);
  player.x = clamp(player.x + dx * moveSpeed * dt, 20, W - 20);
  player.y = clamp(player.y + dy * moveSpeed * dt, 82, H - 22);
  if (player.dashTimer > 0 && Math.random() < .75) burst(player.x, player.y, "#35f2ff", 1, 20);
  if (keys.attack) attack();
  if (keys.dash) dash();

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    enemy.hit = Math.max(0, enemy.hit - dt);
    enemy.attack = Math.max(0, enemy.attack - dt);
    const a = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(a) * enemy.speed * dt;
    enemy.y += Math.sin(a) * enemy.speed * dt;
    if (distance(player, enemy) < player.r + enemy.r + 4 && enemy.attack <= 0 && player.invuln <= 0) {
      const damage = enemy.brute ? 24 : 12;
      player.hp -= damage;
      player.invuln = .72;
      enemy.attack = .8;
      player.combo = 0;
      flash = .7;
      shake = 12;
      burst(player.x, player.y, "#ffffff", 18, 210);
      if (player.hp <= 0) gameOver();
    }
  }
  enemies = enemies.filter(enemy => !enemy.dead);
  if (!enemies.length) {
    waveDelay += dt;
    if (waveDelay > 1.35) { wave += 1; waveDelay = 0; spawnWave(); }
  }
}

function gameOver() {
  state = "gameover";
  highScore = Math.max(highScore, score);
  localStorage.setItem("neonRoninHighScore", highScore);
  panel.querySelector(".kicker").textContent = `SCORE ${String(score).padStart(6, "0")}`;
  panel.querySelector("h2").textContent = "任務失敗";
  panel.querySelector("p:not(.kicker)").textContent = `ウェーブ ${wave} まで到達。ハイスコア ${highScore}`;
  startButton.textContent = "もう一度挑戦";
  panel.classList.remove("hidden");
}

function drawBackground(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#080b1d"); gradient.addColorStop(.55, "#15122a"); gradient.addColorStop(1, "#070911");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ff3cac18"; ctx.fillRect(0, 64, W, 2);
  for (let i = 0; i < 24; i++) {
    const x = i * 47 - ((time * .008) % 47);
    const h = 36 + ((i * 31) % 92);
    ctx.fillStyle = i % 3 === 0 ? "#111936" : "#0d1229";
    ctx.fillRect(x, 65 - h, 39, h);
    ctx.fillStyle = i % 2 ? "#35f2ff70" : "#ff3cac70";
    for (let y = 12; y < h - 5; y += 13) ctx.fillRect(x + 7 + (y % 2) * 10, 65 - h + y, 3, 5);
  }
  ctx.strokeStyle = "#27304f"; ctx.lineWidth = 1;
  for (let y = 80; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 65); ctx.lineTo(x - 150, H); ctx.stroke(); }
  ctx.fillStyle = "#35f2ff10"; ctx.fillRect(0, 66, W, H - 66);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  if (player.invuln > 0 && Math.floor(player.invuln * 18) % 2) ctx.globalAlpha = .35;
  ctx.shadowColor = "#35f2ff"; ctx.shadowBlur = 18;
  ctx.fillStyle = "#35f2ff";
  ctx.beginPath(); ctx.moveTo(23, 0); ctx.lineTo(-14, -13); ctx.lineTo(-7, 0); ctx.lineTo(-14, 13); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = "#f2fbff"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ff3cac"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(-25, 22); ctx.stroke();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save(); ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = enemy.brute ? "#ff9b42" : "#ff3cac"; ctx.shadowBlur = enemy.hit ? 24 : 10;
  ctx.fillStyle = enemy.hit ? "#ffffff" : enemy.brute ? "#ff9b42" : "#ff3cac";
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-enemy.r * .72, -enemy.r * .72, enemy.r * 1.44, enemy.r * 1.44);
  ctx.fillStyle = "#100916"; ctx.fillRect(-enemy.r * .28, -enemy.r * .28, enemy.r * .56, enemy.r * .56);
  ctx.restore();
  if (enemy.brute) {
    ctx.fillStyle = "#371b1e"; ctx.fillRect(enemy.x - 20, enemy.y - 32, 40, 4);
    ctx.fillStyle = "#ff9b42"; ctx.fillRect(enemy.x - 20, enemy.y - 32, 40 * (enemy.hp / 3), 4);
  }
}

function drawSlash(slash) {
  const t = slash.life / .16;
  ctx.save(); ctx.translate(slash.x, slash.y); ctx.rotate(slash.angle);
  ctx.strokeStyle = `rgba(53,242,255,${t})`; ctx.lineWidth = 10 * t; ctx.shadowColor = "#35f2ff"; ctx.shadowBlur = 22;
  ctx.beginPath(); ctx.arc(0, 0, 68, -.9, .9); ctx.stroke(); ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "#090c19cc"; ctx.fillRect(0, 0, W, 66);
  ctx.fillStyle = "#5e688a"; ctx.fillRect(24, 22, 230, 10);
  const hpColor = player.hp > 35 ? "#35f2ff" : "#ff3cac";
  ctx.fillStyle = hpColor; ctx.fillRect(24, 22, 230 * Math.max(0, player.hp) / 100, 10);
  ctx.font = "700 11px system-ui"; ctx.fillStyle = "#fff"; ctx.fillText(`HP ${Math.max(0, player.hp)}`, 24, 48);
  ctx.fillStyle = player.dashCooldown ? "#3b4260" : "#d4ff4f"; ctx.fillRect(275, 22, 74 * (1 - player.dashCooldown / 1.05), 5);
  ctx.fillStyle = "#8791b4"; ctx.fillText("DASH", 275, 48);
  ctx.textAlign = "center"; ctx.font = "900 14px system-ui"; ctx.fillStyle = "#ff3cac"; ctx.fillText(`WAVE ${wave}`, W / 2, 28);
  ctx.font = "700 10px system-ui"; ctx.fillStyle = "#7e88aa"; ctx.fillText(`${enemies.length} TARGETS`, W / 2, 47);
  ctx.textAlign = "right"; ctx.font = "900 22px ui-monospace, monospace"; ctx.fillStyle = "#fff"; ctx.fillText(String(score).padStart(6, "0"), W - 24, 34);
  ctx.font = "700 9px system-ui"; ctx.fillStyle = "#717b9c"; ctx.fillText(`BEST ${String(highScore).padStart(6, "0")}`, W - 24, 49);
  if (player.combo > 1) {
    ctx.textAlign = "center"; ctx.font = `900 ${28 + Math.min(player.combo, 10)}px system-ui`; ctx.fillStyle = "#d4ff4f";
    ctx.fillText(`${player.combo} COMBO`, W / 2, 108);
  }
}

function draw(time) {
  ctx.save();
  if (shake) ctx.translate(random(-shake, shake), random(-shake, shake));
  drawBackground(time);
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  enemies.forEach(drawEnemy);
  slashes.forEach(drawSlash);
  drawPlayer();
  drawHud();
  ctx.restore();
  if (flash) { ctx.fillStyle = `rgba(255,60,172,${flash * .24})`; ctx.fillRect(0, 0, W, H); }
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, .033);
  lastTime = time;
  update(dt); draw(time); requestAnimationFrame(loop);
}

const keyMap = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  KeyJ: "attack", Space: "attack", KeyK: "dash", ShiftLeft: "dash", ShiftRight: "dash"
};

window.addEventListener("keydown", event => {
  if (keyMap[event.code]) { event.preventDefault(); keys[keyMap[event.code]] = true; }
  if (event.code === "Enter" && state !== "playing") resetGame();
});
window.addEventListener("keyup", event => { if (keyMap[event.code]) keys[keyMap[event.code]] = false; });
window.addEventListener("blur", () => Object.keys(keys).forEach(key => keys[key] = false));

document.querySelectorAll("[data-key]").forEach(button => {
  const key = button.dataset.key;
  const press = event => { event.preventDefault(); keys[key] = true; if (key === "attack") attack(); if (key === "dash") dash(); };
  const release = event => { event.preventDefault(); keys[key] = false; };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

startButton.addEventListener("click", resetGame);
requestAnimationFrame(loop);
