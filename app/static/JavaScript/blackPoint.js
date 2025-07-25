async function openBlackPointModal(imageSrc) {
    const modal = document.getElementById("blackPointModal");
    const blackPointImage = document.getElementById("blackPointImage");
    const slider = document.getElementById("blackPointSlider");
    const sliderValue = document.getElementById("blackPointValue");

    blackPointImage.src = imageSrc;
    loadedModalImage = imageSrc;

    // Display the modal
    modal.style.display = "flex";

    slider.addEventListener("input", function () {
        sliderValue.textContent = `${slider.value}%`;
    });

    // Perform black point adjustment when the user stops interacting with the slider
    slider.addEventListener("mouseup", async function () {
        const blackPoint = slider.value;
        const adjustedImage = await adjustBlackPoint(loadedModalImage, blackPoint);
        blackPointImage.src = adjustedImage;
    });

    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', async function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    document.getElementById("downloadBlackPoint").addEventListener("click", async function () {
        const blackPoint = slider.value;
        const button = document.getElementById("downloadBlackPoint");
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loader"></span>';
        button.disabled = true;
        const adjustedImage = await adjustBlackPoint(loadedModalImage, blackPoint, true);

        // Instead of downloading via link, call Python API
        if (window.pywebview) {
            await window.pywebview.api.save_black_point_image(adjustedImage);
        } else {
            alert("Download not supported in this environment.");
        }

        button.disabled = false;
        button.innerHTML = originalText;
    });
}

async function adjustBlackPoint(imageSrc, blackPoint, download = false) {
    const response = await fetch("/adjust-black-point", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageSrc, blackPoint, download }),
    });

    const data = await response.json();
    return data.adjustedImage; // Returns the base64 image
}