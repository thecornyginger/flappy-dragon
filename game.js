// Declare canvas and ctx in the global scope
let canvas;
let ctx;
let isWindowLoaded = false; // <-- Add this flag

// --- Game Constants ---
const GRAVITY = 1800;  // Pixels per second per second (adjust significantly upwards)
const LIFT = -500;     // Pixels per second (instantaneous velocity change, adjust magnitude)
const BEHOLDER_SIZE = 50;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_COLLISION_WIDTH_FACTOR = 0.6; // Keep this from previous step
const OBSTACLE_GAP = 180;
const OBSTACLE_SPEED = 125; // Pixels per second (adjust)
const OBSTACLE_SPAWN_DISTANCE = 150;
const ANIMATION_THROTTLE = 20; // Keep animation frame-based for now, or adjust later
const MAX_UP_ROTATION_DEG = -15; // Max upward tilt in degrees (negative for up)
const MAX_DOWN_ROTATION_DEG = 80;  // Max downward tilt in degrees
const ROTATION_VELOCITY_SCALE = 600; // Lower value = more sensitive rotation to velocity changes (tune this!)

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
let score = 0;
let highScore = 0; // <<< ADD High Score variable
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
const wingSound = new Audio('sounds/wing.wav'); // Replace with your actual file path
const coinSound = new Audio('sounds/point.wav'); // Replace with your actual file path
const punchSound = new Audio('sounds/hit.wav'); // Replace with your actual file path
const dieSound = new Audio('sounds/die.wav'); // <<< ADD Die sound object
const backgroundMusic = new Audio('sounds/skyrim-snes.mp3'); // <<< ADD Background Music
backgroundMusic.loop = true; // <<< Set music to loop
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

    // Stop and reset music on game reset
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;

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

// <<< ADD THIS HELPER FUNCTION >>>
function playSound(soundSrc) { // Modified: Takes sound source URL
    // Create a new audio object each time
    const sound = new Audio(soundSrc);
    // Play the sound
    sound.play().catch(error => {
        // Autoplay policies might prevent sound initially until user interaction
        console.warn("Sound play failed (likely requires user interaction first):", error);
    });
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
                playSound(coinSound.src); // <<< Play coin sound on score increase (Modified: Pass .src)
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
    const beholderX = canvas.width / 3;
    const beholderLeft = beholderX - (BEHOLDER_SIZE / 2);
    const beholderRight = beholderX + (BEHOLDER_SIZE / 2);
    const beholderTop = beholderY - (BEHOLDER_SIZE / 2);
    const beholderBottom = beholderY + (BEHOLDER_SIZE / 2);

    // Check collision with top boundary
    if (beholderTop < 0) {
         console.log("Top Boundary Collision");
        return true;
    }

    // --- Check collision with GROUND --- <<< MODIFIED
    if (beholderBottom >= groundY) { // Check if beholder hits or goes below ground level
         console.log("Ground Collision");
        // Set position exactly to ground to prevent sinking further before state change
         beholderY = groundY - BEHOLDER_SIZE / 2;
         velocityY = 0; // Stop downward movement immediately
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
        playSound(wingSound.src); // <<< Play wing sound on flap/click/tap (Modified: Pass .src)

        if (gameState === 'start') {
            gameState = 'playing';
            // Start background music only when transitioning from start to playing
            backgroundMusic.play().catch(e => console.warn("Background music playback failed:", e));
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
            if (obs.x + OBSTACLE_WIDTH < 0) {
                obstacles.splice(i, 1);
            }
        }
    }

    // Add new obstacles only when playing
    if (gameState === 'playing') {
         if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - OBSTACLE_SPAWN_DISTANCE) {
             addObstacle(canvas.width);
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
            gameState = 'gameOver';
            backgroundMusic.pause(); // <<< STOP Music
            backgroundMusic.currentTime = 0; // <<< Reset music time
            playSound(punchSound.src); // <<< Play punch sound when collision occurs (Modified: Pass .src)
            playSound(dieSound.src);   // <<< MOVED Play die sound here
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

    // Initial estimate is less critical now, but doesn't hurt
    groundY = canvas.height - GROUND_HEIGHT;

    // <<< ADD Load High Score >>>
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

    // Call resetGame AFTER canvas is defined (this call is correct)
    resetGame(); // Keep this call inside window.onload

    // Initialize other game objects AFTER canvas is defined
    // dragon = new Dragon(50, canvas.height / 2); // Example
    // pipes = new Pipes(canvas); // Example

    // Setup animation frames AFTER images are loaded (potentially already loaded)
    // Or ensure setupAnimationFrames is robust enough if called before load complete
    setupAnimationFrames();

    isWindowLoaded = true;
    startGameIfReady();
};

// --- Assuming you have an AudioContext initialized somewhere ---
// const audioContext = new (window.AudioContext || window.webkitAudioContext)();
// let sounds = { /* ... your loaded sounds ... */ };
// let isAudioContextResumed = false; // Flag to resume only once

// --- Example: In your game start or first interaction handler ---
function handleFirstInteraction() {
    if (audioContext && audioContext.state === 'suspended' && !isAudioContextResumed) {
        audioContext.resume().then(() => {
            console.log("AudioContext resumed successfully.");
            isAudioContextResumed = true;
            // Potentially play a short, silent sound here to ensure it's fully 'awake'
        }).catch(e => console.error("Error resuming AudioContext:", e));
    }
    // ... other interaction logic (e.g., flap, startGame) ...
}

// Add this handler to your initial interaction listener
// E.g., canvas.addEventListener('click', handleFirstInteraction, { once: true });
// E.g., document.addEventListener('keydown', handleFirstInteraction, { once: true }); // if spacebar starts