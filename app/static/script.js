async function sendImageToCrop(){

    const button = document.getElementById("uploadImageCrop");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try{
        const fileInput = document.getElementById('drawImageInput');
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a file.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Send the file to the server
        await fetch('/uploadImage', {
            method: 'POST',
            body: formData,
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = `/pre-painting-crop?filename=${data.filename}`;        
            } else {
                alert(data.error);
            }
        }).catch(error => {
            console.error("Error:", error);
            alert("Something went wrong.");
        });
    } catch(error){
        alert("An error occurred while uploading the image.");
    } finally{
        button.innerHTML = originalText;
        button.disabled = false;
    }
    
}

async function sendCroppedImage(cropper, filename){

    const button = document.getElementById("cropButton");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try{
        // Get the cropped data
        const croppedCanvas = cropper.getCroppedCanvas();
        const croppedImage = croppedCanvas.toDataURL('image/png'); // Convert canvas to base64 image

        // Send the cropped image to the server
        await fetch('/crop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: croppedImage, filename: filename }),
        }).then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = `/pre-painting-colors?croppedFileName=${data.croppedFileName}&originalFileName=${data.originalFileName}`;
                } else {
                    alert('Failed to crop image.');
                }
            }).catch(error => {
                console.error("Error:", error);
                alert("Something went wrong.");
            });
    } catch(error){
        alert("An error occurred while uploading the image.");
    } finally{
        button.innerHTML = originalText;
        button.disabled = false;
    }
    
}

async function collorPalletMake(){
    const partInput = document.getElementById("partInput");
    const colorPicker = document.getElementById("colorPicker");
    const partsList = document.getElementById("partsList");

    const partText = partInput.value.trim();
    const selectedColor = colorPicker.value;

    if (partText === "") {
        alert("Please enter a part name.");
        return;
    }

    // Create container for item
    const partItem = document.createElement("div");
    partItem.classList.add("part-item");

    // Color Box
    const colorBox = document.createElement("div");
    colorBox.classList.add("color-box");
    colorBox.style.backgroundColor = selectedColor;

    // Part Name
    const partName = document.createElement("span");
    partName.textContent = partText;
    partName.classList.add("part-name");

    // Edit Button
    const editButton = document.createElement("button");
    editButton.classList.add("edit-btn");
    editButton.innerHTML = "✏️";
    editButton.addEventListener("click", function () {
        // Create input field for text edit
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.value = partName.textContent;
        textInput.classList.add("edit-input");

        // Create color picker for color edit
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = colorBox.style.backgroundColor;
        colorInput.classList.add("edit-color-picker");

        // Create save button
        const saveButton = document.createElement("button");
        saveButton.innerHTML = "✔️";
        saveButton.classList.add("save-btn");

        // When saving, update the text and color
        saveButton.addEventListener("click", function () {
            partName.textContent = textInput.value;
            colorBox.style.backgroundColor = colorInput.value;
            editButton.style.display = "inline";
            partItem.replaceChild(partName, textInput);
            partItem.replaceChild(colorBox, colorInput);
            partItem.replaceChild(editButton, saveButton);
        });

        // Replace elements for editing
        partItem.replaceChild(textInput, partName);
        partItem.replaceChild(colorInput, colorBox);
        partItem.replaceChild(saveButton, editButton);
        editButton.style.display = "none";
    });

    // Delete Button
    const deleteButton = document.createElement("button");
    deleteButton.classList.add("delete-btn");
    deleteButton.innerHTML = "🗑️";
    deleteButton.addEventListener("click", function () {
        partsList.removeChild(partItem);
    });

    // Append elements
    partItem.appendChild(colorBox);
    partItem.appendChild(partName);
    partItem.appendChild(editButton);
    partItem.appendChild(deleteButton);
    partsList.appendChild(partItem);

    // Clear input
    partInput.value = "";
}

async function generatePDF(croppedFilename){

    const button = document.getElementById("generatePDF");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try{
        const colorItems = document.querySelectorAll(".part-item"); // Adjust selector as needed
        let textColorDict = {};

        colorItems.forEach(item => {
            const text = item.querySelector(".part-name").innerText;
            const color = item.querySelector(".color-box").style.backgroundColor;
            textColorDict[text] = rgbToHex(color);
        });
        
        const response = await fetch("/export-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ textColorDict: textColorDict, croppedFilename: croppedFilename })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "color_palette.pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("Failed to generate PDF.");
        }
    } catch(error){
        alert("An error occurred while exporting the PDF.");
    } finally{
        button.innerHTML = originalText;
        button.disabled = false;
    }
    
}

function rgbToHex(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

async function sendImageToFrames(){
    const button = document.getElementById("uploadImage");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;
    
    try{
        const fileInput = document.getElementById('imageInput');
        const files = fileInput.files;

        if (!files || files.length === 0) {
            alert('Please select at least one file.');
            return;
        }

        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('files[]', file);
        });

        // Send the file to the server
        await fetch('/uploadImageFrame', {
            method: 'POST',
            body: formData,
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = `/post-painting-frames`;        
            } else {
                alert(data.error);
            }
        }).catch(error => {
            console.error("Error:", error);
            alert("Something went wrong.");
        });
    } catch(error){
        alert("An error occurred while uploading the images.");
    } finally{
        button.innerHTML = originalText;
        button.disabled = false;
    }

}

async function sendMoreImageToFrames(){
    
    const fileInput = document.getElementById('frameUploadInput');

    const files = fileInput.files;
    if (!files.length) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
        formData.append('files[]', file);
    });

    // Send the files to the server
    const response = await fetch('/uploadImageFrame', {
        method: 'POST',
        body: formData,
    });

    if (response.ok) {
        // Reload the page to show new images in the list
        window.location.reload();
    } else {
        alert('Failed to upload images.');
    }
}

