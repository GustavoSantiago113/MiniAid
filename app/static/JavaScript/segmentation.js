let loadedModalImage = null;
let originalWidthImg = 0;
let originalHeightImg = 0;
let startX, startY, endX, endY;
let interactionMode = "polygon"; // Default to polygon mode now
let lastRectangleCoords = null;
let isDrawing = false;
let isDragging = false;
let draggingPointIndex = -1;
let polygonPoints = [];
const POINT_RADIUS = 6;

let zoomLevel = 1;
let panOffsetX = 0;
let panOffsetY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;
const MAX_ZOOM = 10;
const MIN_ZOOM = 0.5;

async function openSegmentationModal() {
    const modal = document.getElementById("segmentationModal");
    const imageContainer = document.getElementById("imageContainer");
    const slider = document.getElementById("segmentationConfidenceSlider");
    const sliderValue = document.getElementById("segmentationConfidenceValue");

    slider.addEventListener("input", function () {
        sliderValue.textContent = `${slider.value}%`;
    });

    // Reset state
    polygonPoints = [];
    interactionMode = "polygon";
    zoomLevel = 1;
    panOffsetX = 0;
    panOffsetY = 0;
    isPanning = false;

    // 1. Show modal and loader
    modal.style.display = "flex";
    imageContainer.innerHTML = '<div class="loader" id="segmentationLoader"></div>';

    // 2. Send image for segmentation
    const imagePath = previewImage.src;
    let img = new window.Image();

    let polygons = [];
    try {
        const response = await fetch('/segment-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: imagePath }),
        });
        const data = await response.json();
        if (data.success && data.polygons && data.polygons.length > 0) {
            polygons = data.polygons;
        } else if (data.success && (!data.polygons || data.polygons.length === 0)){
            imageContainer.innerHTML = '<p style="text-align: center; color: red;">No Miniatures detected, please reduce the confidence</p>';
            return;
        } else {
            throw new Error(data.message || "Segmentation failed.");
        }
    } catch (e) {
        // Replace spinner with error message
        imageContainer.innerHTML = `<p style="text-align: center; color: red;">Error: ${e.message}</p>`;
        return;
    }

    // 3. When image loads, replace loader with canvas and draw polygon
    img.onload = function() {
        imageContainer.innerHTML = '';

        // Create a new canvas if not present
        let canvas = document.getElementById("imageCanvas");
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.id = "imageCanvas";
        }
        imageContainer.appendChild(canvas);

        // Calculate appropriate canvas size based on the container
        const containerWidth = imageContainer.clientWidth;
        const containerHeight = Math.min(window.innerHeight * 0.7, 600); // Limit height
        
        // Calculate scaling to fit in container while maintaining aspect ratio
        const scaleWidth = containerWidth / img.naturalWidth;
        const scaleHeight = containerHeight / img.naturalHeight;
        const scale = Math.min(scaleWidth, scaleHeight);
        
        // Set canvas dimensions
        const canvasWidth = img.naturalWidth * scale;
        const canvasHeight = img.naturalHeight * scale;
        
        // Set canvas size
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        canvas.style.display = "block";

        // Save global variables
        loadedModalImage = img;
        originalWidthImg = img.naturalWidth;
        originalHeightImg = img.naturalHeight;
        interactionMode = "polygon";

        // Convert polygon points from original image coordinates to canvas coordinates
        polygonPoints = polygons.map(point => {
            const [origX, origY] = point;
            const canvasX = (origX / originalWidthImg) * canvasWidth;
            const canvasY = (origY / originalHeightImg) * canvasHeight;
            return [canvasX, canvasY];
        });

        // Draw image and polygon
        const ctx = canvas.getContext("2d");
        redrawCanvas(canvas, ctx);

        // Enable polygon editing
        initializeCanvasDrawing(canvas, ctx);
    };

    img.src = imagePath;

    // Close modal handler
    document.querySelector(".close").addEventListener("click", function() {
        document.getElementById("segmentationModal").style.display = "none";
        loadedModalImage = null;
        polygonPoints = [];
    });
}

