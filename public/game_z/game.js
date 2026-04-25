// @ts-nocheck
/* ============================================================
   BRAWL KILLER  -  game.js
   A Brawl-Stars-inspired top-down shooter for the browser.
   Controls: WASD / Arrow keys to move · Mouse to aim/shoot
             Space / Q for Super ability
   ============================================================ */

(function () {
  "use strict";

  // -- BRAWLER DEFINITIONS ---------------------------------------
  const BRAWLERS = [
    {
      id: "shelly", name: "Shelly", emoji: "🤠", role: "Warrior",
      color: "#e67e22", superColor: "#e67e22",
      hp: 4400, speed: 3.4,
      bulletDmg: 560, bulletCount: 6, bulletSpread: 0.22, bulletSpeed: 9,
      reloadTime: 1.8, maxAmmo: 3,
      superCost: 10, superRadius: 260, superDmg: 1200,
      superDesc: "Point-blank blast",
      stats: { "❤️": "4400", "⚡": "3.4", "🔫": "560" },
    },
    {
      id: "colt", name: "Colt", emoji: "🔫", role: "Sharpshooter",
      color: "#3498db", superColor: "#2980b9",
      hp: 3500, speed: 3.7,
      bulletDmg: 680, bulletCount: 1, bulletSpread: 0.04, bulletSpeed: 14,
      reloadTime: 1.5, maxAmmo: 6,
      superCost: 12, superRadius: 400, superDmg: 800,
      superDesc: "Six-bullet barrage",
      stats: { "❤️": "3500", "⚡": "3.7", "🔫": "680" },
    },
    {
      id: "bull", name: "Bull", emoji: "🐂", role: "Tank",
      color: "#e74c3c", superColor: "#c0392b",
      hp: 6600, speed: 2.9,
      bulletDmg: 960, bulletCount: 4, bulletSpread: 0.32, bulletSpeed: 7,
      reloadTime: 2.2, maxAmmo: 3,
      superCost: 8, superRadius: 350, superDmg: 500,
      superDesc: "Bull charge",
      stats: { "❤️": "6600", "⚡": "2.9", "🔫": "960" },
    },
    {
      id: "poco", name: "Poco", emoji: "🎸", role: "Support",
      color: "#9b59b6", superColor: "#8e44ad",
      hp: 4000, speed: 3.2,
      bulletDmg: 700, bulletCount: 3, bulletSpread: 0.28, bulletSpeed: 10,
      reloadTime: 1.6, maxAmmo: 3,
      superCost: 9, superRadius: 300, superDmg: 0,
      superDesc: "Heal wave (+1200 HP)",
      stats: { "❤️": "4000", "⚡": "3.2", "🔫": "700" },
    },
    {
      id: "spike", name: "Spike", emoji: "🌵", role: "Marksman",
      color: "#27ae60", superColor: "#219a52",
      hp: 2800, speed: 3.0,
      bulletDmg: 1200, bulletCount: 1, bulletSpread: 0.0, bulletSpeed: 11,
      reloadTime: 2.0, maxAmmo: 3,
      superCost: 8, superRadius: 200, superDmg: 1600,
      superDesc: "Spike zone",
      stats: { "❤️": "2800", "⚡": "3.0", "🔫": "1200" },
    },
  ];

  // -- ENEMY TYPES -----------------------------------------------
  const ENEMY_TYPES = [
    {
      id: "grunt", name: "Grunt", emoji: "👾", color: "#e74c3c",
      hp: 2200, speed: 1.8, dmg: 300, range: 180, fireCooldown: 1600,
      score: 10, bulletSpeed: 7,
    },
    {
      id: "brute", name: "Brute", emoji: "👹", color: "#c0392b",
      hp: 4500, speed: 1.4, dmg: 600, range: 140, fireCooldown: 2200,
      score: 25, bulletSpeed: 6,
    },
    {
      id: "sniper", name: "Sniper", emoji: "🎯", color: "#2980b9",
      hp: 1600, speed: 1.6, dmg: 900, range: 340, fireCooldown: 2500,
      score: 20, bulletSpeed: 13,
    },
    {
      id: "healer", name: "Healer", emoji: "💚", color: "#27ae60",
      hp: 2800, speed: 1.5, dmg: 200, range: 200, fireCooldown: 1800,
      score: 30, bulletSpeed: 7, heals: true,
    },
    {
      id: "boss", name: "BOSS", emoji: "💀", color: "#8e44ad",
      hp: 12000, speed: 1.2, dmg: 1200, range: 260, fireCooldown: 1200,
      score: 100, bulletSpeed: 9, isBoss: true,
    },
  ];

  // -- CONSTANTS --------------------------------------------------
  const MAP_W = 2400;
  const MAP_H = 1800;
  const TILE = 80;
  const GEM_HEAL = 600;

  // Color palette for tiles
  const TILE_GRASS = "#3d7a45";
  const TILE_GRASS2 = "#4a8f52";
  const TILE_WALL = "#6b5a4e";
  const TILE_WALL_L = "#8a7265"; // lighter face of wall

  // -- UTILITY ----------------------------------------------------
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const randI = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const norm = (dx, dy) => {
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  };

  // -- STATE ------------------------------------------------------
  let canvas;
  let ctx;
  let chosenBrawler = BRAWLERS[0];
  let state = "menu"; // menu | game | gameover

  let player;
  let enemies;
  let bullets;
  let gems;
  let particles;
  let shockwaves;
  let camera;
  let keys = {};
  let mouseWorld = { x: 0, y: 0 };
  let mouseCanvas = { x: 0, y: 0 };
  let score;
  let wave;
  let killsThisWave;
  let enemiesTotal;
  let waveClearing;
  let sessionStartedAt;
  let ammo;
  let lastReload;
  let superCharge;
  let raf;
  let tileMap; // 2-D array: 0=grass, 1=wall
  let walls; // Array of {x,y,w,h} world-space rects

  // -- MAP GENERATION --------------------------------------------
  function generateMap() {
    const cols = Math.ceil(MAP_W / TILE);
    const rows = Math.ceil(MAP_H / TILE);
    tileMap = [];
    for (let r = 0; r < rows; r++) {
      tileMap[r] = [];
      for (let c = 0; c < cols; c++) {
        // Edges are always walls
        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          tileMap[r][c] = 1;
        } else {
          tileMap[r][c] = 0;
        }
      }
    }

    // Scatter some wall clusters
    const clusters = 18;
    for (let i = 0; i < clusters; i++) {
      const cr = randI(2, rows - 3);
      const cc = randI(2, cols - 3);
      const sz = randI(1, 3);
      for (let dr = 0; dr < sz; dr++) {
        for (let dc = 0; dc < sz; dc++) {
          const rr = cr + dr;
          const rc = cc + dc;
          if (rr > 1 && rr < rows - 2 && rc > 1 && rc < cols - 2) {
            tileMap[rr][rc] = 1;
          }
        }
      }
    }

    // Clear a safe spawn zone for the player (center-ish)
    const midR = Math.floor(rows / 2);
    const midC = Math.floor(cols / 2);
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        tileMap[midR + dr][midC + dc] = 0;
      }
    }

    // Build wall rect list for collision
    walls = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (tileMap[r][c] === 1) {
          walls.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE });
        }
      }
    }
  }

  // -- COLLISION HELPERS -----------------------------------------
  function circleWall(cx, cy, r) {
    for (const w of walls) {
      const nearX = clamp(cx, w.x, w.x + w.w);
      const nearY = clamp(cy, w.y, w.y + w.h);
      if (Math.hypot(cx - nearX, cy - nearY) < r) return w;
    }
    return null;
  }

  function resolveWall(entity) {
    const r = entity.radius;
    for (let iter = 0; iter < 3; iter++) {
      const w = circleWall(entity.x, entity.y, r);
      if (!w) break;
      const overlapL = entity.x + r - w.x;
      const overlapR = w.x + w.w - (entity.x - r);
      const overlapT = entity.y + r - w.y;
      const overlapB = w.y + w.h - (entity.y - r);
      const min = Math.min(overlapL, overlapR, overlapT, overlapB);
      if (min === overlapL) entity.x -= overlapL;
      else if (min === overlapR) entity.x += overlapR;
      else if (min === overlapT) entity.y -= overlapT;
      else entity.y += overlapB;
    }
    // Keep inside world
    entity.x = clamp(entity.x, r, MAP_W - r);
    entity.y = clamp(entity.y, r, MAP_H - r);
  }

  // -- PARTICLE ---------------------------------------------------
  function spawnParticles(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = rand(speed * 0.4, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life,
        maxLife: life,
        size: rand(size * 0.5, size),
        color,
      });
    }
  }

  function spawnShockwave(x, y, maxR, color) {
    shockwaves.push({ x, y, r: 10, maxR, color, alpha: 0.7 });
  }

  // -- GEM --------------------------------------------------------
  function spawnGem(x, y) {
    gems.push({ x, y, r: 12, bob: Math.random() * Math.PI * 2 });
  }

  // -- INIT / RESET GAME -----------------------------------------
  function initGame() {
    generateMap();

    const midX = MAP_W / 2;
    const midY = MAP_H / 2;

    const b = chosenBrawler;

    player = {
      x: midX,
      y: midY,
      radius: 20,
      hp: b.hp,
      maxHp: b.hp,
      speed: b.speed,
      angle: 0,
      brawler: b,
      invincible: 0,
    };

    enemies = [];
    bullets = [];
    gems = [];
    particles = [];
    shockwaves = [];

    score = 0;
    wave = 0;
    killsThisWave = 0;
    enemiesTotal = 0;
    waveClearing = false;

    ammo = b.maxAmmo;
    lastReload = 0;
    superCharge = 0;
    sessionStartedAt = Date.now();

    camera = { x: midX - canvas.width / 2, y: midY - canvas.height / 2 };

    updateHUD();
    startWave();
  }

  // -- WAVE SYSTEM ------------------------------------------------
  function startWave() {
    wave++;
    killsThisWave = 0;
    waveClearing = false;

    const count = 3 + wave * 2;
    enemiesTotal = count;

    toast(`⚔️  WAVE ${wave}  -  ${count} enemies!`, "#2ec4b6");

    // Delay a bit before spawning
    setTimeout(() => spawnEnemyBatch(count), 1500);
  }

  function spawnEnemyBatch(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnEnemy(), i * 300);
    }
  }

  function spawnEnemy() {
    // Pick type based on wave
    let pool;
    if (wave <= 2) pool = [ENEMY_TYPES[0]];
    else if (wave <= 4) pool = [ENEMY_TYPES[0], ENEMY_TYPES[1], ENEMY_TYPES[2]];
    else if (wave <= 6) pool = ENEMY_TYPES.slice(0, 4);
    else pool = ENEMY_TYPES;

    // Every 5 waves spawn a boss
    if (wave % 5 === 0 && Math.random() < 0.3) pool = [ENEMY_TYPES[4]];

    const type = pool[randI(0, pool.length - 1)];

    // Spawn away from player
    let ex;
    let ey;
    const attempts = 50;
    for (let a = 0; a < attempts; a++) {
      ex = rand(TILE * 2, MAP_W - TILE * 2);
      ey = rand(TILE * 2, MAP_H - TILE * 2);
      if (dist({ x: ex, y: ey }, player) > 300 && !circleWall(ex, ey, 24)) break;
    }

    const hpScale = 1 + (wave - 1) * 0.12;
    enemies.push({
      x: ex,
      y: ey,
      radius: type.isBoss ? 36 : 22,
      hp: Math.round(type.hp * hpScale),
      maxHp: Math.round(type.hp * hpScale),
      type,
      angle: 0,
      fireCooldown: 0,
      stagger: 0,
      id: Math.random(),
    });
    spawnParticles(ex, ey, type.color, 8, 3, 0.5, 8);
  }

  // -- SHOOT ------------------------------------------------------
  let shootCooldown = 0;

  function tryShoot() {
    if (ammo <= 0) return;
    if (shootCooldown > 0) return;

    const b = chosenBrawler;
    ammo--;
    shootCooldown = 0.12; // small delay between burst

    const dx = mouseWorld.x - player.x;
    const dy = mouseWorld.y - player.y;
    const base = Math.atan2(dy, dx);

    for (let i = 0; i < b.bulletCount; i++) {
      const ang = base + rand(-b.bulletSpread, b.bulletSpread);
      bullets.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(ang) * b.bulletSpeed,
        vy: Math.sin(ang) * b.bulletSpeed,
        dmg: b.bulletDmg,
        radius: 6,
        owner: "player",
        color: b.color,
        life: 1.0,
      });
    }

    // Muzzle flash
    spawnParticles(player.x, player.y, b.color, 6, 5, 0.25, 5);

    // Reload logic
    if (ammo === 0) {
      lastReload = 0;
    }

    updateHUD();
  }

  function enemyShoot(enemy) {
    const t = enemy.type;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const ang = Math.atan2(dy, dx) + rand(-0.12, 0.12);
    bullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(ang) * t.bulletSpeed,
      vy: Math.sin(ang) * t.bulletSpeed,
      dmg: t.dmg,
      radius: 5,
      owner: "enemy",
      color: t.color,
      life: 1.2,
    });
  }

  // -- SUPER ------------------------------------------------------
  function activateSuper() {
    if (superCharge < chosenBrawler.superCost) return;
    superCharge = 0;

    const b = chosenBrawler;
    spawnShockwave(player.x, player.y, b.superRadius, b.superColor);
    spawnParticles(player.x, player.y, b.superColor, 30, 8, 0.7, 10);

    if (b.id === "poco") {
      // Heal
      player.hp = Math.min(player.maxHp, player.hp + 1200);
      toast("🎸 Poco heals +1200 HP!", "#9b59b6");
    } else if (b.id === "colt") {
      // Six rapid bullets
      for (let i = 0; i < 6; i++) {
        const dx = mouseWorld.x - player.x;
        const dy = mouseWorld.y - player.y;
        const ang = Math.atan2(dy, dx) + (i - 3) * 0.05;
        bullets.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(ang) * b.bulletSpeed * 1.3,
          vy: Math.sin(ang) * b.bulletSpeed * 1.3,
          dmg: b.superDmg,
          radius: 7,
          owner: "player",
          color: b.superColor,
          life: 1.5,
          super: true,
        });
      }
    } else {
      // Area damage
      for (const enemy of enemies) {
        if (dist(enemy, player) <= b.superRadius) {
          damageEnemy(enemy, b.superDmg);
        }
      }
    }

    updateHUD();
  }

  // -- DAMAGE -----------------------------------------------------
  function damageEnemy(enemy, dmg) {
    enemy.hp -= dmg;
    enemy.stagger = 0.2;
    spawnParticles(enemy.x, enemy.y, "#fff", 6, 4, 0.4, 5);

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }
  }

  function damagePlayer(dmg) {
    if (player.invincible > 0) return;
    player.hp -= dmg;
    player.invincible = 0.35;
    spawnParticles(player.x, player.y, "#e74c3c", 8, 5, 0.4, 7);
    if (player.hp <= 0) {
      player.hp = 0;
      endGame();
    }
    updateHUD();
  }

  function killEnemy(enemy) {
    spawnParticles(enemy.x, enemy.y, enemy.type.color, 20, 6, 0.8, 10);
    spawnShockwave(enemy.x, enemy.y, 80, enemy.type.color);

    // Chance to drop gem
    if (Math.random() < 0.45) spawnGem(enemy.x, enemy.y);

    score += enemy.type.score;
    killsThisWave++;
    superCharge = Math.min(chosenBrawler.superCost, superCharge + 1);

    // Remove
    const idx = enemies.indexOf(enemy);
    if (idx !== -1) enemies.splice(idx, 1);

    // Toast for boss
    if (enemy.type.isBoss) toast("💀 BOSS DEFEATED! +100 pts", "#ffd700");

    updateHUD();

    // Wave clear check
    if (!waveClearing && enemies.length === 0 && killsThisWave >= Math.min(enemiesTotal, 1)) {
      waveClearing = true;
      toast(`✅ Wave ${wave} cleared!`, "#27ae60");
      setTimeout(startWave, 2500);
    }
  }

  // -- UPDATE LOOP ------------------------------------------------
  let lastTime = 0;

  function gameLoop(ts) {
    if (state !== "game") return;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    update(dt);
    render();

    raf = requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
    updateShockwaves(dt);
    updateGems(dt);
    updateAmmoReload(dt);
    updateCamera();
    updateHUD();
  }

  function updatePlayer(dt) {
    const b = chosenBrawler;
    let dx = 0;
    let dy = 0;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;

    if (dx || dy) {
      const n = norm(dx, dy);
      player.x += n.x * b.speed * 60 * dt;
      player.y += n.y * b.speed * 60 * dt;
      resolveWall(player);
    }

    player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
    if (player.invincible > 0) player.invincible -= dt;
    if (shootCooldown > 0) shootCooldown -= dt;
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      const t = enemy.type;
      const d = dist(enemy, player);

      if (enemy.stagger > 0) {
        enemy.stagger -= dt;
        continue;
      }

      // Move toward player if out of range, move away if too close
      const tooClose = d < 80;
      if (!tooClose) {
        const n = norm(player.x - enemy.x, player.y - enemy.y);
        enemy.x += n.x * t.speed * 60 * dt;
        enemy.y += n.y * t.speed * 60 * dt;
        resolveWall(enemy);
      }

      enemy.angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);

      // Healer also heals nearby enemies
      if (t.heals) {
        for (const other of enemies) {
          if (other !== enemy && dist(other, enemy) < 150) {
            other.hp = Math.min(other.maxHp, other.hp + 40 * dt);
          }
        }
      }

      // Shoot
      enemy.fireCooldown -= dt * 1000;
      if (enemy.fireCooldown <= 0 && d <= t.range) {
        enemyShoot(enemy);
        enemy.fireCooldown = t.fireCooldown;
      }
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * 60 * dt;
      b.y += b.vy * 60 * dt;
      b.life -= dt;

      // Wall collision
      if (circleWall(b.x, b.y, b.radius)) {
        spawnParticles(b.x, b.y, b.color, 4, 3, 0.25, 4);
        bullets.splice(i, 1);
        continue;
      }

      // Out of bounds
      if (b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H || b.life <= 0) {
        bullets.splice(i, 1);
        continue;
      }

      // Hit detection
      if (b.owner === "player") {
        for (const enemy of enemies) {
          if (dist(b, enemy) < b.radius + enemy.radius) {
            damageEnemy(enemy, b.dmg);
            bullets.splice(i, 1);
            break;
          }
        }
      } else if (dist(b, player) < b.radius + player.radius) {
        damagePlayer(b.dmg);
        bullets.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.r += s.maxR * dt * 3;
      s.alpha -= dt * 2.2;
      if (s.alpha <= 0 || s.r >= s.maxR) shockwaves.splice(i, 1);
    }
  }

  function updateGems(dt) {
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.bob += dt * 3;
      if (dist(g, player) < player.radius + g.r + 5) {
        player.hp = Math.min(player.maxHp, player.hp + GEM_HEAL);
        spawnParticles(g.x, g.y, "#2ecc71", 8, 5, 0.5, 7);
        gems.splice(i, 1);
        updateHUD();
      }
    }
  }

  function updateAmmoReload(dt) {
    const b = chosenBrawler;
    if (ammo < b.maxAmmo) {
      lastReload += dt;
      if (lastReload >= b.reloadTime) {
        ammo++;
        lastReload = 0;
        updateHUD();
      }
    }
  }

  function updateCamera() {
    const tx = player.x - canvas.width / 2;
    const ty = player.y - canvas.height / 2;
    const tx2 = clamp(tx, 0, MAP_W - canvas.width);
    const ty2 = clamp(ty, 0, MAP_H - canvas.height);
    camera.x += (tx2 - camera.x) * 0.12;
    camera.y += (ty2 - camera.y) * 0.12;
  }

  // -- RENDER -----------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate((-camera.x) | 0, (-camera.y) | 0);

    drawMap();
    drawGems();
    drawShockwaves();
    drawBullets();
    drawEnemies();
    drawPlayer();
    drawParticles();

    ctx.restore();
  }

  function drawMap() {
    const cols = Math.ceil(MAP_W / TILE);
    const rows = Math.ceil(MAP_H / TILE);

    // Only draw visible tiles
    const startC = Math.max(0, Math.floor(camera.x / TILE) - 1);
    const endC = Math.min(cols - 1, Math.ceil((camera.x + canvas.width) / TILE) + 1);
    const startR = Math.max(0, Math.floor(camera.y / TILE) - 1);
    const endR = Math.min(rows - 1, Math.ceil((camera.y + canvas.height) / TILE) + 1);

    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const tx = c * TILE;
        const ty = r * TILE;
        if (tileMap[r][c] === 1) {
          ctx.fillStyle = TILE_WALL;
          ctx.fillRect(tx, ty, TILE, TILE);
          // simple depth shading
          ctx.fillStyle = TILE_WALL_L;
          ctx.fillRect(tx, ty, TILE, 10);
          ctx.fillRect(tx, ty, 10, TILE);
        } else {
          const shade = (r + c) % 2 === 0 ? TILE_GRASS : TILE_GRASS2;
          ctx.fillStyle = shade;
          ctx.fillRect(tx, ty, TILE, TILE);
        }
      }
    }
  }

  function drawGems() {
    for (const g of gems) {
      const bobY = Math.sin(g.bob) * 4;
      ctx.save();
      ctx.translate(g.x, g.y + bobY);
      ctx.fillStyle = "#2ecc71";
      ctx.shadowColor = "#2ecc71";
      ctx.shadowBlur = 12;
      ctx.font = `${g.r * 2}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💎", 0, 0);
      ctx.restore();
    }
  }

  function drawShockwaves() {
    for (const s of shockwaves) {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      const t = enemy.type;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // Flash white when staggered
      const staggerFlash = enemy.stagger > 0 && Math.floor(enemy.stagger * 20) % 2 === 0;

      // Body
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = staggerFlash ? "#fff" : t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.fill();

      // Emoji
      ctx.shadowBlur = 0;
      ctx.font = `${enemy.radius * 1.3}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.emoji, 0, 1);

      // Aim indicator
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(enemy.angle) * enemy.radius * 1.4, Math.sin(enemy.angle) * enemy.radius * 1.4);
      ctx.stroke();

      ctx.restore();

      // Health bar
      drawHealthBar(enemy.x, enemy.y - enemy.radius - 12, enemy.hp / enemy.maxHp, t.isBoss ? 60 : 40, t.color);

      // Boss label
      if (t.isBoss) {
        ctx.save();
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd700";
        ctx.fillText("👑 BOSS", enemy.x, enemy.y - enemy.radius - 22);
        ctx.restore();
      }
    }
  }

  function drawPlayer() {
    const b = chosenBrawler;
    ctx.save();
    ctx.translate(player.x, player.y);

    // Invincibility flash
    if (player.invincible > 0 && Math.floor(player.invincible * 18) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 8, player.radius, player.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 16;
    ctx.fill();

    // Outline
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Emoji
    ctx.shadowBlur = 0;
    ctx.font = `${player.radius * 1.35}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.emoji, 0, 1);

    // Aim line
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(Math.cos(player.angle) * player.radius, Math.sin(player.angle) * player.radius);
    ctx.lineTo(Math.cos(player.angle) * player.radius * 3.5, Math.sin(player.angle) * player.radius * 3.5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  function drawHealthBar(x, y, pct, width, color) {
    const h = 6;
    const hw = width / 2;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.beginPath();
    ctx.roundRect(x - hw, y, width, h, 3);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - hw, y, Math.max(0, width * pct), h, 3);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // -- HUD --------------------------------------------------------
  function updateHUD() {
    if (state !== "game") return;
    const b = chosenBrawler;

    document.getElementById("hud-name").textContent = b.name.toUpperCase();

    const hpPct = Math.max(0, player.hp / player.maxHp);
    const bar = document.getElementById("hp-bar");
    bar.style.width = `${hpPct * 100}%`;
    bar.style.background = hpPct > 0.5
      ? "linear-gradient(90deg,#27ae60,#2ecc71)"
      : hpPct > 0.25
        ? "linear-gradient(90deg,#f39c12,#f1c40f)"
        : "linear-gradient(90deg,#e74c3c,#c0392b)";
    document.getElementById("hp-text").textContent = `${Math.ceil(player.hp)} / ${b.hp}`;

    document.getElementById("wave-num").textContent = wave;
    document.getElementById("score-num").textContent = score;

    const sPct = superCharge / b.superCost;
    document.getElementById("super-bar").style.width = `${sPct * 100}%`;
    document.getElementById("super-text").textContent = `${superCharge}/${b.superCost}`;

    // Ammo dots
    const ammoDiv = document.getElementById("ammo-dots");
    ammoDiv.innerHTML = "";
    for (let i = 0; i < b.maxAmmo; i++) {
      const dot = document.createElement("div");
      dot.className = `ammo-dot${i < ammo ? "" : " empty"}`;
      ammoDiv.appendChild(dot);
    }
  }

  // -- TOAST ------------------------------------------------------
  let toastContainer;
  function toast(msg, color = "#fff") {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      document.body.appendChild(toastContainer);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    el.style.borderLeft = `4px solid ${color}`;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .4s";
      setTimeout(() => el.remove(), 420);
    }, 2000);
  }

  // -- END GAME ---------------------------------------------------
  function endGame() {
    state = "gameover";
    cancelAnimationFrame(raf);

    const icon = document.getElementById("gameover-icon");
    const title = document.getElementById("gameover-title");
    const stats = document.getElementById("gameover-stats");

    icon.textContent = "💀";
    title.textContent = "GAME OVER";

    stats.innerHTML = `
      <div class="stat-row"><span>Brawler</span><span>${chosenBrawler.emoji} ${chosenBrawler.name}</span></div>
      <div class="stat-row"><span>Score</span><span>${score}</span></div>
      <div class="stat-row"><span>Waves Survived</span><span>${wave}</span></div>
      <div class="stat-row"><span>Enemies Defeated</span><span>${killsThisWave + (wave - 1) * 3}</span></div>
    `;

    const durationSeconds = Math.max(1, Math.round((Date.now() - sessionStartedAt) / 1000));
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameSlug: "game_z",
        waveReached: wave,
        kills: killsThisWave + (wave - 1) * 3,
        durationSeconds,
      }),
    });

    showScreen("gameover-screen");
  }

  // -- SCREEN SWITCHING ------------------------------------------
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  // -- BRAWLER CARDS ---------------------------------------------
  function buildBrawlerCards() {
    const container = document.getElementById("brawler-cards");
    container.innerHTML = "";
    BRAWLERS.forEach((b, idx) => {
      const card = document.createElement("div");
      card.className = `brawler-card${idx === 0 ? " chosen" : ""}`;
      card.dataset.id = b.id;
      card.innerHTML = `
        <div class="card-emoji">${b.emoji}</div>
        <div class="card-name">${b.name}</div>
        <div class="card-role">${b.role}</div>
        <div class="card-stats">
          ${Object.entries(b.stats).map(([k, v]) =>
            `<div class="stat-pill">${k}<b>${v}</b></div>`).join("")}
        </div>
      `;
      card.addEventListener("click", () => {
        document.querySelectorAll(".brawler-card").forEach((c) => c.classList.remove("chosen"));
        card.classList.add("chosen");
        chosenBrawler = b;
      });
      container.appendChild(card);
    });
  }

  // -- INPUT ------------------------------------------------------
  function setupInput() {
    document.addEventListener("keydown", (e) => {
      keys[e.key] = true;
      if (state === "game") {
        if (e.key === " " || e.key === "q" || e.key === "Q") {
          e.preventDefault();
          activateSuper();
        }
      }
    });
    document.addEventListener("keyup", (e) => {
      keys[e.key] = false;
    });

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseCanvas.x = e.clientX - rect.left;
      mouseCanvas.y = e.clientY - rect.top;
      mouseWorld.x = mouseCanvas.x + camera.x;
      mouseWorld.y = mouseCanvas.y + camera.y;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0 && state === "game") tryShoot();
    });

    // Auto-repeat shoot while held
    let shootInterval = null;
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || state !== "game") return;
      clearInterval(shootInterval);
      shootInterval = setInterval(() => {
        if (state === "game") tryShoot();
      }, 140);
    });
    canvas.addEventListener("mouseup", () => clearInterval(shootInterval));
    canvas.addEventListener("mouseleave", () => clearInterval(shootInterval));
  }

  // -- RESIZE -----------------------------------------------------
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // -- BOOT -------------------------------------------------------
  function boot() {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    buildBrawlerCards();
    setupInput();

    // Menu buttons
    document.getElementById("btn-play").addEventListener("click", () => {
      showScreen("game-screen");
      state = "game";
      initGame();
      lastTime = performance.now();
      raf = requestAnimationFrame(gameLoop);
    });

    document.getElementById("btn-how").addEventListener("click", () => {
      document.getElementById("how-to-play").classList.toggle("hidden");
    });

    document.getElementById("btn-restart").addEventListener("click", () => {
      showScreen("game-screen");
      state = "game";
      initGame();
      lastTime = performance.now();
      raf = requestAnimationFrame(gameLoop);
    });

    document.getElementById("btn-menu").addEventListener("click", () => {
      state = "menu";
      cancelAnimationFrame(raf);
      showScreen("menu-screen");
    });
  }

  window.addEventListener("DOMContentLoaded", boot);
})();
