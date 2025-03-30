// Declare canvas and ctx in the global scope
let canvas;
let ctx;
let isWindowLoaded = false; // <-- Add this flag

// --- Game Constants ---
const GRAVITY = 1800;  // Pixels per second per second (adjust significantly upwards)
const LIFT = -500;     // Pixels per second (instantaneous velocity change, adjust magnitude)
const BEHOLDER_SIZE_FACTOR = 0.08; // <<< Relative size (e.g., 8% of height)
const OBSTACLE_WIDTH_FACTOR = 0.1; // <<< Relative width (e.g., 10% of height)
const OBSTACLE_COLLISION_WIDTH_FACTOR = 0.6; // Keep this from previous step
const OBSTACLE_GAP_FACTOR = 0.25; // <<< Relative gap (e.g., 28% of height)
const OBSTACLE_SPEED_FACTOR = 0.6; // <<< Relative speed (e.g., pixels per second = factor * canvas.width)
const OBSTACLE_SPAWN_DISTANCE_FACTOR = 0.5; // <<< Relative spawn distance (e.g., 40% of canvas.width)
const OBSTACLE_VERTICAL_MARGIN_FACTOR = 0.08; // <<< Relative margin (e.g., 8% of height from top/ground)
const ANIMATION_THROTTLE = 20; // Keep animation frame-based for now, or adjust later
const MAX_UP_ROTATION_DEG = -15; // Max upward tilt in degrees (negative for up)
const MAX_DOWN_ROTATION_DEG = 80;  // Max downward tilt in degrees
const ROTATION_VELOCITY_SCALE = 600; // Lower value = more sensitive rotation to velocity changes (tune this!)
const MIN_OBSTACLE_GAP_FACTOR = 0.20; // Example: Minimum gap as factor of height
const MAX_OBSTACLE_GAP_FACTOR = 0.35; // Example: Maximum gap as factor of height
const MIN_SPAWN_DISTANCE_FACTOR = 0.4; // Example: Minimum distance as factor of width
const MAX_SPAWN_DISTANCE_FACTOR = 0.7; // Example: Maximum distance as factor of width

// Define your desired internal rendering resolution
const RENDER_WIDTH = 600; // Or 960, 1024 - find a balance
const RENDER_HEIGHT = 800; // Or 720, 768 - maintain aspect ratio if needed

// --- Image Loading Management ---
let imagesLoaded = 0;
const totalImages = 7; // <<< INCREMENT totalImages (Beholder x3, Obstacles x2, Background, Ground)
let allImagesLoaded = false;

function imageLoaded() {
    imagesLoaded++;
    console.log(`Image ${imagesLoaded}/${totalImages} loaded.`); // Add for debugging
    // No need to check totalImages here, startGameIfReady does it
    startGameIfReady(); // Check if the window is also loaded
}

// --- Game Variables ---
let beholderX, beholderY, velocityY;
let obstacles = [];
let obstaclePool = [];
let score = 0;
let highScore = 0; // <<< ADD High Score variable
let frameCount = 0; // Used for animation throttling
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let animationFrameIndex = 0; // Index for beholder animation frames
let groundX = 0; // <<< ADD: X position of the scrolling ground
let groundY = 0; // <<< ADD: Y position of the ground (calculated later)
// const GROUND_HEIGHT = 50; // <<< REMOVE: We calculate groundY based on image or dynamically

// Dynamically calculated constants (initialized in resetGame/resize)
let beholderSize = 50;
let obstacleWidth = 60;
let obstacleGap = 180;
let obstacleSpeed = 125;
let obstacleSpawnDistance = 150;

// --- Load Images ---
const beholderImg = new Image();
const beholderDownFlapImg = new Image();
const beholderUpFlapImg = new Image();
const stalactiteImg = new Image(); // Top obstacle
const stalagmiteImg = new Image(); // Bottom obstacle image
const backgroundImg = new Image();
const groundImg = new Image(); // Ground image object

// --- Load Sounds ---
// REMOVE HTMLAudioElement instances
// const wingSound = new Audio('sounds/wing.wav');
// const punchSound = new Audio('sounds/hit.wav');
// const dieSound = new Audio('sounds/die.wav');
// const backgroundMusic = new Audio('sounds/skyrim-snes.mp3');
// backgroundMusic.loop = true;

// ADD Buffer variables for Web Audio API
let wingSoundBuffer = null;
let punchSoundBuffer = null;
let dieSoundBuffer = null; // Added die sound buffer
let backgroundMusicBuffer = null;
let backgroundMusicSourceNode = null; // To control the playing music node

// --- Animation Frames Array ---
let beholderFrames = []; // Initialize

function setupAnimationFrames() {
    // Ensure this runs AFTER images might be loaded or ensure images exist
    if (beholderDownFlapImg.complete && beholderImg.complete && beholderUpFlapImg.complete) {
         beholderFrames = [beholderDownFlapImg, beholderImg, beholderUpFlapImg, beholderImg];
    } else {
        console.warn("Attempted to setup animation frames before all beholder images loaded.");
         beholderFrames = [beholderImg, beholderImg, beholderImg, beholderImg]; // Fallback
    }
}

