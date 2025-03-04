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
});