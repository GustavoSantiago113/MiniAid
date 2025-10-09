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

let vtkRendererInstance = null;

// Keep state for picking/deleting
const pcState = {
    polyData: null,
    renderer: null,
    renderWindow: null,
    picker: null,
    selected: new Set(),
    baseColors: null,   // Uint8Array copy of original colors
    scalars: null       // vtkDataArray currently used as scalars (mutable)
};

function loadPointCloud() {
    const container = document.getElementById("pointCloudScene");
    const loader = document.getElementById("loader-container");
    
    if (typeof vtk === "undefined") {
        console.error("VTK.js not loaded");
        container.innerHTML = '<div style="color: #dc3545; padding:20px; text-align:center;">VTK.js not loaded</div>';
        return;
    }

    if (loader) loader.style.display = 'none';

    container.innerHTML = '';
    if (vtkRendererInstance) {
        try { vtkRendererInstance.delete(); } catch (e) { console.warn("Error destroying previous VTK instance:", e); }
        vtkRendererInstance = null;
    }

    container.style.display = 'block';
    container.style.height = '600px';

    const plyFileUrl = `static/uploads/Reconstruction.ply?v=${Date.now()}`;
    fetch(plyFileUrl)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
        .then(buffer => {
            const fullScreenRenderer = vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
                rootContainer: container,
                background: [0.9, 0.9, 0.9],
                containerStyle: { width: "100%", height: "600px", position: "relative" },
            });
            vtkRendererInstance = fullScreenRenderer;

            const renderer = fullScreenRenderer.getRenderer();
            const renderWindow = fullScreenRenderer.getRenderWindow();

            // Pipeline
            const reader = vtk.IO.Geometry.vtkPLYReader.newInstance();
            const mapper = vtk.Rendering.Core.vtkMapper.newInstance();
            const actor = vtk.Rendering.Core.vtkActor.newInstance();

            actor.setMapper(mapper);
            mapper.setInputConnection(reader.getOutputPort());
            // Render as points and increase size for better clicking
            actor.getProperty().setRepresentationToPoints();
            actor.getProperty().setPointSize(3.0);

            reader.parseAsArrayBuffer(buffer);

            const polyData = reader.getOutputData();

            // Ensure we have per-vertex RGB scalars to allow highlighting
            let scalars = polyData.getPointData().getScalars();
            const vtkDataArray = vtk.Common.Core.vtkDataArray;
            const numPts = polyData.getPoints().getNumberOfPoints();

            if (!scalars) {
                // Create white colors
                const values = new Uint8Array(numPts * 3);
                values.fill(255);
                scalars = vtkDataArray.newInstance({
                    name: 'Colors',
                    numberOfComponents: 3,
                    values,
                });
                polyData.getPointData().setScalars(scalars);
            } else if (scalars.getNumberOfComponents() > 3) {
                // If RGBA, strip alpha into RGB for simplicity
                const src = scalars.getData();
                const rgb = new Uint8Array(numPts * 3);
                for (let i = 0; i < numPts; i++) {
                    rgb[i * 3 + 0] = src[i * 4 + 0];
                    rgb[i * 3 + 1] = src[i * 4 + 1];
                    rgb[i * 3 + 2] = src[i * 4 + 2];
                }
                scalars = vtkDataArray.newInstance({
                    name: 'Colors',
                    numberOfComponents: 3,
                    values: rgb,
                });
                polyData.getPointData().setScalars(scalars);
            }

            // Keep a copy of original colors to restore when deselecting
            pcState.baseColors = new Uint8Array(scalars.getData());
            pcState.scalars = scalars;

            renderer.addActor(actor);
            renderer.resetCamera();
            renderWindow.render();

            // Picker setup
            const picker = (vtk.Rendering.Core.vtkPointPicker && vtk.Rendering.Core.vtkPointPicker.newInstance)
                ? vtk.Rendering.Core.vtkPointPicker.newInstance()
                : vtk.Rendering.Core.vtkPicker.newInstance();
            pcState.polyData = polyData;
            pcState.renderer = renderer;
            pcState.renderWindow = renderWindow;
            pcState.picker = picker;
            pcState.selected.clear();

            const interactor = renderWindow.getInteractor();

            // --- Right-click drag selection ---
            let isRightMouseDown = false;

            interactor.onRightButtonPress(() => {
                isRightMouseDown = true;
            });

            interactor.onRightButtonRelease(() => {
                isRightMouseDown = false;
            });

            interactor.onMouseMove((callData) => {
                if (!isRightMouseDown) return;
                const pos = callData?.position;
                if (!pos) return;
                picker.pick([pos.x, pos.y, 0], renderer);
                let pid = typeof picker.getPointId === 'function' ? picker.getPointId() : -1;

                let worldPos = null;
                if (pid < 0 && typeof picker.getCellId === 'function') {
                    const cellId = picker.getCellId();
                    if (cellId >= 0 && polyData.getPoints()) {
                        worldPos = picker.getPickPosition?.() || null;
                    }
                } else if (pid >= 0 && polyData.getPoints()) {
                    // Get world position of picked point
                    const pts = polyData.getPoints().getData();
                    worldPos = [pts[pid*3+0], pts[pid*3+1], pts[pid*3+2]];
                }

                if (worldPos) {
                    // Select all points within a radius
                    const pts = polyData.getPoints().getData();
                    const radiusSlider = document.getElementById('selectionRadiusSlider');
                    const radius = parseFloat(radiusSlider?.value || "0.05");
                    for (let i = 0; i < numPts; i++) {
                        const dx = pts[i * 3 + 0] - worldPos[0];
                        const dy = pts[i * 3 + 1] - worldPos[1];
                        const dz = pts[i * 3 + 2] - worldPos[2];
                        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
                        if (d < radius && !pcState.selected.has(i)) {
                            pcState.selected.add(i);
                            const colors = pcState.scalars.getData();
                            colors[i*3+0] = 255;
                            colors[i*3+1] = 0;
                            colors[i*3+2] = 0;
                        }
                    }
                    pcState.scalars.modified();
                    pcState.renderWindow.render();
                }
            });

            // --- Left click toggles selection ---
            interactor.onLeftButtonPress((callData) => {
                const pos = callData?.position;
                if (!pos) return;
                picker.pick([pos.x, pos.y, 0], renderer);
                let pid = typeof picker.getPointId === 'function' ? picker.getPointId() : -1;

                if (pid < 0 && typeof picker.getCellId === 'function') {
                    const cellId = picker.getCellId();
                    if (cellId >= 0 && polyData.getPoints()) {
                        const worldPos = picker.getPickPosition?.() || null;
                        if (worldPos) {
                            const pts = polyData.getPoints().getData();
                            let best = -1, bestD = Infinity;
                            for (let i = 0; i < numPts; i++) {
                                const dx = pts[i * 3 + 0] - worldPos[0];
                                const dy = pts[i * 3 + 1] - worldPos[1];
                                const dz = pts[i * 3 + 2] - worldPos[2];
                                const d = dx*dx + dy*dy + dz*dz;
                                if (d < bestD) { bestD = d; best = i; }
                            }
                            pid = best;
                        }
                    }
                }

                if (pid >= 0 && pid < numPts) {
                    togglePointSelection(pid);
                }
            });

            // Delete selected points with Delete key
            document.addEventListener('keydown', onDeleteKey);
            // Hook delete button if present
            const delBtn = document.getElementById('deleteSelectedPC');
            if (delBtn && !delBtn._bound) {
                delBtn.addEventListener('click', deleteSelectedPoints);
                delBtn._bound = true;
            }
            const clearBtn = document.getElementById('clearSelectionPC');
            if (clearBtn && !clearBtn._bound) {
                clearBtn.addEventListener('click', clearSelection);
                clearBtn._bound = true;
            }
        })
        .catch(err => {
            console.error('Failed to load point cloud:', err);
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Failed to load 3D model</div>';
        });
}

