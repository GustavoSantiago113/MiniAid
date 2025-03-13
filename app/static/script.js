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

async function sendVideoToFrames(){
    const button = document.getElementById("uploadVideo");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;
    
    try{
        const fileInput = document.getElementById('videoInput');
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a file.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Send the file to the server
        await fetch('/uploadVideo', {
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
        alert("An error occurred while uploading the video.");
    } finally{
        button.innerHTML = originalText;
        button.disabled = false;
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

    // Close Modal
    document.querySelector(".close").addEventListener("click", function() {
        document.getElementById("segmentationModal").style.display = "none";
    });

}

let startX, startY, endX, endY;
let originalWidth, originalHeight;

function initializeCanvasDrawing(canvas, ctx) {
    let isDrawing = false;

    // Start drawing
    canvas.addEventListener("mousedown", (e) => {
        isDrawing = true;
        startX = e.offsetX;
        startY = e.offsetY;
    });

    // Draw rectangle
    canvas.addEventListener("mousemove", (e) => {
        if (!isDrawing) return;

        endX = e.offsetX;
        endY = e.offsetY;

        // Clear the canvas and redraw the rectangle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    });

    // Stop drawing
    canvas.addEventListener("mouseup", () => {
        isDrawing = false;
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
            })

            if(response.ok){
                alert("Segmented");
            }
            else{
                alert("Something went wrong.");
            }
            
        } catch(error){
            alert("An error occurred while segmenting the image.");
        } finally{
            button.innerHTML = originalText;
            button.disabled = false;
        }
        
    } else {
        alert("Please draw a rectangle first.");
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
    
});