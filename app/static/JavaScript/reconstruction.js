let reconstructionActive = false;

async function openReconstructionModal(){
    
    const modal = document.getElementById("reconstructionModal");
    const pcTitle = document.getElementById("pointCloudTitle");
    const fileItems = document.querySelectorAll('.file-item:not(.upload-item)');
    if (fileItems.length === 1) {
        alert("Please, upload more than 1 image to perform the reconstruction");
        return;
    }

    modal.style.display = "flex";

    const statusDiv = document.getElementById("reconstructionStatus");
    const messageDiv = document.getElementById("reconstructionMessage");
    const viewerDiv = document.getElementById("pointCloud");

    statusDiv.style.display = "block";
    pcTitle.style.display = "block";
    messageDiv.textContent = "Starting reconstruction...";
    viewerDiv.style.display = "none";

    let polling = true;

    function pollProgress() {
        if (!polling || !reconstructionActive) return;

        fetch('/reconstruction-progress')
            .then(res => res.json())
            .then(data => {
                messageDiv.textContent = data.message;

                if (data.stage === "done") {
                    polling = false;
                    messageDiv.textContent = "Reconstruction finished!";
                    statusDiv.style.display = "none";
                    viewerDiv.style.display = "block";
                } else if (data.stage === "cancelled") {
                    polling = false;
                    messageDiv.textContent = "Reconstruction cancelled.";
                } else {
                    setTimeout(pollProgress, 1000);
                }
            });
    }

    reconstructionActive = true;
    try {
        const response = await fetch('/make-point-cloud', {
            method: 'POST'
        });
        if (response.ok && reconstructionActive) {
            polling = true;
            pollProgress();
        } else {
            const data = await response.json();
            messageDiv.textContent = data.message || "Failed to start reconstruction.";
        }
    } catch (error) {
        messageDiv.textContent = "An error occurred during reconstruction.";
    }

    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', async function() {
            reconstructionActive = false;
            polling = false;

            // Send cancellation request to backend
            try {
                await fetch('/cancel-reconstruction', {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Failed to cancel reconstruction:', error);
            }

            this.closest('.modal').style.display = 'none';
        });
    });

    document.getElementById("returnToPointCloud").addEventListener("click", function () {
        // Hide mesh-related elements
        document.getElementById("meshTitle").style.display = "none";
        document.getElementById("adjustMesh").style.display = "none";
        document.getElementById("downloadMesh").style.display = "none";
        document.getElementById("meshAdjust").style.display = "none";
        document.getElementById("meshMakingStatus").style.display = "none";

        // Show point cloud-related elements
        document.getElementById("pointCloudTitle").style.display = "block";
        document.getElementById("makeMesh").style.display = "block";
        document.getElementById("removeOutliers").style.display = "block";
        document.getElementById("downloadPC").style.display = "block";
        document.getElementById("pointCloudAdjust").style.display = "block";

        // Hide the return button
        this.style.display = "none";
    });

}

async function reSendToPointCloud(){
    
    const button = document.getElementById("removeOutliers");
    const button2 = document.getElementById("downloadPC");
    const button3 = document.getElementById("makeMesh");
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;
    button2.disabled = true;
    button3.disabled = true;

    const qualityMap = {
      veryLow: [10, 2],
      low: [10, 1],
      medium: [20, 2],
      high: [30, 1],
      veryHigh: [30, 0.5],
    };

    const selectElement = document.getElementById("outlierRemoval");
    const selectedKey = selectElement.value;
    const params = qualityMap[selectedKey];

    try {

        const response = await fetch('/point-cloud-outliers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                parameters: params
            }),
        });

        const data = await response.json();

        if (data.success) {
            
        } else {
            alert("Failed to remove outliers.");
        }
    } catch (error) {
        alert("An error occurred while re-doing point cloud.");
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function sendToMesh(){

    document.getElementById("pointCloudTitle").style.display = "none";
    document.getElementById("makeMesh").style.display = "none";
    document.getElementById("removeOutliers").style.display = "none";
    document.getElementById("downloadPC").style.display = "none";
    document.getElementById("pointCloudAdjust").style.display = "none";

    document.getElementById("meshTitle").style.display = "block";
    document.getElementById("adjustMesh").style.display = "block";
    document.getElementById("downloadMesh").style.display = "block";
    document.getElementById("meshAdjust").style.display = "block";
    document.getElementById("meshMakingStatus").style.display = "block";

     document.getElementById("returnToPointCloud").style.display = "block";

    document.getElementById("adjustMesh").disabled = true;
    document.getElementById("downloadMesh").disabled = true;

    try {
        await fetch('/make-mesh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                depth: 10
            }),
        });
        document.getElementById("meshMakingStatus").style.display = "none";
    } catch (error) {
       alert("An error occurred during reconstruction.");
    }

}

async function reSendToMesh(){

    const button = document.getElementById("adjustMesh");
    const button2 = document.getElementById("downloadMesh");
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;
    button2.disabled = true;

    const qualityMap = {
      veryLow: 5,
      low: 7,
      medium: 10,
      high: 13,
      veryHigh: 15,
    };

    const selectElement = document.getElementById("depthMesh");
    const selectedKey = selectElement.value;
    const depthMesh = qualityMap[selectedKey];

    try {

        await fetch('/make-mesh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                depth: depthMesh
            }),
        });

    } catch (error) {
        alert("An error occurred while re-doing mesh.");
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }

}

async function downloadPC() {
    try {
        const response = await fetch('/download-point-cloud');
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "point_cloud.ply";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            alert("Failed to download point cloud.");
        }
    } catch (error) {
        alert("An error occurred while downloading the point cloud.");
    }
}

async function downloadMesh() {
    try {
        const response = await fetch('/download-mesh');
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "reconstruction.ply";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            alert("Failed to download mesh.");
        }
    } catch (error) {
        alert("An error occurred while downloading the mesh.");
    }
}