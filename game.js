// Declare canvas and ctx in the global scope
let canvas;
let ctx;
let isWindowLoaded = false; // <-- Add this flag

// --- Game Constants ---
const GRAVITY = 1500;  // Pixels per second per second (adjust significantly upwards)
const LIFT = -350;     // Pixels per second (instantaneous velocity change, adjust magnitude)
const BEHOLDER_SIZE = 50;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_COLLISION_WIDTH_FACTOR = 0.6; // Keep this from previous step
const OBSTACLE_GAP = 180;
const OBSTACLE_SPEED = 125; // Pixels per second (adjust)
const OBSTACLE_SPAWN_DISTANCE = 200;
const ANIMATION_THROTTLE = 20; // Keep animation frame-based for now, or adjust later
const MAX_UP_ROTATION_DEG = -15; // Max upward tilt in degrees (negative for up)
const MAX_DOWN_ROTATION_DEG = 80;  // Max downward tilt in degrees
const ROTATION_VELOCITY_SCALE = 600; // Lower value = more sensitive rotation to velocity changes (tune this!)

// --- Image Loading Management ---
let imagesLoaded = 0;
const totalImages = 7; // <<< INCREMENT totalImages (Beholder x3, Obstacles x2, Background, Ground)
let allImagesLoaded = false;
let audioContext = null; // <<< ADD: Web Audio API context
let audioBuffers = {}; // <<< ADD: To store decoded audio data
const soundFiles = { // <<< ADD: Map keys to sound file paths
    wing: 'sounds/wing.wav',
    coin: 'sounds/point.wav',
    hit: 'sounds/hit.wav',
    die: 'sounds/die.wav'
};
let soundsLoaded = 0; // <<< ADD: Counter for loaded sounds
const totalSounds = Object.keys(soundFiles).length; // <<< ADD: Total number of sounds
let allSoundsLoaded = false; // <<< ADD: Flag for sound loading completion
let isAudioContextResumed = false; // <<< ADD: Flag for AudioContext state

function imageLoaded() {
    imagesLoaded++;
    console.log(`Image ${imagesLoaded}/${totalImages} loaded.`);
    startGameIfReady();
}

// <<< ADD: Function to handle sound loading completion
function soundLoaded(soundKey) {
    soundsLoaded++;
    console.log(`Sound '${soundKey}' (${soundsLoaded}/${totalSounds}) loaded.`);
    if (soundsLoaded === totalSounds) {
        allSoundsLoaded = true;
        console.log("All sounds loaded.");
        startGameIfReady(); // Check if images are also ready
    }
}

// <<< ADD: Function to load a single audio file
async function loadAudioFile(key, url) {
    if (!audioContext) return; // Don't load if context creation failed

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBuffers[key] = audioBuffer;
        soundLoaded(key); // Increment counter and check completion
    } catch (error) {
        console.error(`Error loading sound '${key}' (${url}):`, error);
        // Optionally, handle the error differently, e.g., set a flag or use a fallback sound
        // For now, we just log the error and count it as 'loaded' to not block the game,
        // but the sound won't be playable.
        soundLoaded(key);
    }
}

// <<< ADD: Function to load all sounds
function loadAllSounds() {
    console.log("Starting to load sounds...");
    // Initialize AudioContext here, preferably on first user interaction,
    // but we'll try initializing it now and resume later.
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext created successfully.");
    } catch (e) {
        console.error("Web Audio API is not supported in this browser or context creation failed:", e);
        // If AudioContext fails, we can't load/play sounds via Web Audio API.
        // Set allSoundsLoaded to true to prevent blocking the game start,
        // although sounds won't work.
        allSoundsLoaded = true;
        soundsLoaded = totalSounds; // Mark as 'loaded' to satisfy startGameIfReady
        return; // Exit if context fails
    }

    for (const key in soundFiles) {
        loadAudioFile(key, soundFiles[key]);
    }
}

// --- Game Variables ---
let beholderX, beholderY, velocityY;
let obstacles = [];
let score = 0;
let frameCount = 0; // Used for animation throttling
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let animationFrameIndex = 0; // Index for beholder animation frames
let groundX = 0; // <<< ADD: X position of the scrolling ground
let groundY = 0; // <<< ADD: Y position of the ground (calculated later)
const GROUND_HEIGHT = 50; // <<< ADD: Adjust based on your base.png height if needed

// --- Load Images ---
const beholderImg = new Image();
const beholderDownFlapImg = new Image();
const beholderUpFlapImg = new Image();
const stalactiteImg = new Image(); // Top obstacle
const stalagmiteImg = new Image(); // Bottom obstacle image
const backgroundImg = new Image();
const groundImg = new Image(); // Ground image object

