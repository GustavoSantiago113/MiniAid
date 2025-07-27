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

async function downloadBlackPointImage() {
    const slider = document.getElementById("blackPointSlider");
    const blackPoint = slider.value;

    const button = document.getElementById("downloadBlackPoint");
    const originalText = button.innerHTML;

    // Prevent multiple downloads by disabling the button
    if (button.disabled) return;

    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;

    try {
        const response = await fetch("/adjust-black-point", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageSrc: loadedModalImage, blackPoint: blackPoint }),
        });

        if (!response.ok) {
            throw new Error("Failed to download black point image");
        }

        const data = await response.json();
        const base64Image = data.adjustedImage;

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = base64Image;
        a.download = "adjusted_black_point.png";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(base64Image);
    } catch (error) {
        console.error("Error downloading black point image:", error);
        alert("An error occurred while downloading the image.");
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}