// --- Assign onload handlers FIRST ---
beholderImg.onload = imageLoaded;
beholderDownFlapImg.onload = imageLoaded;
beholderUpFlapImg.onload = imageLoaded;
stalactiteImg.onload = imageLoaded;
stalagmiteImg.onload = imageLoaded;
backgroundImg.onload = imageLoaded;
groundImg.onload = imageLoaded;

// --- Assign sources AFTER defining onload ---
beholderImg.src = 'images/dragon-flapmid.png';
beholderDownFlapImg.src = 'images/dragon-flapdown.png';
beholderUpFlapImg.src = 'images/dragon-flapup.png';
stalactiteImg.src = 'images/stalactite.png';
stalagmiteImg.src = 'images/stalagmite.png';
backgroundImg.src = 'images/background.png';
groundImg.src = 'images/base.png';

// --- Game Initialization ---
function resetGame() {
    console.log("Resetting game... Checking obstaclePool:", typeof obstaclePool); // <<< ADD DEBUG LOG
    // !!! Recalculate dynamic sizes based on current canvas dimensions !!!
    beholderSize = canvas.height * BEHOLDER_SIZE_FACTOR;
    obstacleWidth = canvas.height * OBSTACLE_WIDTH_FACTOR; // Often makes sense to scale width based on height
    obstacleGap = canvas.height * OBSTACLE_GAP_FACTOR;
    obstacleSpeed = canvas.width * OBSTACLE_SPEED_FACTOR;
    obstacleSpawnDistance = canvas.width * OBSTACLE_SPAWN_DISTANCE_FACTOR;

    console.log(`Dynamic sizes set: beholder=${beholderSize.toFixed(1)}, obsWidth=${obstacleWidth.toFixed(1)}, obsGap=${obstacleGap.toFixed(1)}, obsSpeed=${obstacleSpeed.toFixed(1)}, obsSpawnDist=${obstacleSpawnDistance.toFixed(1)}`);

    // --- Reset Player State ---
    beholderX = canvas.width / 3; // Position beholder relative to width
    beholderY = canvas.height / 2;
    velocityY = 0;

    // --- Reset Game State ---
    obstacles = [];
    score = 0;
    gameState = 'start';
    frameCount = 0;
    animationFrameIndex = 0; // Reset animation index
    groundX = 0; // Reset ground scroll position

    // Recalculate groundY based on current canvas height and image height
    if (groundImg.complete && groundImg.naturalHeight !== 0) {
         groundY = canvas.height - groundImg.naturalHeight;
    } else {
         // Fallback: Make ground a certain percentage of height if image fails
         console.warn("Ground image not loaded/ready in resetGame, using fallback height.")
         groundY = canvas.height * (1 - OBSTACLE_VERTICAL_MARGIN_FACTOR); // Example: Ground takes bottom margin space
    }
    console.log(`groundY calculated: ${groundY.toFixed(1)}`);


    // Stop and reset music on game reset
    stopBackgroundMusic(); // Use new function

    console.log("Game Reset Complete");

    // Respawn obstacles based on new dimensions
    // Clear existing obstacles first (done above)
    spawnInitialObstacles();

    // Clear and Pool Obstacles
    if (obstacles && obstaclePool) { // <<< Defensive check added
        obstacles.forEach(obs => {
            obs.deactivate();
            obstaclePool.push(obs);
        });
        obstacles = [];
    } else {
        console.error("obstacles or obstaclePool not defined during reset!"); // <<< ADD ERROR LOG
        obstacles = []; // Still clear active obstacles
    }

    console.log("Game reset complete. State:", gameState);
}

function spawnInitialObstacles() {
    obstacles = []; // Clear obstacles explicitly here too
     // Start first obstacle further out, relative to new width
    addObstacle(canvas.width + obstacleWidth); // Start just off screen
    addObstacle(canvas.width + obstacleWidth + obstacleSpawnDistance);
    addObstacle(canvas.width + obstacleWidth + 2 * obstacleSpawnDistance);
    console.log("Initial obstacles spawned");
}

// --- Helper Function ---
function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

// <<< ADD THIS HELPER FUNCTION >>>
function playSound(soundSrc) { // Modified: Takes sound source URL
    // THIS FUNCTION IS NOW OBSOLETE with Web Audio API, but keep if used elsewhere, or remove.
    // For Web Audio, we use playSoundFromBuffer directly.
    // Let's comment it out for now to avoid confusion.
    /*
    // Create a new audio object each time
    const sound = new Audio(soundSrc);
    // Play the sound
    sound.play().catch(error => {
        // Autoplay policies might prevent sound initially until user interaction
        console.warn("Sound play failed (likely requires user interaction first):", error);
    });
    */
    console.warn("`playSound(soundSrc)` called, but Web Audio API (`playSoundFromBuffer`) should be used.");
}

