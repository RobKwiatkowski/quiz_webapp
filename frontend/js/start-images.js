const START_IMAGES = [
  "./assets/start-images/start_image_1.png",
  "./assets/start-images/start_image_2.png"
];

function setRandomStartImage() {
  const imageEl = document.getElementById("start-hero-image");

  if (!imageEl || !START_IMAGES.length) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * START_IMAGES.length);
  imageEl.src = START_IMAGES[randomIndex];
}
