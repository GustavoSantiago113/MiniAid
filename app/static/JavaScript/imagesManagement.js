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

async function deleteAllImages() {
    if (!confirm("Are you sure you want to delete all images? This action cannot be undone.")) {
        return;
    }

    try {
        const response = await fetch('/delete-all-images', {
            method: 'POST',
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            // Optionally reload the page to reflect changes
            window.location.reload();
        } else {
            alert(data.message || "Failed to delete images.");
        }
    } catch (error) {
        alert("An error occurred while deleting the images.");
        console.error(error);
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
    
    previewImage.src = `static/uploads/images/${filename}`;
    previewImage.style.display = 'block';
    noSelectionText.style.display = 'none';
}