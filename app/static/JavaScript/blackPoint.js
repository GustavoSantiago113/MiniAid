// Crop mode variables for black point
let blackPointCropMode = false;
let blackPointCropRect = null;
let blackPointCropStartX = 0;
let blackPointCropStartY = 0;
let blackPointIsDrawing = false;
// Display info for the rendered image inside the container
let blackPointDisplayInfo = null;

async function openBlackPointModal(imageSrc) {
    const modal = document.getElementById("blackPointModal");
    const blackPointImage = document.getElementById("blackPointImage");
    const slider = document.getElementById("blackPointSlider");
    const sliderValue = document.getElementById("blackPointValue");

    blackPointImage.src = imageSrc;
    loadedModalImage = imageSrc;

    // Reset crop state
    blackPointCropMode = false;
    blackPointCropRect = null;

    // Display the modal
    modal.style.display = "flex";

    slider.addEventListener("input", function () {
        sliderValue.textContent = `${slider.value}%`;
    });

    // Perform black point adjustment when the user stops interacting with the slider
    slider.addEventListener("mouseup", async function () {
        const blackPoint = slider.value;
        const adjustedImage = await adjustBlackPoint(loadedModalImage, blackPoint);
        blackPointImage.src = adjustedImage;
    });

    // Setup crop mode toggle
    const cropCheckbox = document.getElementById("blackPointEnableCrop");
    if (cropCheckbox) {
        cropCheckbox.addEventListener("change", function() {
            blackPointCropMode = this.checked;
            blackPointCropRect = null;
            setupBlackPointImageCrop();
        });
    }

    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', async function() {
            this.closest('.modal').style.display = 'none';
            blackPointCropMode = false;
            blackPointCropRect = null;
        });
    });
}

function setupBlackPointImageCrop() {
    const imageContainer = document.querySelector("#blackPointModal .image-container");
    const img = document.getElementById("blackPointImage");
    
    if (!blackPointCropMode) {
        // Remove crop overlay if exists
        const existingOverlay = document.getElementById("blackPointCropOverlay");
        if (existingOverlay) existingOverlay.remove();
        return;
    }

    // Create canvas overlay for crop rectangle
    let canvas = document.getElementById("blackPointCropOverlay");
    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "blackPointCropOverlay";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.cursor = "crosshair";
        canvas.style.pointerEvents = "auto";
        imageContainer.style.position = "relative";
        imageContainer.appendChild(canvas);
    }

    // Match canvas size to image element (container-sized box)
    // canvas covers the full element box; we'll compute the actual displayed image area
    function recomputeDisplay() {
        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
        canvas.style.width = img.clientWidth + "px";
        canvas.style.height = img.clientHeight + "px";

        // Compute displayed image size (accounting for object-fit: contain)
        const elementW = img.clientWidth;
        const elementH = img.clientHeight;
        const naturalW = img.naturalWidth || elementW;
        const naturalH = img.naturalHeight || elementH;
        const scale = Math.min(elementW / naturalW, elementH / naturalH);
        const displayW = naturalW * scale;
        const displayH = naturalH * scale;
        const offsetX = (elementW - displayW) / 2;
        const offsetY = (elementH - displayH) / 2;
        blackPointDisplayInfo = { offsetX, offsetY, displayW, displayH, scale };
    }

    // Recompute when image changes (it may be updated by slider adjustments)
    img.addEventListener('load', () => {
        recomputeDisplay();
        // redraw overlay if needed
        const ctxReload = canvas.getContext('2d');
        drawBlackPointCropRect(ctxReload, canvas);
    });

    recomputeDisplay();

    const ctx = canvas.getContext("2d");

    canvas.addEventListener("mousedown", (e) => {
        if (!blackPointCropMode || !blackPointDisplayInfo) return;
        const rect = canvas.getBoundingClientRect();
        // Mouse relative to element
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        // Relative to displayed image area
        const localX = Math.max(0, Math.min(blackPointDisplayInfo.displayW, clickX - blackPointDisplayInfo.offsetX));
        const localY = Math.max(0, Math.min(blackPointDisplayInfo.displayH, clickY - blackPointDisplayInfo.offsetY));
        blackPointCropStartX = localX;
        blackPointCropStartY = localY;
        blackPointIsDrawing = true;
        blackPointCropRect = {
            x: localX,
            y: localY,
            width: 0,
            height: 0
        };
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!blackPointIsDrawing || !blackPointCropMode || !blackPointDisplayInfo) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const currentX = Math.max(0, Math.min(blackPointDisplayInfo.displayW, rawX - blackPointDisplayInfo.offsetX));
        const currentY = Math.max(0, Math.min(blackPointDisplayInfo.displayH, rawY - blackPointDisplayInfo.offsetY));

        blackPointCropRect.width = currentX - blackPointCropStartX;
        blackPointCropRect.height = currentY - blackPointCropStartY;

        drawBlackPointCropRect(ctx, canvas);
    });

    canvas.addEventListener("mouseup", () => {
        if (blackPointIsDrawing && blackPointCropRect) {
            blackPointIsDrawing = false;
            // Normalize rectangle
            if (blackPointCropRect.width < 0) {
                blackPointCropRect.x += blackPointCropRect.width;
                blackPointCropRect.width = -blackPointCropRect.width;
            }
            if (blackPointCropRect.height < 0) {
                blackPointCropRect.y += blackPointCropRect.height;
                blackPointCropRect.height = -blackPointCropRect.height;
            }
        }
    });

    canvas.addEventListener("mouseleave", () => {
        blackPointIsDrawing = false;
    });
}

