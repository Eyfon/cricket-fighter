import controllerHTML from "./html.js"

function setupMobileControls(texts) {
    const controls = document.createElement('div');
    controls.id = 'mobile-controls';

    // HTML Structure (Unchanged)
    controls.innerHTML = controllerHTML(texts);

    document.body.appendChild(controls);

    // --- NEW MULTI-TOUCH & SLIDE LOGIC ---
    // We track which keys are currently "held" by virtual fingers
    let heldKeys = new Set();

    const triggerEvent = (key, type) => {
        const event = new KeyboardEvent(type, {
            key: key,
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(event);
    };

    const handleTouch = (e) => {
        // Prevent default browser zooming/scrolling behavior
        if (e.type !== 'touchend') e.preventDefault();

        // 1. Identify which keys should be active RIGHT NOW based on finger positions
        const currentFrameKeys = new Set();
        const activeElements = new Set();

        // Loop through every finger currently touching the screen
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];

            // key magic: Find the element under this specific finger
            let el = document.elementFromPoint(touch.clientX, touch.clientY);

            // CHeck if element is a proper button
            const check = el.classList.contains('control-btn');
            if (!check) el = el.closest('.control-btn')

            if (el && el.classList.contains('control-btn')) {
                const key = el.dataset.key;
                currentFrameKeys.add(key);
                activeElements.add(el);

                // Visual feedback
                el.classList.add('pressed');
            }
        }

        // 2. Diff Logic: Determine what changed since last frame
        // A. Keys that were held but are NO LONGER under a finger -> RELEASE
        heldKeys.forEach(key => {
            if (!currentFrameKeys.has(key)) {
                triggerEvent(key, 'keyup');
                console.log("Keyup", key)
                // Find the button with this key to remove visual style
                // (We querySelector because elementFromPoint might not find it anymore)
                const btns = controls.querySelectorAll(`[data-key="${key}"]`);
                if (btns) btns.forEach(btn => btn.classList.remove('pressed'));
            }
        });

        // B. Keys that are now under a finger but weren't before -> PRESS
        currentFrameKeys.forEach(key => {
            if (!heldKeys.has(key)) {
                triggerEvent(key, 'keydown');
                if (navigator.vibrate) navigator.vibrate(10);
            }
        });

        // 3. Update state for next frame
        heldKeys = currentFrameKeys;
        console.log("Keys", heldKeys)
    };

    // Attach listeners to the CONTAINER, not individual buttons
    // This allows dragging fingers between buttons
    controls.addEventListener('touchstart', handleTouch, { passive: false });
    controls.addEventListener('touchmove', handleTouch, { passive: false });
    controls.addEventListener('touchend', handleTouch, { passive: false });
    controls.addEventListener('touchcancel', handleTouch, { passive: false });
}

export default setupMobileControls;