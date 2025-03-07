async function sendImageToCrop(){
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
}

async function sendCroppedImage(cropper, filename){

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

    document.getElementById("addButton").addEventListener("click", function () {
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
            const newText = prompt("Edit part name:", partText);
            if (newText !== null && newText.trim() !== "") {
                partName.textContent = newText;
            }
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
    });
    
});