async function openReconstructionModal() {
    const modal = document.getElementById("reconstructionModal");
    const statusDiv = document.getElementById("reconstructionStatus");
    const messageDiv = document.getElementById("reconstructionMessage");
    const viewerDiv = document.getElementById("pointCloud");

    const slider = document.getElementById("pointCloudConfidenceSlider");
    const sliderValue = document.getElementById("pointCloudConfidenceValue");

    slider.addEventListener("input", function () {
        sliderValue.textContent = `${slider.value}%`;
    });

    modal.style.display = "flex";

    // Show loading spinner and message
    statusDiv.style.display = "block";
    messageDiv.textContent = "Performing reconstruction...";
    viewerDiv.style.display = "none";

    try {
        const response = await fetch('/reconstruction', {
            method: 'POST'
        });
        if (response.ok) {
            statusDiv.style.display = "none";
            viewerDiv.style.display = "block";
            loadPointCloud();
        } else {
            const data = await response.json();
            messageDiv.textContent = data.message || "Failed to start reconstruction.";
        }
    } catch (error) {
        messageDiv.textContent = "An error occurred during reconstruction.";
    }

    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function () {
            modal.style.display = "none";
        });
    });
}

async function updateVisualization() {
    const confidenceSlider = document.getElementById("pointCloudConfidenceSlider");
    const filterSkyCheckbox = document.getElementById("filterSkyCheckbox");
    const filterBlackBackgroundCheckbox = document.getElementById("filterBlackBackgroundCheckbox");

    const loader = document.getElementById("loader-container");
    const container = document.getElementById("pointCloudScene");

    // Show loader while updating visualization
    loader.style.display = "flex";
    container.style.display = "none";

    try {
        const response = await fetch("/update-visualization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                confidence: confidenceSlider.value,
                filterSky: filterSkyCheckbox.checked,
                filterBlackBackground: filterBlackBackgroundCheckbox.checked,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to update visualization");
        }

        const data = await response.json();
        if (data.success) {
            // Reload the updated point cloud
            loadPointCloud();
        } else {
            console.error("Error updating visualization:", data.message);
        }
    } catch (error) {
        console.error("Error updating visualization:", error);
    } finally {
        loader.style.display = "none";
        container.style.display = "block";
    }
}

async function downloadPointCloud() {
    const button = document.getElementById("downloadPC");

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try {
        const response = await fetch('/download-point-cloud', {
            method: 'GET',
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = "Reconstruction.ply";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            const errorData = await response.json();
            alert(`Failed to download point cloud: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error("Error downloading point cloud:", error);
        alert("An error occurred while downloading the point cloud.");
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

function loadPointCloud() {
    const container = document.getElementById("pointCloudScene");
    const loader = document.getElementById("loader-container");

    console.log("Starting to load point cloud");

    // Hide loader first
    if (loader) {
        loader.style.display = 'none';
    }

    // Show the container
    container.style.display = 'block';

    // Append a cache-busting query parameter to the .ply file URL
    const plyFileUrl = `static/uploads/Reconstruction.ply?timestamp=${new Date().getTime()}`;

    // Load the .ply file
    fetch(plyFileUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.arrayBuffer();
        })
        .then(buffer => {
            console.log("Buffer received, showing viewer and initializing VTK...");
            
            // Initialize VTK
            const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                rootContainer: container,
                background: [1, 1, 1],
                containerStyle: {
                    width: "40vw",
                    height: "100%",
                    position: "relative",
                },
            });

            const renderer = fullScreenRenderer.getRenderer();
            const renderWindow = fullScreenRenderer.getRenderWindow();

            const reader = vtk.IO.Geometry.vtkPLYReader.newInstance();
            const mapper = vtk.Rendering.Core.vtkMapper.newInstance({ scalarVisibility: false });
            const actor = vtk.Rendering.Core.vtkActor.newInstance();

            actor.setMapper(mapper);
            mapper.setInputConnection(reader.getOutputPort());
            renderer.addActor(actor);

            mapper.setScalarVisibility(true);
            reader.parseAsArrayBuffer(buffer);
            renderer.resetCamera();
            renderWindow.render();
            
            console.log("Point cloud loaded and rendered successfully");
        })
        .catch(error => {
            console.error("Failed to load point cloud:", error);
            if (loader) {
                loader.style.display = 'none';
            }
            container.style.display = 'block';
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Failed to load 3D model</div>';
        });
}