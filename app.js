// @ts

// ==========================================
// Core Game Engine
// ==========================================
class EventEmitter {
    constructor() { this.listeners = {}; }
    on(message, listener) {
        if (!this.listeners[message]) this.listeners[message] = [];
        this.listeners[message].push(listener);
    }
    emit(message, payload = null) {
        if (this.listeners[message]) {
            this.listeners[message].forEach((l) => l(message, payload));
        }
    }
}

class GameObject {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.dead = false;
        this.type = '';
        this.width = 0;
        this.height = 0;
        this.img = undefined;
        this.fallbackColor = "white"; 
    }

    // New update method to be overridden by subclasses
    update() {}

    draw(ctx) {
        if (this.dead) return;
        if (this.img) {
            ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.fallbackColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    rectFromGameObject() {
        return {
            top: this.y,
            left: this.x,
            bottom: this.y + this.height,
            right: this.x + this.width,
        };
    }
}

class Hero extends GameObject {
    constructor(x, y) {
        super(x, y);
        this.width = 99;
        this.height = 75;
        this.type = 'Hero';
        this.fallbackColor = 'cyan';
        this.lastFireTime = 0; // Performance Fix: Track time instead of interval
        this.life = 3;
        this.points = 0;
    }
    fire() {
        gameObjects.push(new Laser(this.x + 45, this.y - 10));
        this.lastFireTime = Date.now();
    }
    canFire() { 
        // 400ms cooldown using precise timestamps
        return Date.now() - this.lastFireTime >= 400; 
    }
    decrementLife() {
        this.life--;
        if (this.life <= 0) this.dead = true;
    }
    incrementPoints() { this.points += 100; }
}

class Enemy extends GameObject {
    constructor(x, y) {
        super(x, y);
        this.width = 98;
        this.height = 50;
        this.type = 'Enemy';
        this.fallbackColor = '#39FF14'; 
    }
    update() {
        // Performance Fix: Move downward based on frame paint
        this.y += 1.5; 
        
        // Wrapping Logic: If off the bottom, jump to the top
        if (this.y > canvas.height) {
            this.y = -this.height;
        }
    }
}

class Laser extends GameObject {
    constructor(x, y) {
        super(x, y);
        this.width = 9;
        this.height = 33;
        this.type = 'Laser';
        this.fallbackColor = 'red';
        this.img = laserImg;
    }
    update() {
        // Performance Fix: Move upward smoothly
        this.y -= 12; 
        if (this.y < 0) this.dead = true;
    }
}

// ==========================================
// Game State & Constants
// ==========================================
const Messages = {
    KEY_EVENT_UP: 'KEY_EVENT_UP',
    KEY_EVENT_DOWN: 'KEY_EVENT_DOWN',
    KEY_EVENT_LEFT: 'KEY_EVENT_LEFT',
    KEY_EVENT_RIGHT: 'KEY_EVENT_RIGHT',
    KEY_EVENT_SPACE: 'KEY_EVENT_SPACE',
    KEY_EVENT_R: 'KEY_EVENT_R', // Swapped Enter for R
    COLLISION_ENEMY_LASER: 'COLLISION_ENEMY_LASER',
    COLLISION_ENEMY_HERO: 'COLLISION_ENEMY_HERO',
    GAME_END_LOSS: 'GAME_END_LOSS',
    GAME_END_WIN: 'GAME_END_WIN',
};

let heroImg, enemyImg, laserImg, lifeImg, canvas, ctx;
let gameObjects = [];
let stars = [];
let hero;
let eventEmitter = new EventEmitter();

let isGameOver = false;
let isWin = false;

// ==========================================
// Helper Functions
// ==========================================
function loadTexture(path) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = path;
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Could not load ${path} - Check your assets folder.`);
            resolve(null);
        };
    });
}

function intersectRect(r1, r2) {
    return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
}

// ==========================================
// Initialization & Reset
// ==========================================
function initStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * canvas.width, // Updated to use dynamic canvas width
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 2 + 0.5
        });
    }
}

function createEnemies() {
    const MONSTER_TOTAL = 6; // Increased enemy count to fit wider screen
    const MONSTER_WIDTH = MONSTER_TOTAL * 98;
    const START_X = (canvas.width - MONSTER_WIDTH) / 2;
    const STOP_X = START_X + MONSTER_WIDTH;

    for (let x = START_X; x < STOP_X; x += 98) {
        for (let y = 0; y < 50 * 4; y += 50) {
            const enemy = new Enemy(x, y);
            enemy.img = enemyImg;
            gameObjects.push(enemy);
        }
    }
}

function createHero() {
    hero = new Hero(canvas.width / 2 - 45, canvas.height - canvas.height / 4);
    hero.img = heroImg;
    gameObjects.push(hero);
}

function resetGame() {
    if (isGameOver || isWin) {
        isGameOver = false;
        isWin = false;
        gameObjects = [];
        createEnemies();
        createHero();
    }
}

function setupGameLogic() {
    eventEmitter.on(Messages.KEY_EVENT_UP, () => { if (!hero.dead && !isWin && hero.y > 0) hero.y -= 20; });
    eventEmitter.on(Messages.KEY_EVENT_DOWN, () => { if (!hero.dead && !isWin && hero.y < canvas.height - hero.height) hero.y += 20; });
    eventEmitter.on(Messages.KEY_EVENT_LEFT, () => { if (!hero.dead && !isWin && hero.x > 0) hero.x -= 20; });
    eventEmitter.on(Messages.KEY_EVENT_RIGHT, () => { if (!hero.dead && !isWin && hero.x < canvas.width - hero.width) hero.x += 20; });

    eventEmitter.on(Messages.KEY_EVENT_SPACE, () => {
        if (!hero.dead && !isWin && hero.canFire()) hero.fire();
    });

    eventEmitter.on(Messages.KEY_EVENT_R, () => resetGame()); // R Key mapped to reset

    eventEmitter.on(Messages.COLLISION_ENEMY_LASER, (_, { first, second }) => {
        first.dead = true;
        second.dead = true;
        hero.incrementPoints();
    });

    eventEmitter.on(Messages.COLLISION_ENEMY_HERO, (_, { enemy }) => {
        enemy.dead = true;
        hero.decrementLife();
        if (hero.dead) eventEmitter.emit(Messages.GAME_END_LOSS);
    });

    eventEmitter.on(Messages.GAME_END_LOSS, () => isGameOver = true);
    eventEmitter.on(Messages.GAME_END_WIN, () => isWin = true);
}

// ==========================================
// Input Handling
// ==========================================
window.addEventListener('keydown', (e) => {
    switch (e.keyCode) {
        case 37: case 39: case 38: case 40: case 32:
            e.preventDefault();
            break;
    }
});

window.addEventListener('keyup', (evt) => {
    if (evt.key === 'ArrowUp') eventEmitter.emit(Messages.KEY_EVENT_UP);
    else if (evt.key === 'ArrowDown') eventEmitter.emit(Messages.KEY_EVENT_DOWN);
    else if (evt.key === 'ArrowLeft') eventEmitter.emit(Messages.KEY_EVENT_LEFT);
    else if (evt.key === 'ArrowRight') eventEmitter.emit(Messages.KEY_EVENT_RIGHT);
    else if (evt.code === 'Space') eventEmitter.emit(Messages.KEY_EVENT_SPACE);
    else if (evt.key.toLowerCase() === 'r') eventEmitter.emit(Messages.KEY_EVENT_R); // Detect 'R' or 'r'
});

// ==========================================
// Rendering & Game Loop
// ==========================================
function updateGameObjects() {
    const enemies = gameObjects.filter((go) => go.type === 'Enemy');
    const lasers = gameObjects.filter((go) => go.type === 'Laser');

    if (enemies.length === 0 && !isWin && !isGameOver) {
        eventEmitter.emit(Messages.GAME_END_WIN);
        return; 
    }

    enemies.forEach((enemy) => {
        if (intersectRect(hero.rectFromGameObject(), enemy.rectFromGameObject())) {
            eventEmitter.emit(Messages.COLLISION_ENEMY_HERO, { enemy });
        }
    });

    lasers.forEach((l) => {
        enemies.forEach((m) => {
            if (intersectRect(l.rectFromGameObject(), m.rectFromGameObject())) {
                eventEmitter.emit(Messages.COLLISION_ENEMY_LASER, { first: l, second: m });
            }
        });
    });

    gameObjects = gameObjects.filter((go) => !go.dead);
}

function drawBackground(ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

function drawHeartFallback(ctx, x, y, width, height) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 5);
    ctx.bezierCurveTo(width / 2, height / 5, width - width / 5, 0, width, height / 2.5);
    ctx.bezierCurveTo(width, height * 0.8, width / 2, height, width / 2, height);
    ctx.bezierCurveTo(width / 2, height, 0, height * 0.8, 0, height / 2.5);
    ctx.bezierCurveTo(0, 0, width / 2, height / 5, width / 2, height / 5);
    ctx.fillStyle = "red";
    ctx.fill();
    ctx.restore();
}

function drawUI(ctx) {
    ctx.font = 'bold 24px Courier New';
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + hero.points, 20, canvas.height - 20);

    for (let i = 0; i < hero.life; i++) {
        const xPos = canvas.width - 45 - (i * 40);
        const yPos = canvas.height - 45;
        if (lifeImg) {
            ctx.drawImage(lifeImg, xPos, yPos, 30, 30);
        } else {
            drawHeartFallback(ctx, xPos, yPos, 30, 30);
        }
    }

    ctx.textAlign = 'center';
    if (isGameOver) {
        ctx.fillStyle = 'red';
        ctx.font = 'bold 60px Courier New';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Courier New';
        ctx.fillStyle = 'white';
        ctx.fillText("Press 'R' to Restart", canvas.width / 2, canvas.height / 2 + 40);
    } else if (isWin) {
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 60px Courier New';
        ctx.fillText('VICTORY!', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Courier New';
        ctx.fillStyle = 'white';
        ctx.fillText("Press 'R' to Play Again", canvas.width / 2, canvas.height / 2 + 40);
    }
}

// Performance Fix: Replaced setInterval with requestAnimationFrame
function gameLoop() {
    drawBackground(ctx);
    
    if (!isGameOver && !isWin) {
        // Run update logic for movement
        gameObjects.forEach((go) => go.update());
        // Run collision detection
        updateGameObjects();
    }
    
    gameObjects.forEach((go) => go.draw(ctx));
    drawUI(ctx);
    
    requestAnimationFrame(gameLoop);
}

// ==========================================
// Entry Point
// ==========================================
window.onload = async () => {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    heroImg = await loadTexture('assets/player.png');
    enemyImg = await loadTexture('assets/enemyShip.png');
    laserImg = await loadTexture('assets/laserRed.png');
    lifeImg = await loadTexture('assets/life.png');

    initStars(200); // Added a few more stars for the wider sky
    setupGameLogic();
    createEnemies();
    createHero();

    // Start the high-performance game loop
    requestAnimationFrame(gameLoop);
};