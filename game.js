// Declare canvas and ctx in the global scope
let canvas;
let ctx;
let isWindowLoaded = false; // <-- Add this flag

// --- Game Constants ---
const GRAVITY = 800;  // Pixels per second per second (adjust significantly upwards)
const LIFT = -250;     // Pixels per second (instantaneous velocity change, adjust magnitude)
const BEHOLDER_SIZE = 50;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_COLLISION_WIDTH_FACTOR = 0.6; // Keep this from previous step
const OBSTACLE_GAP = 150;
const OBSTACLE_SPEED = 125; // Pixels per second (adjust)
const OBSTACLE_SPAWN_DISTANCE = 200;
const ANIMATION_THROTTLE = 20; // Keep animation frame-based for now, or adjust later

// --- Image Loading Management ---
let imagesLoaded = 0;
// !! IMPORTANT: Update totalImages to 6 !!
const totalImages = 6; // Beholder(mid), DownFlap, UpFlap, Stalactite, Stalagmite, Background
let allImagesLoaded = false;

function imageLoaded() {
    imagesLoaded++;
    console.log(`Image ${imagesLoaded}/${totalImages} loaded.`); // Add for debugging
    // No need to check totalImages here, startGameIfReady does it
    startGameIfReady(); // Check if the window is also loaded
}

// --- Game Variables ---
let beholderY;
let beholderVelY;
let score;
let obstacles;
let frameCount;
let gameState;
let animationFrameIndex = 0; // Start at the first frame (down-flap)
let beholderFrames = []; // Array to hold the animation image objects
let lastTime = 0; // <<< ADD: Timestamp of the last frame
let velocityY = 0; // <<< ADD: Velocity for Beholder

// --- Asset Loading ---
let beholderImg = new Image();         // Mid-flap (original)
let beholderDownFlapImg = new Image(); // Down-flap
let beholderUpFlapImg = new Image();   // Up-flap
let stalactiteImg = new Image();
let stalagmiteImg = new Image();
let backgroundImg = new Image();

// Set the source paths
beholderImg.src = 'images/beholder.png';             // Mid-flap
beholderDownFlapImg.src = 'images/beholder-downflap.png'; // Down-flap image file
beholderUpFlapImg.src = 'images/beholder-upflap.png';   // Up-flap image file
stalactiteImg.src = 'images/stalactite.png';
stalagmiteImg.src = 'images/stalagmite.png';
backgroundImg.src = 'images/background.png';

// Assign onload handlers
beholderImg.onload = imageLoaded;
beholderDownFlapImg.onload = imageLoaded; // Add onload for new image
beholderUpFlapImg.onload = imageLoaded;   // Add onload for new image
stalactiteImg.onload = imageLoaded;
stalagmiteImg.src = 'images/stalagmite.png';
stalagmiteImg.onload = imageLoaded;
backgroundImg.onload = imageLoaded;

// --- Helper function to set up the animation array ---
// (Call this after images are potentially loaded)
function setupAnimationFrames() {
    beholderFrames = [
        beholderDownFlapImg, // Frame 0
        beholderImg,         // Frame 1 (Mid)
        beholderUpFlapImg    // Frame 2
    ];
    // Optional: You could add the mid-flap again to make the cycle smoother
    // beholderFrames = [beholderDownFlapImg, beholderImg, beholderUpFlapImg, beholderImg];
    // If you do this, make sure the modulo logic (%) later uses the correct array length.
}

// --- Game Initialization ---
function resetGame() {
    beholderY = canvas.height / 2;
    velocityY = 0; // <<< ENSURE velocity is reset
    score = 0;
    obstacles = [];
    frameCount = 0;
    gameState = 'start';
    animationFrameIndex = 0; // Reset animation frame on game reset
    spawnInitialObstacles();
    console.log("Game Reset for new size");
}

function spawnInitialObstacles() {
    obstacles = []; // Clear existing
    // Example: Spawn first obstacle relative to the right edge
    let startX = canvas.width * 0.8; // Start spawning partway across the screen
    addObstacle(startX);
     // Add more if needed, spaced based on constants/canvas width
     // addObstacle(startX + OBSTACLE_SPAWN_DISTANCE);
}