function savePointCloud() {
    if (!pcState.polyData) return;

    const pts = pcState.polyData.getPoints().getData();
    const numPts = pcState.polyData.getPoints().getNumberOfPoints();
    const scalars = pcState.polyData.getPointData().getScalars();
    const colors = scalars ? scalars.getData() : null;

    // Build ASCII PLY header
    const header = [
        'ply',
        'format ascii 1.0',
        `element vertex ${numPts}`,
        'property float x',
        'property float y',
        'property float z',
        'property uchar red',
        'property uchar green',
        'property uchar blue',
        'end_header'
    ].join('\n') + '\n';

    // Build body
    const lines = new Array(numPts);
    for (let i = 0; i < numPts; i++) {
        const x = pts[i * 3 + 0];
        const y = pts[i * 3 + 1];
        const z = pts[i * 3 + 2];
        let r = 255, g = 255, b = 255;
        if (colors && colors.length >= (i*3 + 2)) {
            r = colors[i * 3 + 0];
            g = colors[i * 3 + 1];
            b = colors[i * 3 + 2];
        }
        lines[i] = `${x} ${y} ${z} ${r} ${g} ${b}`;
    }

    const plyString = header + lines.join('\n') + '\n';
    const blob = new Blob([plyString], { type: 'application/octet-stream' });

    // Send the Blob to the server
    fetch('/save-updated-point-cloud', {
        method: 'POST',
        headers: { /* no Content-Type so browser sets correct multipart type */ },
        body: blob,
    })
        .then((response) => {
            if (!response.ok) throw new Error('Failed to save updated point cloud');
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                console.log('Point cloud saved successfully');
                // Reload the updated point cloud
                loadPointCloud();
            } else {
                console.error('Error saving point cloud:', data.message);
            }
        })
        .catch((error) => {
            console.error('Error saving point cloud:', error);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    const radiusSlider = document.getElementById('selectionRadiusSlider');
    const radiusValue = document.getElementById('selectionRadiusValue');
    if (radiusSlider && radiusValue) {
        radiusSlider.addEventListener('input', () => {
            radiusValue.textContent = radiusSlider.value;
        });
        radiusValue.textContent = radiusSlider.value;
    }
});

