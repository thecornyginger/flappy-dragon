// Declare canvas and ctx in the global scope
let canvas;
let ctx;
let isWindowLoaded = false; // <-- Add this flag

// --- Game Constants ---
const GRAVITY = 0.15;
const LIFT = -4;
const BEHOLDER_SIZE = 50;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_COLLISION_WIDTH_FACTOR = 0.6; // Keep this from previous step
const OBSTACLE_GAP = 150;
const OBSTACLE_SPEED = 1.5; // Keep slowed-down speed
const OBSTACLE_SPAWN_DISTANCE = 200;
const ANIMATION_SPEED = 15; // Change frame every 5 game loops (adjust as needed)

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
    beholderVelY = 0;
    score = 0;
    obstacles = [];
    frameCount = 0;
    gameState = 'start';
    animationFrameIndex = 0; // Reset animation frame on game reset
    spawnInitialObstacles();
    isGameOver = false;
}

function spawnInitialObstacles() {
     // Start first obstacle further out
    addObstacle(canvas.width + 100);
    addObstacle(canvas.width + 100 + OBSTACLE_SPAWN_DISTANCE);
    addObstacle(canvas.width + 100 + 2 * OBSTACLE_SPAWN_DISTANCE);
}

// --- Game Objects ---
function Beholder() {

    // --- Update Animation Frame ---
    // (Keep this animation logic exactly as it is)
    if (gameState === 'playing' || gameState === 'start') {
        if (frameCount % ANIMATION_SPEED === 0) {
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


    // --- Updating Position (Keep this logic) ---
    // (Keep the position update logic exactly as it is)
    if (gameState === 'playing') {
        beholderVelY += GRAVITY;
        beholderY += beholderVelY;
    }
    if (gameState === 'start') {
         beholderY = canvas.height / 2 + Math.sin(frameCount * 0.1) * 5;
         beholderVelY = 0;
    }
} // End of Beholder function

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
        this.x -= OBSTACLE_SPEED;

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

// --- Game Loop ---
function gameLoop() {
    if (!ctx || !canvas) {
        console.error("Canvas or context missing in gameLoop!");
        return;
    }

    // 1. Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Background FIRST
    drawBackground();

    // 3. Update and Draw Obstacles (Needs logic based on state)
    // Iterate backwards to safely remove obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];

        // Draw obstacles in both 'start' and 'playing' states
        if (gameState === 'start' || gameState === 'playing') {
             obs.draw();
        }

        // Only update position and check scoring/removal in 'playing' state
        if (gameState === 'playing') {
            obs.update();

            // Remove obstacles that have gone off-screen
            if (obs.x + OBSTACLE_WIDTH < 0) {
                obstacles.splice(i, 1);
            }
        }
    }

     // Add new obstacles only when playing
    if (gameState === 'playing') {
        // Check if it's time to spawn a new obstacle based on the last one
        if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - OBSTACLE_SPAWN_DISTANCE) {
             addObstacle(canvas.width);
        }
    }


    // 4. Draw & Update Beholder (handles animation internally)
    Beholder(); // Make sure Beholder() updates position based on gameState

    // 5. Draw Score
    drawScore();

    // 6. Handle Game States (Drawing overlays, checking collisions)
    if (gameState === 'playing') {
        if (checkCollisions()) { // checkCollisions needs to use the 'obstacles' array
            gameState = 'gameOver';
            frameCount = 0;
        }
        frameCount++;
    } else if (gameState === 'start') {
        drawStartScreen(); // Draw overlay
        frameCount++;
    } else if (gameState === 'gameOver') {
        drawGameOverScreen(); // Draw overlay
        frameCount++;
    }

    // 7. Request Next Frame
    requestAnimationFrame(gameLoop);
}

function startGameIfReady() {
    // This function checks if both conditions are met
    if (isWindowLoaded && imagesLoaded === totalImages) {
        // Both window and images are loaded, safe to start the game loop
        requestAnimationFrame(gameLoop);
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