function initializeCanvasDrawing(canvas, ctx) {
    // Remove existing event listeners to prevent duplicates
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("mouseleave", handleMouseLeave);
    canvas.removeEventListener("wheel", handleWheel);
    canvas.removeEventListener("dblclick", handleDoubleClick);

    // Add event listeners
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("wheel", handleWheel);
    canvas.addEventListener("dblclick", handleDoubleClick);

    function handleMouseDown(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const canvasX = (x - panOffsetX) / zoomLevel;
        const canvasY = (y - panOffsetY) / zoomLevel;

        if (e.shiftKey) {
            isPanning = true;
            lastPanX = e.clientX;
            lastPanY = e.clientY;
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (interactionMode === "polygon") {
            draggingPointIndex = -1;

            // Check if clicking on a point
            polygonPoints.forEach(([px, py], index) => {
                const distance = Math.hypot(px - canvasX, py - canvasY);
                if (distance < POINT_RADIUS / zoomLevel) {
                    draggingPointIndex = index;
                }
            });

            if (draggingPointIndex !== -1) {
                isDragging = true;
                canvas.style.cursor = 'move';
            } else {
                // Check if clicking on a line to add a point
                for (let i = 0; i < polygonPoints.length; i++) {
                    const j = (i + 1) % polygonPoints.length;
                    const [x1, y1] = polygonPoints[i];
                    const [x2, y2] = polygonPoints[j];
                    
                    // Calculate distance from point to line segment
                    const A = canvasX - x1;
                    const B = canvasY - y1;
                    const C = x2 - x1;
                    const D = y2 - y1;
                    
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    if (lenSq !== 0) param = dot / lenSq;
                    
                    let xx, yy;
                    if (param < 0) {
                        xx = x1;
                        yy = y1;
                    } else if (param > 1) {
                        xx = x2;
                        yy = y2;
                    } else {
                        xx = x1 + param * C;
                        yy = y1 + param * D;
                    }
                    
                    const distance = Math.hypot(canvasX - xx, canvasY - yy);
                    if (distance < 5 / zoomLevel) { // 5px tolerance for line clicks
                        // Add point after the current segment
                        polygonPoints.splice(j, 0, [canvasX, canvasY]);
                        redrawCanvas(canvas, ctx);
                        break;
                    }
                }
            }
        }
    }

    function handleMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const canvasX = (x - panOffsetX) / zoomLevel;
        const canvasY = (y - panOffsetY) / zoomLevel;

        if (isPanning) {
            const deltaX = e.clientX - lastPanX;
            const deltaY = e.clientY - lastPanY;

            panOffsetX += deltaX;
            panOffsetY += deltaY;

            lastPanX = e.clientX;
            lastPanY = e.clientY;

            redrawCanvas(canvas, ctx);
            return;
        }

        if (interactionMode === "polygon" && isDragging && draggingPointIndex !== -1) {
            polygonPoints[draggingPointIndex] = [canvasX, canvasY];
            redrawCanvas(canvas, ctx);
        }

        // Update cursor based on what's under mouse
        if (interactionMode === "polygon" && !isDragging) {
            let overPoint = false;
            polygonPoints.forEach(([px, py]) => {
                const distance = Math.hypot(px - canvasX, py - canvasY);
                if (distance < POINT_RADIUS / zoomLevel) {
                    overPoint = true;
                }
            });
            canvas.style.cursor = overPoint ? 'pointer' : 'default';
        }
    }

    function handleMouseUp(e) {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'default';
        }
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'default';
        }
        isDrawing = false;
        draggingPointIndex = -1;
    }

    function handleDoubleClick(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const canvasX = (x - panOffsetX) / zoomLevel;
        const canvasY = (y - panOffsetY) / zoomLevel;

        if (interactionMode === "polygon") {
            // Check if double-clicking on a point
            polygonPoints.forEach(([px, py], index) => {
                const distance = Math.hypot(px - canvasX, py - canvasY);
                if (distance < POINT_RADIUS / zoomLevel) {
                    // Remove point if polygon has more than 3 points
                    if (polygonPoints.length > 3) {
                        polygonPoints.splice(index, 1);
                        redrawCanvas(canvas, ctx);
                    }
                }
            });
        }
    }

    function handleMouseLeave(e) {
        isPanning = false;
        isDrawing = false;
        isDragging = false;
        canvas.style.cursor = 'default';
    }

    function handleWheel(e) {
        e.preventDefault(); // Prevent page scrolling

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomChange = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel * zoomChange));

        if (newZoom !== zoomLevel) {
            const canvasXBefore = (mouseX - panOffsetX) / zoomLevel;
            const canvasYBefore = (mouseY - panOffsetY) / zoomLevel;

            zoomLevel = newZoom;

            panOffsetX = mouseX - canvasXBefore * zoomLevel;
            panOffsetY = mouseY - canvasYBefore * zoomLevel;

            redrawCanvas(canvas, ctx);
        }
    }
}

function redrawCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(panOffsetX, panOffsetY);
    ctx.scale(zoomLevel, zoomLevel);

    if (loadedModalImage) {
        ctx.drawImage(loadedModalImage, 0, 0, canvas.width, canvas.height);
    }
    
    if (interactionMode === "polygon" && polygonPoints.length > 0) {
        drawPolygonAndPoints(ctx);
    }

    ctx.restore();
}

function drawPolygonAndPoints(ctx) {
    if (!polygonPoints || polygonPoints.length === 0) return;

    // Draw polygon lines
    ctx.beginPath();
    ctx.moveTo(polygonPoints[0][0], polygonPoints[0][1]);
    for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i][0], polygonPoints[i][1]);
    }
    ctx.closePath();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = Math.max(2 / zoomLevel, 1); // Ensure minimum line width
    ctx.stroke();

    // Draw control points
    const pointRadius = POINT_RADIUS / zoomLevel; // Ensure minimum point size
    polygonPoints.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1 / zoomLevel;
        ctx.stroke();
    });
}

// Keep this function for backward compatibility if needed
function renderPolygonOnCanvas(canvas, polygon) {
    if (!polygon || !Array.isArray(polygon) || polygon.length === 0) {
        console.error("Invalid polygon data received");
        return;
    }

    const ctx = canvas.getContext("2d");
    
    // Convert polygon points from original image coordinates to canvas coordinates
    polygonPoints = polygon.map(point => {
        const [origX, origY] = point;
        const canvasX = (origX / originalWidthImg) * canvas.width;
        const canvasY = (origY / originalHeightImg) * canvas.height;
        return [canvasX, canvasY];
    });
    
    // Reset zoom and pan when showing a new polygon
    zoomLevel = 1;
    panOffsetX = 0;
    panOffsetY = 0;
    
    // Draw the polygon
    redrawCanvas(canvas, ctx);
}

async function reSegment() {
    const button = document.getElementById("reRunSegmentation");
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    const qualityMap = {
        low: 0.001,
        medium: 0.0005,
        high: 0.0001
    };

    const selectElement = document.getElementById("segSmooth");
    const selectedKey = selectElement.value;
    const smooth = qualityMap[selectedKey];

    const slider = document.getElementById("segmentationConfidenceSlider");

    try {
        // Send the file to the server with new confidence
        const response = await fetch('/segment-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_path: loadedModalImage.src,
                smooth: smooth,
                confidence: slider.value / 100 // Convert slider value to a percentage
            }),
        });

        const data = await response.json();

        if (data.success && data.polygons && data.polygons.length > 0) {
            
            const canvas = document.getElementById("imageCanvas");
            
            // Update polygon points
            polygonPoints = data.polygons.map(point => {
                const [origX, origY] = point;
                const canvasX = (origX / originalWidthImg) * canvas.width;
                const canvasY = (origY / originalHeightImg) * canvas.height;
                return [canvasX, canvasY];
            });

            // Redraw the canvas with updated polygons
            const ctx = canvas.getContext("2d");
            redrawCanvas(canvas, ctx);
        } else if (data.success && (!data.polygons || data.polygons.length === 0)) {
            alert("No polygons detected. Please adjust the confidence.");
        } else {
            alert("Failed to segment the image.");
        }
    } catch (error) {
        alert(`An error occurred while re-running segmentation.${error.message}`);
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function getUpdatedPolygonOriginalScale() {
    // Get the canvas element
    const canvas = document.getElementById("imageCanvas");

    // Check if the canvas exists
    if (!canvas) {
        console.error("Canvas element not found.");
        return [];
    }

    // Calculate scale factors from canvas coordinates back to original image coordinates
    const scaleX = originalWidthImg / canvas.width;
    const scaleY = originalHeightImg / canvas.height;

    // Convert polygon points back to original image coordinates
    return polygonPoints.map(([x, y]) => [
        Math.round(x * scaleX),
        Math.round(y * scaleY)
    ]);
}

async function segmentImage(){
    const coordinates = getUpdatedPolygonOriginalScale();

    if (coordinates && coordinates.length > 0) {
        const button = document.getElementById("downloadSegmented");

        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loader"></span>';
        button.disabled = true;

        try{
            // Send the file to the server
            const response = await fetch('/download-segmented', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    image_path: loadedModalImage.src, 
                    polygon: coordinates 
                }),
            });
                
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "segmented.png";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
            } else {
                const errorData = await response.json();
                alert(`Failed to download segmented image: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred while downloading the image.");
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    } else {
        alert("No polygon coordinates available for cropping.");
    }
}