// --- Game Objects ---
function Beholder(deltaTime) {
    // --- Apply Physics when playing OR game over ---
    if (gameState === 'playing' || gameState === 'gameOver') {
        // Apply gravity (acceleration = pixels/sec^2)
        velocityY += GRAVITY * deltaTime; // Gravity effect over time
        // Apply velocity (position change = pixels/sec * sec)
        beholderY += velocityY * deltaTime; // Position update over time

        // --- Stop at ground (groundY) ONLY when game is over ---
        if (gameState === 'gameOver' && beholderY >= groundY - beholderSize / 2) { // Use dynamic beholderSize
            beholderY = groundY - beholderSize / 2; // Pin to TOP of ground image
            velocityY = 0; // Stop further falling
        }
    }

    // --- Update Animation Frame ONLY when NOT game over ---
    if (gameState === 'start' || gameState === 'playing') {
        // Only advance frame if animating
        if (frameCount % ANIMATION_THROTTLE === 0) {
            animationFrameIndex = (animationFrameIndex + 1) % beholderFrames.length;
        }
    }

    // --- Calculate Rotation Angle (allow during gameOver too) ---
    let rotationAngle = 0; // Default to no rotation if not playing/game over
    if (gameState === 'playing' || gameState === 'gameOver') { // <<< ENSURE this condition includes gameOver
        const maxUpRad = degToRad(MAX_UP_ROTATION_DEG);
        const maxDownRad = degToRad(MAX_DOWN_ROTATION_DEG);
        let targetAngle = (velocityY / ROTATION_VELOCITY_SCALE) * maxDownRad;
        rotationAngle = Math.max(maxUpRad, Math.min(targetAngle, maxDownRad));

        // --- Pin rotation when on ground (groundY) during game over ---
        if (gameState === 'gameOver' && beholderY >= groundY - beholderSize / 2) {
             rotationAngle = maxDownRad; // Force max down rotation when grounded
        }
    }

    // --- Determine Image to Draw ---
    let imageToDraw = null;

    // --- Select image based on state ---
    if (gameState === 'gameOver') {
        // Force the middle flap image when game is over
        imageToDraw = beholderImg;
    } else {
        // Otherwise, use the current animation frame
        let currentFrameImg = beholderFrames[animationFrameIndex] || beholderImg; // Use fallback just in case
         if (currentFrameImg && currentFrameImg.complete && currentFrameImg.naturalHeight !== 0) {
            imageToDraw = currentFrameImg;
        } else if (beholderImg && beholderImg.complete && beholderImg.naturalHeight !== 0) {
             imageToDraw = beholderImg; // Double fallback
         }
    }

    // --- Drawing with Rotation ---
    if (imageToDraw && imageToDraw.complete && imageToDraw.naturalHeight !== 0) { // Check again before drawing
        const centerX = beholderX; // Use dynamic beholderX
        const centerY = beholderY;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle);
        ctx.drawImage(
            imageToDraw, // Use the selected image
            -beholderSize / 2, // Use dynamic beholderSize
            -beholderSize / 2, // Use dynamic beholderSize
            beholderSize,     // Use dynamic beholderSize
            beholderSize      // Use dynamic beholderSize
        );
        ctx.restore();
    }
}

// --- Obstacle Class ---
class Obstacle {
    constructor() {
        // Initialize properties that might change when reused
        this.x = 0;
        this.width = obstacleWidth;
        this.gapY = 0; // Center Y position of the gap
        this.gapHeight = obstacleGap; // Use the current dynamic gap
        this.passed = false; // For scoring
        this.topHeight = 0; // Calculated in reset
        this.bottomY = 0; // Calculated in reset
        this.active = false; // <<< ADD: Flag to indicate if it's in the game or pool
        // Determine if it's a top (stalactite) or bottom (stalagmite) obstacle implicitly
        // We'll draw both parts using the appropriate images in the draw method.
    }

    // <<< ADD: Method to reset and activate an obstacle from the pool
    reset(startX) {
        this.x = startX;
        this.width = canvas.height * OBSTACLE_WIDTH_FACTOR; // Or however width is determined
        this.gapHeight = canvas.height * OBSTACLE_GAP_FACTOR;
        const minGapY = canvas.height * OBSTACLE_VERTICAL_MARGIN_FACTOR + this.gapHeight / 2;
        const maxGapY = canvas.height * (1 - OBSTACLE_VERTICAL_MARGIN_FACTOR) - this.gapHeight / 2;

        if (minGapY >= maxGapY) {
            this.gapY = canvas.height / 2;
            // console.warn("Obstacle vertical margins/gap too large, falling back.");
        } else {
            this.gapY = Math.random() * (maxGapY - minGapY) + minGapY;
        }
        this.topHeight = Math.max(0, this.gapY - this.gapHeight / 2);
        this.bottomY = Math.min(canvas.height, this.gapY + this.gapHeight / 2);
        this.passed = false;
        this.active = true;
    }

    update(deltaTime) {
        if (!this.active) return;
        this.x -= obstacleSpeed * deltaTime;

        if (!this.passed && this.x + this.width < beholderX) {
            score++;
            if (score > highScore) highScore = score;
            this.passed = true;

            // Adjust next obstacle props
            obstacleGap = canvas.height * (Math.random() * (MAX_OBSTACLE_GAP_FACTOR - MIN_OBSTACLE_GAP_FACTOR) + MIN_OBSTACLE_GAP_FACTOR);
            obstacleSpawnDistance = canvas.width * (Math.random() * (MAX_SPAWN_DISTANCE_FACTOR - MIN_SPAWN_DISTANCE_FACTOR) + MIN_SPAWN_DISTANCE_FACTOR);

            updateScoreDisplay(); // Defined elsewhere

            // --- Play Score Sound using Web Audio --- <<< MODIFY
            if (coinSoundBuffer) { // Check if the buffer was loaded successfully
                 playSoundFromBuffer(coinSoundBuffer);
            } else {
                // console.warn("Coin sound buffer not loaded, cannot play sound.");
            }
            // ----------------------------------------
        }
    }