// Highlight toggle
function togglePointSelection(pid) {
    const colors = pcState.scalars.getData(); // Uint8Array
    if (pcState.selected.has(pid)) {
        pcState.selected.delete(pid);
        // restore original color
        colors[pid*3+0] = pcState.baseColors[pid*3+0];
        colors[pid*3+1] = pcState.baseColors[pid*3+1];
        colors[pid*3+2] = pcState.baseColors[pid*3+2];
    } else {
        pcState.selected.add(pid);
        // set to red highlight
        colors[pid*3+0] = 255;
        colors[pid*3+1] = 0;
        colors[pid*3+2] = 0;
    }
    pcState.scalars.modified();
    pcState.renderWindow.render();
}

function clearSelection() {
    if (!pcState.scalars) return;
    const colors = pcState.scalars.getData();
    colors.set(pcState.baseColors);
    pcState.selected.clear();
    pcState.scalars.modified();
    pcState.renderWindow.render();
}

function onDeleteKey(e) {
    if (e.key === 'Delete') {
        deleteSelectedPoints();
    }
}

function deleteSelectedPoints() {
    if (!pcState.polyData || pcState.selected.size === 0) return;

    const keep = [];
    const pts = pcState.polyData.getPoints().getData();
    const n = pcState.polyData.getPoints().getNumberOfPoints();

    for (let i = 0; i < n; i++) {
        if (!pcState.selected.has(i)) keep.push(i);
    }
    if (keep.length === n) return;

    // Rebuild points
    const newPts = new Float32Array(keep.length * 3);
    for (let i = 0; i < keep.length; i++) {
        const k = keep[i];
        newPts[i * 3 + 0] = pts[k * 3 + 0];
        newPts[i * 3 + 1] = pts[k * 3 + 1];
        newPts[i * 3 + 2] = pts[k * 3 + 2];
    }
    const vtkPoints = vtk.Common.Core.vtkPoints;
    const pObj = vtkPoints.newInstance();
    pObj.setData(newPts, 3);
    pcState.polyData.setPoints(pObj);

    // Rebuild colors (use baseColors to preserve originals where possible)
    const newColors = new Uint8Array(keep.length * 3);
    for (let i = 0; i < keep.length; i++) {
        const k = keep[i];
        newColors[i * 3 + 0] = pcState.baseColors[k * 3 + 0];
        newColors[i * 3 + 1] = pcState.baseColors[k * 3 + 1];
        newColors[i * 3 + 2] = pcState.baseColors[k * 3 + 2];
    }
    const vtkDataArray = vtk.Common.Core.vtkDataArray;
    const scalars = vtkDataArray.newInstance({
        name: 'Colors',
        numberOfComponents: 3,
        values: newColors,
    });
    pcState.polyData.getPointData().setScalars(scalars);

    // Update state
    pcState.baseColors = newColors.slice();
    pcState.scalars = scalars;
    pcState.selected.clear();

    // Notify and render
    pcState.polyData.modified();
    pcState.renderer.resetCamera();
    pcState.renderWindow.render();

    // Save the updated point cloud
    savePointCloud();
}

async function downloadMeshPointCloud() {
    const button = document.getElementById("downloadMeshPC");
    if (!button) return;

    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try {
        const response = await fetch('/download-mesh-point-cloud', {
            method: 'GET',
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = "ReconstructionMesh.ply";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } else {
            const errorData = await response.json();
            alert(`Failed to download mesh: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error("Error downloading mesh:", error);
        alert("An error occurred while downloading the mesh.");
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}