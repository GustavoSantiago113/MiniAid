async function sendImageToCrop(){

    const button = document.getElementById("uploadImageCrop");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try{
        const fileInput = document.getElementById('drawImageInput');
        const file = fileInput.files[0];

        if (!file) {
            notificationSystem.warning('Please select a file.');
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
                notificationSystem.error(data.error);
            }
        }).catch(error => {
            console.error("Error:", error);
            notificationSystem.error("Something went wrong.");
        });
    } catch(error){
        notificationSystem.error("An error occurred while uploading the image.");
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
                    notificationSystem.error('Failed to crop image.');
                }
            }).catch(error => {
                console.error("Error:", error);
                notificationSystem.error("Something went wrong.");
            });
    } catch(error){
        notificationSystem.error("An error occurred while uploading the image.");
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
        notificationSystem.warning("Please enter a part name.");
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

        const currentColor = rgbToHex(colorBox.style.backgroundColor);

        // Create color picker for color edit
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = currentColor;
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

async function generatePDF(croppedFilename) {
    const button = document.getElementById("generatePDF");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try {
        const colorItems = document.querySelectorAll(".part-item");
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
            a.style.display = "none";
            a.href = url;
            a.download = "color_palette.pdf";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            notificationSystem.error("Failed to generate PDF.");
        }
    } catch (error) {
        console.error("Error exporting PDF:", error);
        notificationSystem.error("An error occurred while exporting the PDF.");
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function rgbToHex(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}