    draw() {
        if (!this.active || !ctx || !canvas || this.width <= 0) return;

        // --- Draw Stalactite (Top) --- <<< REVERT TO SIMPLER DRAWING
        // Draw into the rectangle from canvas top (0) to gap top (this.topHeight)
        if (stalactiteImg.complete && this.topHeight > 0) {
             ctx.drawImage(
                stalactiteImg,
                this.x,         // dx: Left edge
                0,              // dy: Canvas top edge
                this.width,     // dWidth: Obstacle width
                this.topHeight  // dHeight: Fill space down to the gap top
            );
        } else if (this.topHeight > 0) { // Fallback rectangle
            ctx.fillStyle = '#A9A9A9';
            ctx.fillRect(this.x, 0, this.width, this.topHeight);
        }

        // --- Draw Stalagmite (Bottom) --- <<< REVERT TO SIMPLER DRAWING
        // Draw into the rectangle from gap bottom (this.bottomY) to canvas bottom
        const spaceBelowGap = canvas.height - this.bottomY;
        if (stalagmiteImg.complete && spaceBelowGap > 0) {
             ctx.drawImage(
                stalagmiteImg,
                this.x,              // dx: Left edge
                this.bottomY,        // dy: Gap bottom edge
                this.width,          // dWidth: Obstacle width
                spaceBelowGap        // dHeight: Fill space down to canvas bottom
            );
        } else if (spaceBelowGap > 0) { // Fallback rectangle
             ctx.fillStyle = '#A9A9A9';
             ctx.fillRect(this.x, this.bottomY, this.width, spaceBelowGap);
        }
    }

    // <<< ADD: Method to deactivate and return to pool
    deactivate() {
        this.active = false;
    }
}

// --- Obstacle Management ---
function addObstacle(startX) {
    console.log('addObstacle: Checking obstaclePool:', typeof obstaclePool); // <<< ADD DEBUG LOG
    let obs;
    if (obstaclePool && obstaclePool.length > 0) { // <<< Defensive check added
        obs = obstaclePool.pop(); // Reuse from pool
        console.log("Reusing obstacle from pool.");
    } else {
        obs = new Obstacle(); // Create new if pool is empty
        console.log("Creating new obstacle.");
    }
    obs.reset(startX); // Reset/initialize its properties
    obstacles.push(obs); // Add to active obstacles
}

function manageObstacles() {
    // Update and draw existing obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        obstacles[i].draw();

        // Check for scoring
        const beholderX = canvas.width / 3;
        if (!obstacles[i].scored && obstacles[i].x + obstacleWidth < beholderX) {
             score++;
             obstacles[i].scored = true;
             // Maybe play a sound here later
        }

        // Remove obstacles that are off-screen left
        if (obstacles[i].x + obstacleWidth < 0) {
            obstacles.splice(i, 1);
        }
    }

     // Add new obstacles when the last one is far enough in
     if (gameState === 'playing') {
         const lastObstacle = obstacles[obstacles.length - 1];
         if(canvas.width - lastObstacle.x >= obstacleSpawnDistance) {
             addObstacle(lastObstacle.x + obstacleSpawnDistance);
         }
     }
}

// --- Collision Detection ---
function checkCollisions() {
    // Use dynamic beholder variables
    const beholderLeft = beholderX - (beholderSize / 2);
    const beholderRight = beholderX + (beholderSize / 2);
    const beholderTop = beholderY - (beholderSize / 2);
    const beholderBottom = beholderY + (beholderSize / 2);

    // Check collision with top boundary
    if (beholderTop < 0) {
         console.log("Top Boundary Collision");
        return true;
    }

    // Check collision with GROUND
    if (beholderBottom >= groundY) {
         console.log("Ground Collision");
         beholderY = groundY - beholderSize / 2;
         velocityY = 0;
        return true;
    }

    // Check collision with obstacles - Use dynamic obstacleWidth
    for (let obs of obstacles) {
        let obstacleCollisionLeftEdge = obs.x + (obstacleWidth * (1 - OBSTACLE_COLLISION_WIDTH_FACTOR) / 2);
        let obstacleCollisionRightEdge = obs.x + obstacleWidth - (obstacleWidth * (1 - OBSTACLE_COLLISION_WIDTH_FACTOR) / 2);

        if (beholderRight > obstacleCollisionLeftEdge && beholderLeft < obstacleCollisionRightEdge) {
            if (beholderTop < obs.topHeight || beholderBottom > obs.bottomY) {
                 console.log("Obstacle Collision");
                return true;
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

// --- Helper Function for Text Wrapping ---
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let currentY = y; // Start drawing at the provided y

    context.textAlign = 'center'; // Ensure text is centered at the x position

    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = context.measureText(testLine);
        let testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            // Current line is full, draw it
            context.fillText(line, x, currentY);
            // Start a new line with the current word
            line = words[n] + ' ';
            // Move down for the next line
            currentY += lineHeight;
        } else {
            // Word fits, add it to the current line
            line = testLine;
        }
    }
    // Draw the last line
    context.fillText(line, x, currentY);
}

function drawStartScreen() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Wrapped Text Instruction --- <<< MODIFIED
    const startText = "Click, Tap, or Press Spacebar to start!";
    const startFontSize = 14; // Adjust font size as needed
    const lineHeight = startFontSize * 1.5; // Adjust line spacing (e.g., 1.5 times font size)
    const textMaxWidth = canvas.width * 0.8; // Use 80% of canvas width for text wrapping
    const textStartY = canvas.height / 1.5; // Adjust vertical position as needed

    ctx.fillStyle = '#FFFFFF'; // White text
    ctx.font = `${startFontSize}px "Press Start 2P"`;
    ctx.textAlign = 'center'; // Centered horizontally
    ctx.textBaseline = 'top'; // Align text from its top

    // Call the wrapText helper function
    wrapText(ctx, startText, canvas.width / 2, textStartY, textMaxWidth, lineHeight);
}