// --- Load Sounds ---
// REMOVE OLD AUDIO OBJECT CREATION
// const wingSound = new Audio('sounds/wing.wav');
// const coinSound = new Audio('sounds/point.wav');
// const punchSound = new Audio('sounds/hit.wav');
// const dieSound = new Audio('sounds/die.wav');
// Preload suggestion (optional, helps ensure sounds are ready)
// wingSound.load();
// coinSound.load();
// punchSound.load();

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

// <<< CALL loadAllSounds here after assigning image sources >>>
loadAllSounds();

// --- Game Initialization ---
function resetGame() {
    beholderY = canvas.height / 2;
    velocityY = 0;
    obstacles = [];
    score = 0;
    gameState = 'start';
    frameCount = 0;
    animationFrameIndex = 0; // Reset animation index
    groundX = 0; // Reset ground scroll position
    // Calculate initial groundY based on constant or potentially loaded image if available NOW
    groundY = (groundImg.complete && groundImg.naturalHeight !== 0) ? canvas.height - groundImg.naturalHeight : canvas.height - GROUND_HEIGHT;
    console.log("Game Reset");
}

function spawnInitialObstacles() {
     // Start first obstacle further out
    addObstacle(canvas.width + 100);
    addObstacle(canvas.width + 100 + OBSTACLE_SPAWN_DISTANCE);
    addObstacle(canvas.width + 100 + 2 * OBSTACLE_SPAWN_DISTANCE);
}

// --- Helper Function ---
function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

// <<< MODIFY playSound FUNCTION >>>
function playSound(soundKey) {
    // Check if context exists, is resumed, and buffer is loaded
    if (!audioContext || !isAudioContextResumed || !audioBuffers[soundKey]) {
        if (!audioContext) console.warn(`Cannot play sound '${soundKey}', AudioContext not available.`);
        else if (!isAudioContextResumed) console.warn(`Cannot play sound '${soundKey}', AudioContext not resumed (requires user interaction).`);
        else if (!audioBuffers[soundKey]) console.warn(`Cannot play sound '${soundKey}', buffer not loaded or loading failed.`);
        return;
    }

    try {
        const source = audioContext.createBufferSource(); // Create sound source
        source.buffer = audioBuffers[soundKey];         // Assign the buffer
        source.connect(audioContext.destination);       // Connect to speakers
        source.start(0);                                // Play immediately
    } catch (error) {
        console.error(`Error playing sound '${soundKey}':`, error);
    }
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
        if (gameState === 'gameOver' && beholderY >= groundY - BEHOLDER_SIZE / 2) {
            beholderY = groundY - BEHOLDER_SIZE / 2; // Pin to TOP of ground image
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
        if (gameState === 'gameOver' && beholderY >= groundY - BEHOLDER_SIZE / 2) {
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
        const centerX = canvas.width / 3;
        const centerY = beholderY;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationAngle);
        ctx.drawImage(
            imageToDraw, // Use the selected image
            -BEHOLDER_SIZE / 2,
            -BEHOLDER_SIZE / 2,
            BEHOLDER_SIZE,
            BEHOLDER_SIZE
        );
        ctx.restore();
    }
}

function Obstacle(x, gapTopY) {
    this.x = x;
    this.topHeight = gapTopY;
    this.bottomY = this.topHeight + OBSTACLE_GAP;
    this.bottomHeight = Math.max(0, groundY - this.bottomY);
    this.scored = false;

    this.draw = function() {
        // Draw top obstacle (Stalactite)
        if (stalactiteImg.complete && stalactiteImg.naturalHeight !== 0) {
            ctx.drawImage(stalactiteImg, this.x, 0, OBSTACLE_WIDTH, this.topHeight);
        }

        // Draw bottom obstacle (Stalagmite) - starts at bottomY, height fills to groundY
        if (stalagmiteImg.complete && stalagmiteImg.naturalHeight !== 0) {
            // Draw the pillar image starting from its calculated top edge down towards the ground
            ctx.drawImage(stalagmiteImg, this.x, this.bottomY, OBSTACLE_WIDTH, this.bottomHeight);
        }
    };

    this.update = function(deltaTime) {
        this.x -= OBSTACLE_SPEED * deltaTime;

        // --- Scoring Check ---
        let collisionX = canvas.width / 3;
        let beholderRightEdgeForScore = collisionX + BEHOLDER_SIZE * 0.5;

        if (!this.scored && (this.x + OBSTACLE_WIDTH) < beholderRightEdgeForScore) {
                score++;
                playSound('coin'); // <<< UPDATE: Use sound key 'coin'
                this.scored = true;
                console.log("Score:", score); // Keep for debugging
        }
    };
}