async function selectImage(filename, previewImage) {
    // Update the selected file in UI
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        if (item.textContent.trim() === filename) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Show the selected image
    
    const noSelectionText = document.getElementById('no-selection-text');
    
    previewImage.src = `static/uploads/frames/${filename}`;
    previewImage.style.display = 'block';
    noSelectionText.style.display = 'none';
}

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

async function openSegmentationModal(imageSrc, canvas) {
    
    const modal = document.getElementById("segmentationModal");
    const imageContainer = document.getElementById("imageContainer");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    imageContainer.innerHTML = "";
    imageContainer.appendChild(canvas);

    // Load the image into the modal
    loadedModalImage = new window.Image();

    // Wait for the image to load
    loadedModalImage.onload = () => {
        setTimeout(() => {
            originalWidthImg = loadedModalImage.naturalWidth;
            originalHeightImg = loadedModalImage.naturalHeight;
            
            console.log(`Image loaded: ${originalWidthImg}x${originalHeightImg}`);
            
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

    // Get Rectangle Coordinates
    document.getElementById("sendToSegment").addEventListener("click", function() {
        sendImageToSegment(canvas);
    });

    document.getElementById("downloadSegmented").addEventListener("click", function() {
        segmentImage();
    });

    document.getElementById("reRunSegmentation").addEventListener("click", function() {
        reSegment();
    });

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

        if (interactionMode === "polygon") {
            draggingPointIndex = -1;

            
            polygonPoints.forEach(([px, py], index) => {
            if (Math.hypot(px - x, py - y) < POINT_RADIUS) {
                    draggingPointIndex = index;
                }
            });

            if (draggingPointIndex !== -1) {
                isDragging = true;
            }

        } else if (interactionMode === "rectangle") {
            isDrawing = true;
            startX = x;
            startY = y;
        }

    });

    canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (interactionMode === "polygon" && isDragging && draggingPointIndex !== -1) {
            polygonPoints[draggingPointIndex] = [x, y];
            drawPolygonAndPoints(ctx);
        } else if (interactionMode === "rectangle" && isDrawing) {
            endX = x;
            endY = y;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            redrawCanvas(canvas, ctx);
        }
    });

    canvas.addEventListener("mouseup", () => {
        isDrawing = false;
        isDragging = false;
    });

    canvas.addEventListener("mouseleave", () => {
        isDrawing = false;
        isDragging = false;
    });
}

function redrawCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the image as background
    if (loadedModalImage) {
        ctx.drawImage(loadedModalImage, 0, 0, canvas.width, canvas.height);
    }
    
    if (interactionMode === "rectangle" && startX !== undefined && endX !== undefined) {
        // Draw rectangle
        ctx.strokeStyle = "green";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    } else if (interactionMode === "polygon" && polygonPoints.length > 0) {
        // Draw polygon
        drawPolygonAndPoints(ctx);
    }
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
        const canvasX = (origX / originalWidthImg) * canvas.width;
        const canvasY = (origY / originalHeightImg) * canvas.height;
        return [canvasX, canvasY];
    });
    
    // Draw the polygon
    drawPolygonAndPoints(ctx);
}

function drawPolygonAndPoints(ctx) {
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(loadedModalImage, 0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw polygon
    ctx.beginPath();
    ctx.moveTo(polygonPoints[0][0], polygonPoints[0][1]);
    for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i][0], polygonPoints[i][1]);
    }
    ctx.closePath();
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw the control points
    polygonPoints.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "red";
        ctx.fill();
    });
}

function getTransformedMouseCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = (rawX - offsetX) / zoomScale;
    const y = (rawY - offsetY) / zoomScale;
    return { x, y };
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

    try {
        // Get confidence value from slider
        const confidence = parseFloat(document.getElementById("segmentationConfidence").value) / 100;

        // Send the file to the server with new confidence
        const response = await fetch('/segment-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_path: loadedModalImage.src,
                coordinates: lastRectangleCoords,
                confidence: confidence
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
    const modalImage = document.getElementById("modalImage");
    const scaleX = originalWidth / modalImage.clientWidth;
    const scaleY = originalHeight / modalImage.clientHeight;

    return polygonPoints.map(([x, y]) => [x * scaleX, y * scaleY]);
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
                    body: JSON.stringify({ image_path: document.getElementById("modalImage").src, polygon: coordinates }),
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

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".navigation-button").forEach(button => {
        button.addEventListener("mouseenter", function() {
            let image = document.getElementById("landingImage");
            let newSrc = this.getAttribute("data-image");

            // Only change image if it's different from the current one
            if (image.src !== newSrc) {
                image.style.opacity = 0; // Fade out

                setTimeout(() => {
                    image.src = newSrc;
                    image.style.animation = "none"; // Reset animation
                    void image.offsetWidth; // Trick to restart animation
                    image.style.animation = "slideFromRight 1.5s ease-out forwards";
                    image.style.opacity = 1;
                }, 200);
            }
        });

        button.addEventListener("mouseleave", function() {
            let image = document.getElementById("landingImage");

            // Only reset if the image is not already the default
            if (image.src !== "../static/main.png") {
                image.style.opacity = 0; // Fade out

                setTimeout(() => {
                    image.src = "../static/main.png"; // Reset to default image
                    image.style.animation = "none"; // Reset animation
                    void image.offsetWidth; // Trick to restart animation
                    image.style.animation = "slideFromRight 1.5s ease-out forwards";
                    image.style.opacity = 1;
                }, 200);
            }
        });
    });

    document.getElementById("drawImageInput").addEventListener("change", function () {
        sendImageToCrop();
    });
    
})