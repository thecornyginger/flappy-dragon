const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Game Constants ---
const GRAVITY = 0.1; // FALL SPEED
const LIFT = -3;    // FLAPPING
const BEHOLDER_SIZE = 50; // Diameter
const OBSTACLE_WIDTH = 60;
const OBSTACLE_GAP = 150; // Vertical space between stalactite and stalagmite
const OBSTACLE_SPEED = 1.5;
const OBSTACLE_SPAWN_DISTANCE = 200; // Horizontal distance between obstacle pairs

// --- Image Loading Management ---
let imagesLoaded = 0;
// Adjust totalImages if you're not using all 4 (e.g., no background)
const totalImages = 4; // Beholder, Stalactite, Stalagmite, Background
let allImagesLoaded = false;

function imageLoaded() {
    imagesLoaded++;
    console.log(`Loaded image ${imagesLoaded}/${totalImages}`); // Optional: for debugging
    if (imagesLoaded === totalImages) {
        allImagesLoaded = true;
        console.log("All images loaded, starting game loop.");
        // !! Important: Start the game loop ONLY when all images are loaded !!
        gameLoop();
    }
}

// --- Game Variables ---
let beholderY;
let beholderVelY;
let score;
let obstacles; // Array to hold obstacle objects
let frameCount;
let gameState; // 'start', 'playing', 'gameOver'

// --- Asset Placeholders (Now Loading Actual Images) ---
let beholderImg = new Image();
let stalactiteImg = new Image();
let stalagmiteImg = new Image();
let backgroundImg = new Image(); // Make sure this line exists if using background

// Set the source paths AFTER creating the Image objects
beholderImg.src = 'images/beholder.png';
stalactiteImg.src = 'images/stalactite.png';
stalagmiteImg.src = 'images/stalagmite.png';
backgroundImg.src = 'images/background.png'; // Path to your background

beholderImg.onload = imageLoaded;
stalactiteImg.onload = imageLoaded;
stalagmiteImg.onload = imageLoaded;
backgroundImg.onload = imageLoaded; // Add this for the background too

// --- Game Initialization ---
function resetGame() {
    beholderY = canvas.height / 2;
    beholderVelY = 0;
    score = 0;
    obstacles = [];
    frameCount = 0;
    gameState = 'start';
    // Spawn initial obstacles off-screen
    spawnInitialObstacles();
}

function spawnInitialObstacles() {
     // Start first obstacle further out
    addObstacle(canvas.width + 100);
    addObstacle(canvas.width + 100 + OBSTACLE_SPAWN_DISTANCE);
    addObstacle(canvas.width + 100 + 2 * OBSTACLE_SPAWN_DISTANCE);
}

// --- Game Objects ---
function Beholder() {
    // --- Drawing ---
    /* // Comment out or delete placeholder:
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.arc(canvas.width / 3, beholderY, BEHOLDER_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(canvas.width / 3 + 5, beholderY, BEHOLDER_SIZE / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(canvas.width / 3 + 5, beholderY, BEHOLDER_SIZE / 8, 0, Math.PI * 2);
    ctx.fill();
    */
    ctx.drawImage(beholderImg, canvas.width / 3 - BEHOLDER_SIZE / 2, beholderY - BEHOLDER_SIZE / 2, BEHOLDER_SIZE, BEHOLDER_SIZE);

    // --- Updating ---
    if (gameState === 'playing') {
        beholderVelY += GRAVITY;
        beholderY += beholderVelY;
    }

    // Prevent moving during start/game over (but still draw)
    // Apply bobbing effect only during 'start' state
    if (gameState === 'start') {
        // Gentle bobbing effect on start screen
         beholderY = canvas.height / 2 + Math.sin(frameCount * 0.1) * 5;
         // Ensure velocity stays zero during start screen bobbing
         beholderVelY = 0;
    }
} // <------------------------------------- THIS IS THE CORRECT SINGLE ENDING BRACE

function Obstacle(x, gapY) {
    // --- Properties (Must be inside the constructor) ---
    this.x = x;
    this.gapY = gapY; // Center Y position of the gap
    this.scored = false;

    // Calculate top (stalactite) and bottom (stalagmite) positions
    this.topHeight = this.gapY - OBSTACLE_GAP / 2;
    this.bottomY = this.gapY + OBSTACLE_GAP / 2;
    this.bottomHeight = canvas.height - this.bottomY;

    // --- Methods (Must be inside the constructor) ---
    this.draw = function() {
        /* // Placeholder comments can remain or be removed
        ctx.fillStyle = '#6b4d3a';
        ctx.fillRect(this.x, 0, OBSTACLE_WIDTH, this.topHeight);
        ctx.fillRect(this.x, this.bottomY, OBSTACLE_WIDTH, this.bottomHeight);
        */

        // Draw Obstacle Images
        // Make sure stalactiteImg and stalagmiteImg are loaded correctly
        if (stalactiteImg.complete && stalactiteImg.naturalHeight !== 0) {
             ctx.drawImage(stalactiteImg, this.x, 0, OBSTACLE_WIDTH, this.topHeight);
        }
        if (stalagmiteImg.complete && stalagmiteImg.naturalHeight !== 0) {
            ctx.drawImage(stalagmiteImg, this.x, this.bottomY, OBSTACLE_WIDTH, this.bottomHeight);
        }
    }; // Semicolon optional but fine

    this.update = function() {
        if (gameState === 'playing') {
            this.x -= OBSTACLE_SPEED;
        }
    }; // Semicolon optional but fine

} // <--- THIS is the single, correct closing brace for the constructor function