function addObstacle(startX) {
    // Calculate random Y position for the top of the gap
    const minGapTop = 50; // Minimum distance from the top edge
    const maxGapTop = groundY - OBSTACLE_GAP - 50; // Adjusted max gap top calculation

    let gapTopY;

    // Ensure minGapTop is less than maxGapTop to prevent errors
    if (minGapTop >= maxGapTop) {
        // This error *shouldn't* happen now, but keep it as a safeguard
        console.error(`Obstacle GAP calculation error. minGapTop: ${minGapTop}, maxGapTop: ${maxGapTop} (groundY: ${groundY}, OBSTACLE_GAP: ${OBSTACLE_GAP}). Using fallback.`);
        gapTopY = canvas.height / 2 - OBSTACLE_GAP / 2; // Center the gap vertically
    } else {
        // Calculate the random top position for the gap
        gapTopY = Math.random() * (maxGapTop - minGapTop) + minGapTop;
    }

    // Pass BOTH startX and the calculated gapTopY to the constructor
    obstacles.push(new Obstacle(startX, gapTopY));
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
    const beholderCenterX = canvas.width / 3;
    const beholderRadius = (BEHOLDER_SIZE / 2) * OBSTACLE_COLLISION_WIDTH_FACTOR; // Effective collision radius
    const beholderTop = beholderY - beholderRadius;
    const beholderBottom = beholderY + beholderRadius;

    // --- Check Ground Collision ---
    // Ground collision ONLY triggers game over if not already over
    if (beholderBottom >= groundY && gameState !== 'gameOver') {
        console.log("Ground collision!");
        setGameOverState(); // Use the dedicated function
        playSound('hit'); // Play hit sound immediately on ground impact
        // Note: setGameOverState also plays the 'die' sound
        return true; // Collision detected
    }

    // --- Check Obstacle Collision ---
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        const beholderLeft = beholderCenterX - beholderRadius;
        const beholderRight = beholderCenterX + beholderRadius;
        const obsRight = obs.x + OBSTACLE_WIDTH;

        // Basic X overlap check first (more efficient)
        if (beholderRight > obs.x && beholderLeft < obsRight) {
            // Check Y collision (hit top pipe OR bottom pipe)
            if (beholderTop < obs.topHeight || beholderBottom > obs.bottomY) {
                console.log("Obstacle Collision Detected!");
                setGameOverState(); // Use the dedicated function
                playSound('hit'); // Play hit sound on obstacle impact
                // Note: setGameOverState also plays the 'die' sound
                return true; // Collision detected
            }
        }
    }

    // --- Check Top Boundary Collision ---
    if (beholderTop < 0 && gameState !== 'gameOver') { // Hit the top ceiling
        console.log("Top boundary collision!");
        setGameOverState(); // Use the dedicated function
        playSound('hit'); // Play hit sound on ceiling impact
        // Note: setGameOverState also plays the 'die' sound
        return true;
    }

    return false; // No collision detected
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click or Press Space to Start', canvas.width / 2, canvas.height / 2);
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Darker overlay
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '25px Arial';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillText('Click or Space to Restart', canvas.width / 2, canvas.height / 2 + 40);
}

function setGameOverState() {
    if (gameState !== 'gameOver') { // Prevent multiple triggers
        gameState = 'gameOver';
        console.log("Game Over");
        // Play die sound when game over state is set
        playSound('die'); // <<< Play 'die' sound on game over
    }
}

// --- Input Handling ---
function handleInput(event) {
    // --- Resume Audio Context on First Interaction --- <<<
    handleFirstInteraction(); // Call this first on any interaction

    if (gameState === 'start') {
        gameState = 'playing';
        // Spawn initial obstacles only when transitioning from start to playing
        spawnInitialObstacles();
        velocityY = LIFT; // Give initial flap
        playSound('wing');
    } else if (gameState === 'playing') {
        velocityY = LIFT; // Apply upward velocity
        playSound('wing'); // <<< UPDATE: Use sound key 'wing'
    } else if (gameState === 'gameOver') {
        // Only reset if the game is actually over
        resetGame();
        // No need to spawn obstacles here, resetGame clears them,
        // and handleInput will call spawnInitialObstacles when moving to 'playing'
    }

    // Prevent default for spacebar keydown if that's the event type
    if (event && event.type === 'keydown' && event.code === 'Space') {
        event.preventDefault();
    }
}

function handleFirstInteraction() {
    // Only attempt to resume if context exists and is suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log("AudioContext resumed successfully!");
            isAudioContextResumed = true;
        }).catch(e => {
            console.error("Failed to resume AudioContext:", e);
        });
    } else if (audioContext && audioContext.state === 'running') {
         isAudioContextResumed = true; // Already running
    } // No warning if context doesn't exist, as loadAllSounds handles that
}

