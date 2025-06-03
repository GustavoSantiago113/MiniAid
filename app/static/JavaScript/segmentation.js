let loadedModalImage = null;
let originalWidthImg = 0;
let originalHeightImg = 0;
let startX, startY, endX, endY;
let interactionMode = "rectangle";
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

async function openSegmentationModal(imageSrc, canvas) {
    
    const modal = document.getElementById("segmentationModal");
    const imageContainer = document.getElementById("imageContainer");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    imageContainer.innerHTML = "";
    imageContainer.appendChild(canvas);

    startX = startY = endX = endY = undefined;
    polygonPoints = [];
    interactionMode = "rectangle";

    zoomLevel = 1;
    panOffsetX = 0;
    panOffsetY = 0;
    isPanning = false;

    // Load the image into the modal
    loadedModalImage = new window.Image();

    // Wait for the image to load
    loadedModalImage.onload = () => {
        setTimeout(() => {
            originalWidthImg = loadedModalImage.naturalWidth;
            originalHeightImg = loadedModalImage.naturalHeight;
            
            // Calculate appropriate canvas size based on the container
            const containerWidth = imageContainer.clientWidth;
            const containerHeight = Math.min(window.innerHeight * 0.7, 600); // Limit height
            
            // Calculate scaling to fit in container while maintaining aspect ratio
            const scaleWidth = containerWidth / originalWidthImg;
            const scaleHeight = containerHeight / originalHeightImg;
            const scale = Math.min(scaleWidth, scaleHeight);
            
            // Set canvas dimensions
            const canvasWidth = originalWidthImg * scale;
            const canvasHeight = originalHeightImg * scale;
            
            // Set canvas size
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = `${canvasWidth}px`;
            canvas.style.height = `${canvasHeight}px`;
            
            // Draw the image on the canvas
            ctx.drawImage(loadedModalImage, 0, 0, canvasWidth, canvasHeight);
            
            initializeCanvasDrawing(canvas, ctx);
        }, 50);
    };

    loadedModalImage.src = imageSrc;
    
    // Display the modal
    modal.style.display = "flex";

    // Close Modal
    document.querySelector(".close").addEventListener("click", function() {
        document.getElementById("segmentationModal").style.display = "none";
        document.getElementById("sendToSegment").style.display = "block";
        document.getElementById("pre-segment-text").style.display = "block";
        document.getElementById("post-segment-text").style.display = "none";
        document.getElementById("postSegmentationControls").style.display = "none";
        interactionMode = "rectangle";
        loadedModalImage = null;
    });

}

function initializeCanvasDrawing(canvas, ctx) {

    // Start drawing
    canvas.addEventListener("mousedown", (e) => {
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
    
            polygonPoints.forEach(([px, py], index) => {
                if (Math.hypot(px - canvasX, py - canvasY) < POINT_RADIUS / zoomLevel) {
                    draggingPointIndex = index;
                }
            });

            if (draggingPointIndex !== -1) {
                isDragging = true;
            }

        } else if (interactionMode === "rectangle") {
            isDrawing = true;
            startX = canvasX;
            startY = canvasY;
            endX = canvasX;
            endY = canvasY;
        }

    });

    canvas.addEventListener("mousemove", (e) => {
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
        } else if (interactionMode === "rectangle" && isDrawing) {
            endX = canvasX;
            endY = canvasY;
            redrawCanvas(canvas, ctx);
        }
    });

    canvas.addEventListener("mouseup", () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'default';
        }
        isDrawing = false;
        isDragging = false;
    });

    canvas.addEventListener("mouseleave", () => {
        isPanning = false;
        isDrawing = false;
        isDragging = false;
        canvas.style.cursor = 'default';
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault(); // Prevent page scrolling
        
        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate zoom change based on wheel delta
        const zoomChange = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel * zoomChange));
        
        // Only proceed if zoom actually changes
        if (newZoom !== zoomLevel) {
            // Calculate mouse position in canvas space before zoom
            const canvasXBefore = (mouseX - panOffsetX) / zoomLevel;
            const canvasYBefore = (mouseY - panOffsetY) / zoomLevel;
            
            // Apply new zoom level
            zoomLevel = newZoom;
            
            // Calculate new offset to keep the point under mouse in the same position
            panOffsetX = mouseX - canvasXBefore * zoomLevel;
            panOffsetY = mouseY - canvasYBefore * zoomLevel;
            
            // Redraw canvas with new zoom/pan
            redrawCanvas(canvas, ctx);
        }
    });
}

function redrawCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(panOffsetX, panOffsetY);
    ctx.scale(zoomLevel, zoomLevel);

    if (loadedModalImage) {
        ctx.drawImage(loadedModalImage, 0, 0, canvas.width, canvas.height);
    }
    
    if (interactionMode === "rectangle" && startX !== undefined && endX !== undefined) {
        // Draw rectangle
        ctx.strokeStyle = "green";
        ctx.lineWidth = 2 / zoomLevel;
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    } else if (interactionMode === "polygon" && polygonPoints.length > 0) {
        // Draw polygon
        drawPolygonAndPoints(ctx);
    }

    ctx.restore();
}

function getRectangleCoordinates() {

    if (startX === undefined || startY === undefined || 
        endX === undefined || endY === undefined) {
        return null; // No rectangle drawn
    }

    // Calculate scaling factors from canvas to original image
    const scaleX = originalWidthImg / canvas.width;
    const scaleY = originalHeightImg / canvas.height;

    // Scale the coordinates to the original image size
    const scaledStartX = startX * scaleX;
    const scaledStartY = startY * scaleY;
    const scaledEndX = endX * scaleX;
    const scaledEndY = endY * scaleY;

    return {
        x_min: Math.min(scaledStartX, scaledEndX),
        y_min: Math.min(scaledStartY, scaledEndY),
        x_max: Math.max(scaledStartX, scaledEndX),
        y_max: Math.max(scaledStartY, scaledEndY),
    };
}

async function sendImageToSegment(canvas){
    
    const coordinates = getRectangleCoordinates(canvas);

    if (coordinates) {
        const button = document.getElementById("sendToSegment");
        lastRectangleCoords = coordinates;
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loader"></span>';
        button.disabled = true;

        try{

            const imagePath = loadedModalImage.src;

            // Send the file to the server
           const response = await fetch('/segment-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image_path: imagePath, coordinates: coordinates }),
            });
            
            const data = await response.json();

            if (data.success) {

                document.getElementById("sendToSegment").style.display = "none";
                document.getElementById("pre-segment-text").style.display = "none";
                document.getElementById("post-segment-text").style.display = "block";
                document.getElementById("postSegmentationControls").style.display = "block";

                interactionMode = "polygon";
                renderPolygonOnCanvas(canvas, data.polygon);

            } else {
                alert("Failed to segment the image.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred while segmenting the image.");
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    } else {
        alert("Please draw a rectangle first.");
    }

}

function renderPolygonOnCanvas(canvas, polygon) {
    if (!polygon || !Array.isArray(polygon) || polygon.length === 0) {
        console.error("Invalid polygon data received");
        return;
    }

    const ctx = canvas.getContext("2d");
    
    // Convert polygon points from original image coordinates to canvas coordinates
    polygonPoints = polygon.map(point => {
        const [origX, origY] = point;
        const canvasX = (origX / originalWidthImg) * (canvas.width / zoomLevel);
        const canvasY = (origY / originalHeightImg) * (canvas.height / zoomLevel);
        return [canvasX, canvasY];
    });
    
    // Reset zoom and pan when showing a new polygon
    zoomLevel = 1;
    panOffsetX = 0;
    panOffsetY = 0;
    
    // Draw the polygon
    redrawCanvas(canvas, ctx);
}

function drawPolygonAndPoints(ctx) {
    
    ctx.beginPath();
    ctx.moveTo(polygonPoints[0][0], polygonPoints[0][1]);
    for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i][0], polygonPoints[i][1]);
    }
    ctx.closePath();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2 / zoomLevel; // Scale line width with zoom
    ctx.stroke();
    
    // Draw the control points
    const pointRadius = POINT_RADIUS / zoomLevel; // Scale point size with zoom
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

async function reSegment() {
    
    if (!lastRectangleCoords) {
        alert("No rectangle selected.");
        return;
    }
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

    try {

        // Send the file to the server with new confidence
        const response = await fetch('/segment-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_path: loadedModalImage.src,
                coordinates: lastRectangleCoords,
                smooth: smooth
            }),
        });

        const data = await response.json();

        if (data.success) {
            // Clean old polygons and show new ones
            polygonPoints = [];
            renderPolygonOnCanvas(canvas, data.polygon);
        } else {
            alert("Failed to segment the image.");
        }
    } catch (error) {
        alert("An error occurred while re-running segmentation.");
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function getUpdatedPolygonOriginalScale() {
    const scaleX = originalWidthImg / canvas.width;
    const scaleY = originalHeightImg / canvas.height;

    return polygonPoints.map(([x, y]) => [
        x * scaleX,
        y * scaleY
    ]);
}

async function segmentImage(){
    const coordinates = getUpdatedPolygonOriginalScale();

    if (coordinates) {
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
                    body: JSON.stringify({ image_path: loadedModalImage.src, polygon: coordinates }),
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

                button.disabled = false;
                button.innerHTML = originalText;
                
            } else {
                alert("Failed to download segmented image.");
            }
        } catch (error) {
            alert("An error occurred while downloading the image.");
        }

    }
}