// --- Game Objects ---
function Beholder(deltaTime) {
    // --- Apply Physics ONLY when playing ---
    if (gameState === 'playing') {
        // Apply gravity (acceleration = pixels/sec^2)
        velocityY += GRAVITY * deltaTime; // Gravity effect over time
        // Apply velocity (position change = pixels/sec * sec)
        beholderY += velocityY * deltaTime; // Position update over time
    }

    // --- Update Animation Frame ---
    // (Keep animation running in start/playing for visual feedback)
    if (gameState === 'playing' || gameState === 'start' || gameState === 'gameOver') { // Animate in game over too
        if (frameCount % ANIMATION_THROTTLE === 0) {
            animationFrameIndex = (animationFrameIndex + 1) % beholderFrames.length;
        }
    }
    let currentFrameImg = beholderFrames[animationFrameIndex] || beholderImg;

    // --- Drawing (REVISED LOGIC) ---
    let imageToDraw = null; // Start assuming no image can be drawn yet

    // Prioritize drawing the current animation frame if it's ready
    if (currentFrameImg && currentFrameImg.complete && currentFrameImg.naturalHeight !== 0) {
        imageToDraw = currentFrameImg;
    }
    // If the animation frame isn't ready, try the fallback (mid-flap) image
    else if (beholderImg && beholderImg.complete && beholderImg.naturalHeight !== 0) {
        imageToDraw = beholderImg;
    }

    // Now, ONLY if we selected a valid image, draw it.
    if (imageToDraw) {
        // ctx should definitely be defined globally here
        ctx.drawImage(
            imageToDraw,
            canvas.width / 3 - BEHOLDER_SIZE / 2, // Centered X
            beholderY - BEHOLDER_SIZE / 2,       // Centered Y
            BEHOLDER_SIZE,                       // Width
            BEHOLDER_SIZE                        // Height
        );
    }
    // If neither image is ready, nothing is drawn (better than an error)
}

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

    this.update = function(deltaTime) {
        this.x -= OBSTACLE_SPEED * deltaTime;

        // Check for scoring
        // Use the adjusted collision width for scoring as well
        let collisionX = canvas.width / 3; // Beholder's X position
        let obstacleCollisionRightEdge = this.x + (OBSTACLE_WIDTH * OBSTACLE_COLLISION_WIDTH_FACTOR);

        if (!this.scored && this.x + OBSTACLE_WIDTH < collisionX) {
             // Check if the beholder has passed the obstacle's visual right edge
            if (this.x + OBSTACLE_WIDTH < collisionX - (BEHOLDER_SIZE * 0.5)) { // Adjusted check
                score++;
                this.scored = true;
                console.log("Score:", score); // For debugging
            }
        }
    };
} // <--- THIS is the single, correct closing brace for the constructor function