// <<< DEFINE initGame FUNCTION >>>
function initGame() {
    console.log("Initializing game...");
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

    // Calculate groundY based on image (if loaded) or constant
    groundY = (groundImg.complete && groundImg.naturalHeight !== 0)
                ? canvas.height - groundImg.naturalHeight
                : canvas.height - GROUND_HEIGHT;

    // Setup animation frames (should be safe now as images are loaded)
    setupAnimationFrames();

    // --- Setup Event Listeners --- <<< Moved inside initGame
    // Use named function for removal/prevention of multiple listeners if needed later
    const keydownHandler = (event) => {
        if (event.code === 'Space') {
            handleInput(event); // Pass event for potential preventDefault
        }
        // Add other key handlers here if needed (e.g., pause P key)
        if (event.code === 'KeyP') {
             togglePause(); // Add pause toggle on P key
        }
    };
    const interactionHandler = (event) => {
        handleInput(event); // Pass event for potential preventDefault in touch
    };

    // Clear previous listeners if re-initializing (optional but good practice)
    document.removeEventListener('keydown', keydownHandler);
    canvas.removeEventListener('click', interactionHandler);
    canvas.removeEventListener('touchstart', interactionHandler);

    // Add listeners
    document.addEventListener('keydown', keydownHandler);
    canvas.addEventListener('click', interactionHandler);
    canvas.addEventListener('touchstart', interactionHandler, { passive: false });

    // --- Initial Game State Setup ---
    resetGame();
    lastTime = 0; // Reset lastTime for the new game loop start
    isPaused = false; // Ensure game is not paused initially

    // --- Start the Game Loop ---
    requestAnimationFrame(gameLoop);
    console.log("Game initialized and loop started.");
}

// --- Main Game Loop ---
let lastTime = 0;
let isPaused = false; // Ensure isPaused is defined in an accessible scope

function gameLoop(currentTime) {
    if (lastTime === 0) {
        lastTime = currentTime; // Initialize lastTime on the first frame
        requestAnimationFrame(gameLoop);
        return;
    }

    const deltaTime = (currentTime - lastTime) / 1000; // Delta time in seconds

    // --- Update Game State ---
    if (gameState === 'playing') {
        frameCount++; // Increment frame counter
        updateObstacles(deltaTime);
        updateGround(deltaTime); // <<< Update ground scroll
        // Check for collisions AFTER updating positions
        if (checkCollisions()) {
             // setGameOverState handles changing gameState and playing sounds
             // No need to directly change gameState here anymore
        }
    }

    // --- Draw Game Objects ---
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw background first
    drawBackground();
    // Draw obstacles
    obstacles.forEach(obstacle => obstacle.draw());
    // Draw Ground (Scrolling)
    drawGround(); // <<< Draw the scrolling ground
    // Draw score LAST so it's on top
    drawScore();
    // Draw Beholder (allows drawing over ground when falling in gameOver)
    Beholder(deltaTime); // <<< Draw beholder AFTER ground/obstacles

    // --- Game State Specific Drawing ---
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'gameOver') {
        drawGameOverScreen();
    }

    // Request next frame
    lastTime = currentTime; // Update lastTime for the next frame
    if (!isPaused) { // <<< Check pause state before requesting next frame
        requestAnimationFrame(gameLoop);
    } else {
        console.log("Game loop paused.");
    }
}

// --- Add Ground Update Function ---
function updateGround(deltaTime) {
    groundX -= OBSTACLE_SPEED * deltaTime;
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

// --- Pause Functionality ---
function togglePause() {
    isPaused = !isPaused;
    console.log(`Game ${isPaused ? 'paused' : 'resumed'}.`);
    if (!isPaused) {
        // If resuming, reset lastTime and request the next frame immediately
        lastTime = 0; // Reset lastTime to avoid large deltaTime jump
        requestAnimationFrame(gameLoop);
    }
    // No need to call pause for audio context, source nodes play once and stop.
}

// Wait for the DOM to be fully loaded before trying to get canvas
// This listener now just triggers the asset loading check
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded.");
    // We don't call initGame directly here anymore.
    // Instead, we rely on images/sounds loading and the window load event
    // to eventually call startGameIfReady -> initGame.
    // Ensure the load checkers are called in case assets loaded before DOM.
    startGameIfReady();
});

// Wait for the window (including images, scripts) to load
window.addEventListener('load', () => {
    console.log("Window finished loading.");
    isWindowLoaded = true;
    startGameIfReady(); // Check if assets are also ready
});