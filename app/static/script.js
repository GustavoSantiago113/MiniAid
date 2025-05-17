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

async function openSegmentationModal(imageSrc, canvas) {
    const modal = document.getElementById("segmentationModal");
    const modalImage = document.getElementById("modalImage");
    const ctx = canvas.getContext("2d");

    // Load the image into the modal
    modalImage.src = imageSrc;

    modal.style.display = "flex";

    // Wait for the image to load
    modalImage.onload = () => {
        setTimeout(() => {

            // Get the original dimensions of the image
            originalWidth = modalImage.naturalWidth;
            originalHeight = modalImage.naturalHeight;

            // Get the resized dimensions of the image
            const resizedWidth = modalImage.clientWidth;
            const resizedHeight = modalImage.clientHeight;

            // Set canvas dimensions to match the resized image
            canvas.width = resizedWidth;
            canvas.height = resizedHeight;

            // Position the canvas exactly over the image
            canvas.style.width = `${resizedWidth}px`;
            canvas.style.height = `${resizedHeight}px`;

            // Clear the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Initialize drawing functionality
            initializeCanvasDrawing(canvas, ctx);
        }, 50);
    };

    // Get Rectangle Coordinates
    document.getElementById("sendToSegment").addEventListener("click", function() {
        sendImageToSegment(canvas, imageSrc);
    });

    document.getElementById("downloadSegmented").addEventListener("click", function() {
        segmentImage(imageSrc);
    });

    // Close Modal
    document.querySelector(".close").addEventListener("click", function() {
        document.getElementById("segmentationModal").style.display = "none";
        document.getElementById("sendToSegment").style.display = "block";
        document.getElementById("downloadSegmented").style.display = "none";
        document.getElementById("pre-segment-text").style.display = "block";
        document.getElementById("post-segment-text").style.display = "none";
        interactionMode = "rectangle";
    });

}

let startX, startY, endX, endY;
let originalWidth, originalHeight;
let interactionMode = "rectangle";
let isDrawing = false;
let isDragging = false;
let draggingPointIndex = -1;
let polygonPoints = [];
const POINT_RADIUS = 6;

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
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, startY, endX - startX, endY - startY);
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

function getRectangleCoordinates(canvas) {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    if (!startX || !startY || !endX || !endY) {
        return null; // No rectangle drawn
    }

    // Get the resized image dimensions
    const modalImage = document.getElementById("modalImage");
    const resizedWidth = modalImage.clientWidth;
    const resizedHeight = modalImage.clientHeight;

    // Calculate scaling factors
    const scaleX = originalWidth / resizedWidth;
    const scaleY = originalHeight / resizedHeight;

    // Scale the coordinates to the original image size
    const scaledStartX = startX * scaleX;
    const scaledStartY = startY * scaleY;
    const scaledEndX = endX  * scaleX;
    const scaledEndY = endY  * scaleY;

    return {
        x_min: Math.min(scaledStartX, scaledEndX),
        y_min: Math.min(scaledStartY, scaledEndY),
        x_max: Math.max(scaledStartX, scaledEndX),
        y_max: Math.max(scaledStartY, scaledEndY),
    };
}

async function sendImageToSegment(canvas, frame){
    const coordinates = getRectangleCoordinates(canvas);

    if (coordinates) {
        const button = document.getElementById("sendToSegment");

        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loader"></span>';
        button.disabled = true;

        try{

            // Send the file to the server
           const response = await fetch('/segment-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image_path: frame, coordinates: coordinates }),
            });
            
            const data = await response.json();

            if (data.success) {

                document.getElementById("sendToSegment").style.display = "none";
                document.getElementById("downloadSegmented").style.display = "block";
                document.getElementById("pre-segment-text").style.display = "none";
                document.getElementById("post-segment-text").style.display = "block";

                const polygon = data.polygon;
                interactionMode = "polygon";
                renderPolygonOnCanvas(canvas, polygon);

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
    const ctx = canvas.getContext("2d");

    if (polygon.length === 0) return;

    // Scale from original to canvas size
    const modalImage = document.getElementById("modalImage");
    const scaleX = modalImage.clientWidth / originalWidth;
    const scaleY = modalImage.clientHeight / originalHeight;

    polygonPoints = polygon.map(([x, y]) => [x * scaleX, y * scaleY]);

    drawPolygonAndPoints(ctx);
}

function drawPolygonAndPoints(ctx) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image as background
    const modalImage = document.getElementById("modalImage");
    ctx.drawImage(modalImage, 0, 0, canvas.width, canvas.height);

    // Draw polygon
    ctx.beginPath();
    polygonPoints.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = "green";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
    ctx.fill();

    // Draw draggable points
    for (const [x, y] of polygonPoints) {
        ctx.beginPath();
        ctx.arc(x, y, POINT_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.stroke();
    }
}

function getTransformedMouseCoordinates(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = (rawX - offsetX) / zoomScale;
    const y = (rawY - offsetY) / zoomScale;
    return { x, y };
}

function getUpdatedPolygonOriginalScale() {
    const modalImage = document.getElementById("modalImage");
    const scaleX = originalWidth / modalImage.clientWidth;
    const scaleY = originalHeight / modalImage.clientHeight;

    return polygonPoints.map(([x, y]) => [x * scaleX, y * scaleY]);
}

async function segmentImage(imagePath){
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
                    body: JSON.stringify({ image_path: imagePath, polygon: coordinates }),
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