function addObstacle(startX) {
    // Calculate gap position relative to canvas height
    let gapCenterY = Math.random() * (canvas.height - OBSTACLE_GAP * 2) + OBSTACLE_GAP;
    obstacles.push(new Obstacle(startX, gapCenterY));
    console.log(`Added obstacle at x=${startX}`);
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
    const beholderX = canvas.width / 3; // Center X of beholder
    const beholderLeft = beholderX - (BEHOLDER_SIZE / 2);
    const beholderRight = beholderX + (BEHOLDER_SIZE / 2);
    const beholderTop = beholderY - (BEHOLDER_SIZE / 2);
    const beholderBottom = beholderY + (BEHOLDER_SIZE / 2);

    // Check collision with top/bottom boundaries
    if (beholderTop < 0 || beholderBottom > canvas.height) {
        console.log("Boundary Collision");
        return true;
    }

    // Check collision with obstacles
    for (let obs of obstacles) {
        // Calculate the effective collision edges for the obstacle
        // Use the narrower collision factor for horizontal check
        let obstacleCollisionLeftEdge = obs.x + (OBSTACLE_WIDTH * (1 - OBSTACLE_COLLISION_WIDTH_FACTOR) / 2);
        let obstacleCollisionRightEdge = obs.x + OBSTACLE_WIDTH - (OBSTACLE_WIDTH * (1 - OBSTACLE_COLLISION_WIDTH_FACTOR) / 2);

        // Check for horizontal overlap (using collision factor)
        if (beholderRight > obstacleCollisionLeftEdge && beholderLeft < obstacleCollisionRightEdge) {
            // Check for vertical overlap (collision with top or bottom part)
            if (beholderTop < obs.topHeight || beholderBottom > obs.bottomY) {
                 console.log("Obstacle Collision");
                return true; // Collision detected
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
        // Example: Tiling (assuming background width is less than canvas width sometimes)
        let bgWidth = backgroundImg.width;
        let bgHeight = backgroundImg.height; // Use actual image height for ratio
        let scale = canvas.height / bgHeight; // Scale to fit height
        let scaledWidth = bgWidth * scale;
        let x = 0;
        while (x < canvas.width) {
            ctx.drawImage(backgroundImg, x, 0, scaledWidth, canvas.height);
            x += scaledWidth;
        }
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
    // Apply LIFT (instantaneous velocity change in pixels/second)
    if (gameState === 'start' || gameState === 'playing') {
        velocityY = LIFT; // Set velocity directly (LIFT is now pixels/sec)
        if (gameState === 'start') {
            gameState = 'playing'; // Start playing on first input
            frameCount = 0; // Reset frame count for animation cycle? Optional.
            obstacles = []; // Clear any initial obstacles if needed
            spawnInitialObstacles(); // Respawn obstacles for a fresh start
        }
    } else if (gameState === 'gameOver') {
         resetGame(); // Allow restarting from gameOver
    }
}

// --- Game Loop ---
function gameLoop(timestamp) {
    if (!ctx || !canvas) {
        console.error("Canvas or context missing in gameLoop!");
        return;
    }

    // --- Calculate Delta Time ---
    if (lastTime === 0) { // Handle first frame
        lastTime = timestamp;
        requestAnimationFrame(gameLoop);
        return;
    }
    let deltaTime = (timestamp - lastTime) / 1000; // Time elapsed in seconds
    lastTime = timestamp;

    // --- Frame Rate Cap (Optional but recommended) ---
    // Prevent huge jumps if tab loses focus or stutters
    deltaTime = Math.min(deltaTime, 1 / 30); // Max delta = 1/30th sec

    // --- Clear Canvas ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw Background ---
    drawBackground();

    // --- Update and Draw Obstacles ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (gameState === 'start' || gameState === 'playing') {
             obs.draw();
        }
        if (gameState === 'playing') {
            obs.update(deltaTime); // <<< Pass deltaTime
            if (obs.x + OBSTACLE_WIDTH < 0) {
                obstacles.splice(i, 1);
            }
        }
    }
     if (gameState === 'playing') {
        if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - OBSTACLE_SPAWN_DISTANCE) {
             addObstacle(canvas.width);
        }
    }

    // --- Draw & Update Beholder ---
    Beholder(deltaTime); // <<< Pass deltaTime

    // --- Draw Score ---
    drawScore();

    // --- Handle Game States ---
    if (gameState === 'playing') {
        // Collision checks don't need deltaTime directly, they compare current positions
        if (checkCollisions()) {
            gameState = 'gameOver';
        }
        frameCount++; // Increment frameCount for animation
    } else if (gameState === 'start') {
        drawStartScreen();
        frameCount++; // Keep animating on start screen
    } else if (gameState === 'gameOver') {
        drawGameOverScreen();
         frameCount++; // Keep animating on game over screen
    }

    // --- Request Next Frame ---
    requestAnimationFrame(gameLoop); // Let the browser schedule the next frame
}

function startGameIfReady() {
    if (isWindowLoaded && imagesLoaded === totalImages) {
        console.log("Starting game loop");
        lastTime = 0; // Initialize lastTime before starting loop
        requestAnimationFrame(gameLoop); // Start the loop
    }
}

// --- Add a function to handle resizing ---
function resizeCanvas() {
    // Get the actual displayed size from CSS
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the drawing surface size needs to be updated
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        console.log(`Resized canvas to: ${canvas.width}x${canvas.height}`);

        // IMPORTANT: Re-initialize or adjust game elements based on new size
        // This might involve calling resetGame or parts of it,
        // depending on how positions are calculated.
        // If resetGame fully relies on canvas.width/height, calling it might be enough.
        // Ensure resetGame repositions beholder and obstacles correctly for the new size.
         if(ctx) { // Only reset if ctx is ready
             resetGame(); // Example: Recalculate positions based on new dimensions
         }

        // You might want to redraw the current screen immediately after resize
        // drawBackground(); // Example
        // drawScore(); // Example
        // Draw obstacles in their current (potentially reset) positions
        // Draw beholder in its reset position
    }
}

// --- Modify window.onload ---
window.onload = function() {
    console.log("Window loaded.");
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element with ID 'gameCanvas' not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D rendering context.");
        return;
    }

    // --- Initial Canvas Size Setup ---
    // Set initial drawing surface size based on initial CSS size
    resizeCanvas(); // Call resizeCanvas once initially

    // Add Event Listeners (as previously corrected)
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
    // --- End of Added Event Listeners ---

    // Call resetGame AFTER initial canvas size is set
    // resetGame(); // resizeCanvas now calls this

    // Initialize game objects AFTER canvas size is set
    // ... object initializations if any are needed outside resetGame ...

    setupAnimationFrames();

    isWindowLoaded = true;
    startGameIfReady(); // Check if images are already loaded

    // --- Add Resize Listener ---
    window.addEventListener('resize', resizeCanvas);
};