function drawBlackPointCropRect(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (blackPointCropRect && (blackPointCropRect.width !== 0 || blackPointCropRect.height !== 0) && blackPointDisplayInfo) {
        // Draw semi-transparent overlay over full element
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Clear the crop area within the displayed image area
        const drawX = blackPointDisplayInfo.offsetX + blackPointCropRect.x;
        const drawY = blackPointDisplayInfo.offsetY + blackPointCropRect.y;
        const drawW = blackPointCropRect.width;
        const drawH = blackPointCropRect.height;

        ctx.clearRect(drawX, drawY, drawW, drawH);

        // Draw crop border
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(drawX, drawY, drawW, drawH);
        ctx.setLineDash([]);
    }
}

async function adjustBlackPoint(imageSrc, blackPoint, download = false) {
    const response = await fetch("/adjust-black-point", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageSrc, blackPoint, download }),
    });

    const data = await response.json();
    return data.adjustedImage; // Returns the base64 image
}

async function downloadBlackPointImage() {
    const slider = document.getElementById("blackPointSlider");
    const blackPoint = slider.value;
    const button = document.getElementById("downloadBlackPoint");
    const originalText = button.innerHTML;

    // Prevent multiple downloads by disabling the button
    if (button.disabled) return;

    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try {
        // Get filename
        const filename = document.getElementById("blackPointFilename").value.trim() || "adjusted_black_point";
        
        // Get target size
        const widthInput = document.getElementById("blackPointWidth").value;
        const heightInput = document.getElementById("blackPointHeight").value;
        const targetSize = (widthInput && heightInput) ? {
            width: parseInt(widthInput),
            height: parseInt(heightInput)
        } : null;

        // First, get the adjusted image
        const response = await fetch("/adjust-black-point", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageSrc: loadedModalImage, blackPoint: blackPoint }),
        });

        if (!response.ok) {
            throw new Error("Failed to adjust black point");
        }

        const data = await response.json();
        const adjustedImageData = data.adjustedImage;

        // Get crop coordinates if crop mode is enabled
        let cropCoords = null;
        if (blackPointCropMode && blackPointCropRect && blackPointCropRect.width > 0 && blackPointCropRect.height > 0 && blackPointDisplayInfo) {
            const img = document.getElementById("blackPointImage");
            // Map crop (which is relative to displayed image area) back to natural image pixels
            const scaleX = img.naturalWidth / blackPointDisplayInfo.displayW;
            const scaleY = img.naturalHeight / blackPointDisplayInfo.displayH;

            cropCoords = {
                x: Math.round(blackPointCropRect.x * scaleX),
                y: Math.round(blackPointCropRect.y * scaleY),
                width: Math.round(blackPointCropRect.width * scaleX),
                height: Math.round(blackPointCropRect.height * scaleY)
            };
        }

        // Send to save endpoint
        const saveResponse = await fetch('/save-processed-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageData: adjustedImageData,
                filename: filename,
                cropCoords: cropCoords,
                targetSize: targetSize
            })
        });

        if (!saveResponse.ok) {
            throw new Error('Failed to save image');
        }

        // Download the file
        const blob = await saveResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error("Error downloading black point image:", error);
        alert("An error occurred while downloading the image.");
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}