document.addEventListener("DOMContentLoaded", function () {
  const images = document.getElementsByTagName("img");
  if (images.length > 0) {
    chrome.runtime.sendMessage({ imageUrl: images[0].src });
  } else {
    chrome.runtime.sendMessage({ imageUrl: "https://placehold.co/720x400" });
  }
});