function drawGameOverScreen() {
     ctx.fillStyle = 'rgba(80, 0, 0, 0.7)'; // Semi-transparent dark red overlay
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffcc00'; // Gold for GAME OVER
    ctx.font = "32px 'Press Start 2P'";
    ctx.textAlign = 'center';
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 80); // Move GAME OVER up slightly

    ctx.fillStyle = '#e0e0e0'; // White for scores
    ctx.font = "20px 'Press Start 2P'";
    // Display current score
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 - 20);
    // Display best score
    ctx.fillText(`Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 20);

    ctx.font = "14px 'Press Start 2P'"; // Keep retry text size
    ctx.fillText("Click or Space to Retry", canvas.width / 2, canvas.height / 2 + 70); // Adjust retry text position
}


// --- Input Handling ---
function handleInput() {
    if (gameState === 'start' || gameState === 'playing') {
        velocityY = LIFT; // Apply lift
        playSoundFromBuffer(wingSoundBuffer); // CORRECT: Use Web Audio API

        if (gameState === 'start') {
            gameState = 'playing';
            // Start background music only when transitioning from start to playing
            stopBackgroundMusic(); // Stop any previous instance just in case
            backgroundMusicSourceNode = playSoundFromBuffer(backgroundMusicBuffer, true); // CORRECT: Play and loop background music via Web Audio
            // Reset frame count? Optional.
            // Clear obstacles and respawn? Depends if you want start screen obstacles removed.
            // obstacles = []; // Uncomment if you want obstacles cleared on first tap
            // spawnInitialObstacles(); // Uncomment if you want obstacles cleared on first tap
        }
    } else if (gameState === 'gameOver') {
         resetGame(); // Allow restarting from gameOver
    }
}

// --- Add Ground Update Function ---
function updateGround(deltaTime) {
    groundX -= obstacleSpeed * deltaTime;
    // If ground has scrolled its full width off screen, reset it
    // Use groundImg.width for accurate reset if image is loaded
    const groundWidth = (groundImg.complete && groundImg.naturalWidth) ? groundImg.naturalWidth : canvas.width; // Use image width or fallback
    if (groundX <= -groundWidth) {
        groundX += groundWidth; // Add width to reset seamlessly
    }
}

// --- Add Ground Draw Function ---
function drawGround() {
    if (groundImg.complete && groundImg.naturalHeight !== 0) {
        const imgWidth = groundImg.naturalWidth;
        const imgHeight = groundImg.naturalHeight; // Use actual height if possible
        groundY = canvas.height - imgHeight; // Recalculate groundY based on actual image height

        // Draw the ground image potentially multiple times to cover the canvas width
        let currentX = groundX;
        while (currentX < canvas.width) {
             ctx.drawImage(groundImg, currentX, groundY, imgWidth, imgHeight);
             currentX += imgWidth; // Move to the next drawing position
        }

    } else {
         // Fallback if image not ready (e.g., draw a rect)
         groundY = canvas.height - GROUND_HEIGHT; // Use constant height
         ctx.fillStyle = '#A0522D'; // Brown color for fallback ground
         ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);
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

        // Draw obstacles in start, playing, AND game over states
        if (gameState === 'start' || gameState === 'playing' || gameState === 'gameOver') {
             obs.draw();
        }

        // Only update position and check scoring/removal in 'playing' state
        if (gameState === 'playing') {
            obs.update(deltaTime); // Pass deltaTime

            // --- Check if obstacle is off-screen --- <<< MODIFY
            if (obs.x + obs.width < 0) {
                obs.deactivate(); // Mark as inactive
                obstaclePool.push(obs); // Add to pool
                obstacles.splice(i, 1); // Remove from active array
                // console.log(`Obstacle moved to pool. Pool size: ${obstaclePool.length}, Active: ${obstacles.length}`);
            }
        }
    }

    // Add new obstacles only when playing - use dynamic distances
    if (gameState === 'playing') {
         // Check distance based on the last obstacle added
         const lastObstacleX = obstacles.length > 0 ? obstacles[obstacles.length - 1].x : -Infinity;
         if (lastObstacleX < canvas.width - obstacleSpawnDistance) {
             addObstacle(canvas.width); // Add new obstacle starting at the right edge
         }
     }

    // --- Update Ground Position (only when playing) --- <<< ADD
    if (gameState === 'playing') {
         updateGround(deltaTime);
    }

    // --- Draw Ground (before Beholder) --- <<< ADD
    drawGround(); // Draw the ground layer

    // --- Draw & Update Beholder ---
    Beholder(deltaTime);

    // --- Draw Score ---
    drawScore();

    // --- Handle Game States ---
     if (gameState === 'playing') {
        if (checkCollisions()) {
            console.log("Collision detected! Setting state to gameOver."); // Keep debug log
            gameState = 'gameOver';
            stopBackgroundMusic(); // CORRECT: Use Web Audio function
            // backgroundMusic.currentTime = 0; // REMOVE: Not needed for Web Audio stop
            playSoundFromBuffer(punchSoundBuffer); // CORRECT: Use Web Audio function for punch
            playSoundFromBuffer(dieSoundBuffer);   // ADD: Play die sound using Web Audio
            // --- Update High Score ---
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('flappyDragonHighScore', highScore);
                console.log("New High Score Saved:", highScore);
            }
            // -------------------------
        }
        frameCount++;
    } else if (gameState === 'start') {
        drawStartScreen();
        frameCount++; // Keep animating on start screen
    } else if (gameState === 'gameOver') {
        drawGameOverScreen(); // Draw overlay
        frameCount++; // Keep animating on game over screen
    }

    // --- Request Next Frame ---
    requestAnimationFrame(gameLoop); // Let the browser schedule the next frame
}

function startGameIfReady() {
    console.log(`startGameIfReady called: isWindowLoaded=${isWindowLoaded}, imagesLoaded=${imagesLoaded}/${totalImages}`); // Keep for debugging
    if (isWindowLoaded && imagesLoaded === totalImages) {
        console.log("Starting game loop...");

        // --- Recalculate final groundY now that groundImg is loaded ---
        // Ensure groundY is accurate before creating obstacles
        if (groundImg.complete && groundImg.naturalHeight !== 0) {
             groundY = canvas.height - groundImg.naturalHeight;
        } else {
             console.warn("Ground image not ready at game start, using constant height.");
             groundY = canvas.height - GROUND_HEIGHT; // Fallback
        }

        // --- Spawn initial obstacles HERE --- <<< MOVED
        spawnInitialObstacles();

        // --- Start the loop ---
        lastTime = 0; // Initialize lastTime before starting loop
        requestAnimationFrame(gameLoop); // Start the loop AFTER spawning obstacles

    } else {
        console.log("Conditions not met yet."); // Keep for debugging
    }
}

// --- Start the Game ---
// Initialize variables

// !! REMOVE this call to resetGame() from the global scope !!
// resetGame(); // This was line 384 - REMOVE OR COMMENT OUT

// Ensure game initialization happens after the HTML document is fully loaded
window.onload = async function() { // Make onload async to await sound loading
    console.log("Window loaded. Checking obstaclePool:", typeof obstaclePool);
    isWindowLoaded = true; // Set your flag

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

    // Set the internal rendering resolution
    canvas.width = RENDER_WIDTH;
    canvas.height = RENDER_HEIGHT;

    // Function to set the display size and scaling
    function resizeCanvas() {
        // Set CSS size to fill the window
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        canvas.style.display = 'block';

        // --- Control Aspect Ratio Scaling ---
        // 'contain': Fits the whole game within the screen, potentially adding black bars (letterboxing).
        // 'cover':   Fills the entire screen, potentially cropping parts of the game if aspect ratios differ.
        // 'fill':    Stretches to fill, ignoring aspect ratio (usually looks bad).
        canvas.style.objectFit = 'cover';
        // ------------------------------------

        console.log(`Canvas render size: ${canvas.width}x${canvas.height}, CSS size: ${canvas.style.width}x${canvas.style.height}`);
    }

    resizeCanvas(); // Initial call

    // --- Load High Score ---
    highScore = parseInt(localStorage.getItem('flappyDragonHighScore')) || 0;
    console.log("Loaded High Score:", highScore);
    // <<< -------------------- >>>

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

    // Call resetGame AFTER canvas is defined and potentially resized
    // Note: resetGame might need adjustments for dynamic size
    resetGame();

    // Initialize other game objects AFTER canvas is defined
    setupAnimationFrames();

    // --- Initialize Audio Context via Interaction Listener ---
    // Moved the loading logic inside handleFirstInteraction to ensure context is ready

    startGameIfReady(); // Make sure this recalculates necessary positions based on new size

    // --- Resize Listener ---
    window.addEventListener('resize', () => {
        console.log("Window resize detected.");
        resizeCanvas(); // Update CSS size
        // You MUST recalculate layout/positions based on the new render size if RENDER_WIDTH/HEIGHT were dynamic
        // OR simply reset the game which recalculates based on the fixed RENDER_WIDTH/HEIGHT
        console.log("Calling resetGame due to resize.");
        resetGame(); // Reset game state to adapt to potential aspect ratio changes etc.
    });
    // ----------------------------------
};

// --- Assuming you have an AudioContext initialized somewhere ---
// const audioContext = new (window.AudioContext || window.webkitAudioContext)();
// let sounds = { /* ... your loaded sounds ... */ };
// let isAudioContextResumed = false; // Flag to resume only once

// --- Example: In your game start or first interaction handler ---
function handleFirstInteraction() {
    console.log("First user interaction detected.");
    // Initialize/Resume AudioContext
    initAudioContext().then(contextReady => {
        if (contextReady) {
            console.log("AudioContext ready, loading sounds...");
            // Load sounds *after* context is confirmed ready
            loadGameSounds(); // Call the consolidated sound loading function
        } else {
            console.error("AudioContext failed to initialize/resume.");
            // Handle error - maybe alert user or disable sound
        }
        // Remove listeners after first successful interaction
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
    });
}
window.addEventListener('click', handleFirstInteraction, { once: true });
window.addEventListener('touchstart', handleFirstInteraction, { once: true });
window.addEventListener('keydown', handleFirstInteraction, { once: true });
// --------------------------------------------------------------------

// <<< ADD THIS FUNCTION DEFINITION >>>
// Simple function to trigger the score redraw immediately when called
function updateScoreDisplay() {
    // We don't need to do anything complex here,
    // just ensure the main drawScore function (called in gameLoop)
    // has the updated 'score' value next time it runs.
    // However, if you want the score to visually update *instantly*
    // without waiting for the next gameLoop frame, you could call drawScore here.
    // Calling drawScore() here might draw the score twice per frame briefly (here and in gameLoop)
    // but ensures immediate visual feedback upon passing an obstacle.
    // For simplicity and to match the previous code's apparent intent, let's leave it empty
    // OR call drawScore if immediate update is desired despite potential double-draw.

    // Option A: Do nothing here, gameLoop's drawScore will handle it. (Recommended for cleanliness)
        // The score variable is already updated globally.

    // Option B: Call drawScore for immediate visual update (might draw score twice in one frame).
    // drawScore();                 // Uncomment this line if you want instant visual update

    // Option C: If you had a dedicated HTML element for score, you'd update its text content here.
}

// --- Web Audio API Setup ---
let audioContext; // The main context for Web Audio

// Function to initialize AudioContext (call after user interaction)
// MODIFY initAudioContext to return a Promise indicating readiness
async function initAudioContext() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!window.AudioContext) {
             console.error("Web Audio API is not supported in this browser");
             alert("Web Audio API is not supported in this browser");
             return false; // Indicate failure
        }

        if (!audioContext) {
            audioContext = new AudioContext();
            console.log("AudioContext created.");
        }

        if (audioContext.state === 'suspended') {
            console.log("AudioContext suspended, attempting to resume...");
            await audioContext.resume(); // Wait for resume to complete
             if(audioContext.state === 'running') {
                 console.log("AudioContext resumed successfully.");
                 return true; // Indicate success
             } else {
                 console.error("AudioContext failed to resume.");
                 return false; // Indicate failure
             }
        } else if (audioContext.state === 'running') {
             console.log("AudioContext already running.");
             return true; // Indicate success (already running)
        } else {
             console.warn(`AudioContext in unexpected state: ${audioContext.state}`);
             return false; // Indicate potential issue
        }
    } catch (e) {
        console.error("Error during AudioContext initialization/resume:", e);
        return false; // Indicate failure
    }
}

// Function to load and decode a sound file
// MODIFY loadSound to use Capacitor HTTP if available, fallback to fetch
async function loadSound(url) {
    if (!audioContext) {
        console.error("AudioContext not initialized. Cannot load sound:", url);
        return null;
    }

    let arrayBuffer = null;
    console.log(`Attempting to load sound: ${url}`);

    // ---- ADD DETAILED LOGGING ----
    console.log(`Checking for Capacitor: ${typeof window.Capacitor !== 'undefined'}`);
    if (typeof window.Capacitor !== 'undefined') {
        console.log(`Checking for Capacitor.Plugins: ${typeof window.Capacitor.Plugins !== 'undefined'}`);
        if (typeof window.Capacitor.Plugins !== 'undefined') {
            console.log(`Checking for Capacitor.Plugins.Http: ${typeof window.Capacitor.Plugins.Http !== 'undefined'}`);
            // Also log the Http object itself if it exists
            if (typeof window.Capacitor.Plugins.Http !== 'undefined') {
                 console.log('Capacitor.Plugins.Http object:', window.Capacitor.Plugins.Http);
            }
        }
    }
    // ------------------------------

    // Check if Capacitor's Http plugin is available
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Http) {
        console.log("Using Capacitor Http plugin to load sound.");
        try {
            const { Http } = window.Capacitor.Plugins;
            // --- Convert relative path to absolute Capacitor URL --- <<< ADD THIS
            const capacitorUrl = Capacitor.convertFileSrc(url);
            console.log(`Converted '${url}' to Capacitor URL: ${capacitorUrl}`); // Log the converted URL
            // --------------------------------------------------------
            const response = await Http.request({
                method: 'GET',
                url: capacitorUrl, // <<< USE THE CONVERTED URL
                responseType: 'arraybuffer' // Request raw data
            });

            // Capacitor Http plugin returns data differently depending on platform
            // We need the raw ArrayBuffer.
            // Check response.data format (might be base64 string or already ArrayBuffer)
            if (typeof response.data === 'string') {
                // If it's a base64 string, decode it
                const byteString = atob(response.data);
                const len = byteString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = byteString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
                console.log(`Capacitor Http: Decoded base64 for ${url}`);
            } else if (response.data instanceof ArrayBuffer) {
                arrayBuffer = response.data;
                console.log(`Capacitor Http: Received ArrayBuffer directly for ${url}`);
            } else {
                 throw new Error('Unexpected response data format from Capacitor Http');
            }

        } catch (httpError) {
            console.error(`Capacitor Http failed for ${url}:`, httpError);
            // Fallback to fetch might not work due to the original CORS issue, but include anyway
            console.warn(`Capacitor Http failed, attempting fallback with fetch for ${url}...`);
        }
    }

    // Fallback to fetch if Capacitor Http is not available or failed
    if (!arrayBuffer) {
        console.log(`Using fetch API (fallback) for ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Fetch HTTP error! status: ${response.status} for ${url}`);
            }
            arrayBuffer = await response.arrayBuffer();
        } catch (fetchError) {
            console.error(`Fetch API failed for ${url}:`, fetchError);
            return null; // Failed to load via both methods
        }
    }

    // --- Decode the ArrayBuffer (common logic) ---
    if (!arrayBuffer) {
        console.error(`Failed to obtain ArrayBuffer for ${url}`);
        return null;
    }

    try {
        console.log(`Attempting to decode audio data for: ${url}`);
        if (audioContext.decodeAudioData.length === 1) { // Modern Promise-based syntax
            const decodedData = await audioContext.decodeAudioData(arrayBuffer);
            console.log(`Sound loaded and decoded successfully: ${url}`);
            return decodedData;
        } else { // Fallback for older callback syntax
            return new Promise((resolve, reject) => {
                audioContext.decodeAudioData(arrayBuffer, resolve, reject);
            }).then(decodedData => {
                console.log(`Sound loaded and decoded successfully (callback): ${url}`);
                return decodedData;
            });
        }
    } catch (decodeError) {
        console.error(`Error decoding sound ${url}:`, decodeError);
        return null; // Indicate failure
    }
}

// ADD consolidated sound loading function
async function loadGameSounds() {
    if (!audioContext || audioContext.state !== 'running') {
        console.error("Cannot load sounds: AudioContext not ready.");
        return;
    }
    console.log("Loading game sounds...");
    try {
        // Use Promise.all to load sounds concurrently
        [
            coinSoundBuffer,
            wingSoundBuffer,
            punchSoundBuffer,
            dieSoundBuffer,
            backgroundMusicBuffer
        ] = await Promise.all([
            loadSound('sounds/point.wav'),
            loadSound('sounds/wing.wav'),
            loadSound('sounds/hit.wav'),
            loadSound('sounds/die.wav'), // Load die sound
            loadSound('sounds/skyrim-snes.mp3') // Load background music
        ]);

        // Check if all sounds loaded (optional)
        if (coinSoundBuffer && wingSoundBuffer && punchSoundBuffer && dieSoundBuffer && backgroundMusicBuffer) {
            console.log("All sounds loaded successfully.");
        } else {
            console.warn("One or more sounds failed to load.");
        }
    } catch (error) {
        console.error("Error loading one or more sounds:", error);
    }
}

// Function to play a sound from a buffer
// MODIFY playSoundFromBuffer to handle looping and return the source node
function playSoundFromBuffer(buffer, loop = false) {
    if (!audioContext || audioContext.state !== 'running' || !buffer) {
        if (audioContext && audioContext.state === 'suspended') {
            console.log("AudioContext suspended, attempting resume to play sound...");
             audioContext.resume().then(() => {
                 if(audioContext.state === 'running') playSoundFromBuffer(buffer, loop); // Retry
             });
        } else {
            console.warn("Cannot play sound: AudioContext not running or buffer missing.");
        }
        return null; // Indicate failure or context not ready
    }

    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = loop; // Set the loop property
    sourceNode.connect(audioContext.destination);
    sourceNode.start(0);
    // console.log(`Playing sound from buffer. Loop: ${loop}`);
    return sourceNode; // Return the node so it can be controlled (e.g., stopped)
}

// ADD function to stop background music
function stopBackgroundMusic() {
    if (backgroundMusicSourceNode) {
        try {
            backgroundMusicSourceNode.stop(); // Stop playback
            console.log("Background music stopped.");
        } catch (e) {
            // May throw if called multiple times or in certain states
            console.warn("Error stopping background music node:", e);
        }
        backgroundMusicSourceNode = null; // Clear the reference
    }
}

// --- Add User Interaction Listener to Ensure AudioContext Starts ---
// REMOVE the duplicate listeners at the end, keep the ones added earlier.
// function handleFirstInteraction() { ... } // Already defined earlier
// window.addEventListener('click', handleFirstInteraction, { once: true }); // Already added earlier
// window.addEventListener('touchstart', handleFirstInteraction, { once: true }); // Already added earlier
// window.addEventListener('keydown', handleFirstInteraction, { once: true }); // Already added earlier
// --------------------------------------------------------------------