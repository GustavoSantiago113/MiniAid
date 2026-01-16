// Helper accessor for notification system: prefer global `notificationSystem`, fallback to no-op
const _notifFallback = {
    show: () => {},
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
    loading: () => ({}),
    updateLoading: () => {}
};

function notif() {
    return (typeof window !== 'undefined' && window.notificationSystem) ? window.notificationSystem : _notifFallback;
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
            notif().warning('Please select at least one file.');
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
                notif().error(data.error);
            }
        }).catch(error => {
            console.error("Error:", error);
            notif().error("Something went wrong.");
        });
    } catch(error){
        notif().error("An error occurred while uploading the images.");
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
        notif().success('Images uploaded successfully!');
        setTimeout(() => window.location.reload(), 1000);
    } else {
        notif().error('Failed to upload images.');
    }
}

async function deleteAllImages() {
    // Create custom confirmation
    const confirmed = confirm("Are you sure you want to delete all images? This action cannot be undone.");
    if (!confirmed) return;

    const loadingNotif = notif().loading('Deleting images...');

    try {
        const response = await fetch('/delete-all-images', {
            method: 'POST',
        });

        const data = await response.json();
        if (response.ok) {
            notif().updateLoading(loadingNotif, data.message, 'success');
            // Optionally reload the page to reflect changes
            setTimeout(() => window.location.reload(), 1500);
        } else {
            notif().updateLoading(loadingNotif, data.message || "Failed to delete images.", 'error');
        }
    } catch (error) {
        notif().updateLoading(loadingNotif, "An error occurred while deleting the images.", 'error');
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