function addObstacle(xPos) {
    // Calculate a random gap position, ensuring it's not too close to the top/bottom edges
    const minGapY = OBSTACLE_GAP / 2 + 30; // Min distance from top
    const maxGapY = canvas.height - OBSTACLE_GAP / 2 - 30; // Min distance from bottom
    const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
    obstacles.push(new Obstacle(xPos, gapY));
}

function manageObstacles() {
    // Update and draw existing obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        obstacles[i].draw();

        // Check for scoring
        const beholderX = canvas.width / 3;
        if (!obstacles[i].scored && obstacles[i].x + OBSTACLE_WIDTH < beholderX) {
             score++;
             obstacles[i].scored = true;
             // Maybe play a sound here later
        }

        // Remove obstacles that are off-screen left
        if (obstacles[i].x + OBSTACLE_WIDTH < 0) {
            obstacles.splice(i, 1);
        }
    }

     // Add new obstacles when the last one is far enough in
     if (gameState === 'playing') {
         const lastObstacle = obstacles[obstacles.length - 1];
         if(canvas.width - lastObstacle.x >= OBSTACLE_SPAWN_DISTANCE) {
             addObstacle(lastObstacle.x + OBSTACLE_SPAWN_DISTANCE);
         }
     }
}

// --- Collision Detection ---
function checkCollisions() {
    const beholderX = canvas.width / 3;
    const beholderRadius = BEHOLDER_SIZE / 2;

    // 1. Ground/Ceiling Collision
    if (beholderY + beholderRadius > canvas.height || beholderY - beholderRadius < 0) {
        return true; // Hit ground or ceiling
    }

    // 2. Obstacle Collision
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];

        // Check if Beholder's X position overlaps with the obstacle's X span
        if (beholderX + beholderRadius > obs.x && beholderX - beholderRadius < obs.x + OBSTACLE_WIDTH) {
            // Check if Beholder's Y position hits the top or bottom part
            if (beholderY - beholderRadius < obs.topHeight || beholderY + beholderRadius > obs.bottomY) {
                return true; // Collision with an obstacle
            }
        }
    }

    return false; // No collision
}

function drawBackground() {
    /* // Original placeholder comments can stay or go
    ctx.fillStyle = '#1a111e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    */

    // --- Draw Static Background Image ---
    // Remove the calculation for bgX:
    // let bgX = -(frameCount * 0.5 % backgroundImg.width); // DELETE or COMMENT OUT this line

    // Draw the background image just once, starting at the top-left corner (0, 0).
    // Use the image's natural width and the canvas's height.
    // Make sure the background image is loaded before drawing
    if (backgroundImg.complete && backgroundImg.naturalHeight !== 0) {
         ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
         // Note: This stretches/shrinks the image width to fit the canvas width (400px).
         // If you want to preserve the image's aspect ratio or tile it,
         // the drawing logic would need to be more complex.
    } else {
         // Optional fallback: Draw solid color if image isn't ready yet
         ctx.fillStyle = '#1a111e'; // Match CSS background
         ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Remove the second drawImage call which was for seamless scrolling:
    // ctx.drawImage(backgroundImg, bgX + backgroundImg.width, 0, backgroundImg.width, canvas.height); // DELETE or COMMENT OUT this line
}

function drawScore() {
    ctx.fillStyle = '#e0e0e0';
    ctx.font = "24px 'Press Start 2P'";
    ctx.textAlign = 'center';
    ctx.fillText(score, canvas.width / 2, 50);
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent overlay
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = "14px 'Press Start 2P'";
    ctx.fillText("Click, Tap, or Press Spacebar to start!", canvas.width / 2, canvas.height / 2 + 20);
}

function drawGameOverScreen() {
     ctx.fillStyle = 'rgba(80, 0, 0, 0.7)'; // Semi-transparent dark red overlay
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffcc00';
    ctx.font = "32px 'Press Start 2P'";
    ctx.textAlign = 'center';
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 60);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2);

    ctx.font = "14px 'Press Start 2P'";
    ctx.fillText("Click or Space to Retry", canvas.width / 2, canvas.height / 2 + 50);
}


// --- Input Handling ---
function handleInput() {
     if (gameState === 'start') {
         gameState = 'playing';
         beholderVelY = LIFT; // Give initial flap
     } else if (gameState === 'playing') {
         beholderVelY = LIFT; // Flap
     } else if (gameState === 'gameOver') {
         // Only reset if enough time has passed to prevent accidental instant restart
         if (frameCount > 15) { // Small delay
            resetGame();
         }
     }
}

document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') {
        // Prevent spacebar from scrolling the page
        e.preventDefault();
        handleInput();
    }
});

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (e) => {
     e.preventDefault(); // Prevent touch events from causing scrolling/zooming
     handleInput();
});


// --- Game Loop ---
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    drawBackground();

    // Draw & Update Obstacles
    manageObstacles();

    // Draw & Update Beholder
    Beholder(); // Draws and updates position/velocity

    // Draw Score
    drawScore();

    // Handle Game States
    if (gameState === 'playing') {
        // Check for collisions AFTER drawing everything
        if (checkCollisions()) {
            gameState = 'gameOver';
            frameCount = 0; // Reset framecount for game over delay logic
             // Maybe play a crash sound
        }
        frameCount++;
    } else if (gameState === 'start') {
        drawStartScreen();
         frameCount++; // For bobbing animation
    } else if (gameState === 'gameOver') {
        drawGameOverScreen();
        frameCount++; // For restart delay logic
    }


    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Start the Game ---
resetGame(); // Initialize variables

// !! DO NOT CALL gameLoop() here anymore !!
// gameLoop(); // Remove or comment out this line