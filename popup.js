document.addEventListener("DOMContentLoaded", function () {
  const urlInput = document.getElementById("url-input");
  const imagePreview = document.getElementById("image-preview");
  const spinner = document.getElementById("spinner");
  const downloadBtn = document.getElementById("download-btn");
  const fileTypeSelect = document.getElementById("file-type");
  const resolutionSelect = document.getElementById("resolution");
  const messageBox = document.getElementById("message-box");

  const youtubeResolutions = {
    original: "maxresdefault.jpg",
    "1080p": "maxresdefault.jpg",
    "720p": "sddefault.jpg",
    "480p": "hqdefault.jpg",
  };

  // - Listen for the message from content.js
  chrome.runtime.onMessage.addListener(function (message) {
    if (message.imageUrl) {
      imagePreview.src = message.imageUrl;
      spinner.style.display = "none";
      imagePreview.style.display = "block";
      messageBox.textContent = "Image loaded successfully!";
      downloadBtn.disabled = false;
    }
  });

  // - Update image preview when URL is input
  urlInput.addEventListener("input", function () {
    const imageUrl = getYouTubeThumbnail(urlInput.value) || urlInput.value;
    updateImagePreview(imageUrl);
  });

  resolutionSelect.addEventListener("change", function () {
    const imageUrl = getYouTubeThumbnail(urlInput.value);
    updateImagePreview(imageUrl);
  });

  function updateImagePreview(imageUrl) {
    if (imageUrl) {
      if (imagePreview.style.display !== "block") {
        spinner.style.display = "block";
        imagePreview.style.display = "none";
      }

      const img = new Image();
      img.onload = function () {
        imagePreview.src = imageUrl;
        imagePreview.style.display = "block";
        spinner.style.display = "none";
        downloadBtn.disabled = false;
      };
      img.onerror = function () {
        imagePreview.src = "https://placehold.co/720x400";
        spinner.style.display = "block";
        downloadBtn.disabled = true;
        messageBox.textContent = "Failed to load image. Please try again.";
      };

      img.src = imageUrl;
    } else {
      imagePreview.src = "https://placehold.co/720x400";
      spinner.style.display = "block";
      messageBox.textContent = "Please enter a valid URL.";
      downloadBtn.disabled = true;
    }
  }

  // - Extract YouTube thumbnail based on resolution
  function getYouTubeThumbnail(url) {
    const youtubeRegex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
      const videoId = match[1];
      const resolution = resolutionSelect.value || "original";
      const thumbnailType =
        youtubeResolutions[resolution] || "maxresdefault.jpg";
      return `https://img.youtube.com/vi/${videoId}/${thumbnailType}`;
    }
    return null;
  }

  downloadBtn.addEventListener("click", function () {
    const imageUrl = getYouTubeThumbnail(urlInput.value) || urlInput.value;
    const fileType = fileTypeSelect.value;

    //  messageBox.textContent = "Processing image...";

    fetch(imageUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Image fetch failed");
        const contentType = response.headers.get("Content-Type");
        return response.blob().then((blob) => {
          if (contentType.includes("svg")) {
            return convertSVGToRaster(blob, fileType);
          } else {
            return convertImageToFileType(blob, fileType);
          }
        });
      })
      .then((convertedBlob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(convertedBlob);
        a.download = `downloaded_image.${fileType}`;
        a.click();
        URL.revokeObjectURL(a.href); // Clean up the Blob URL

        // messageBox.textContent = "Download started!";
      })
      .catch((error) => {
        console.error("Error downloading image:", error);
        messageBox.textContent = "Error downloading image. Please try again.";
      });
  });

  // - Convert image to selected file type (JPEG, PNG, etc.)
  function convertImageToFileType(blob, fileType) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectURL = URL.createObjectURL(blob);

      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (convertedBlob) => resolve(convertedBlob),
          `image/${fileType}`
        );
      };
      img.onerror = () => {
        messageBox.textContent = "Failed to convert image.";
        reject(new Error("Failed to convert image"));
      };
      img.src = objectURL;
    });
  }

  // - Convert SVG to rasterized image format (e.g., PNG, JPEG)
  function convertSVGToRaster(blob, fileType) {
    return new Promise((resolve, reject) => {
      blob.text().then((svgText) => {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
        const svgElement = svgDoc.documentElement;

        let width = parseInt(svgElement.getAttribute("width")) || 800;
        let height = parseInt(svgElement.getAttribute("height")) || 600;
        const viewBox = svgElement.getAttribute("viewBox");

        if (viewBox) {
          const [, , vw, vh] = viewBox.split(" ").map(Number);
          width = vw || width;
          height = vh || height;
        }

        const svgBlob = new Blob([svgText], {
          type: "image/svg+xml;charset=utf-8",
        });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((convertedBlob) => {
            if (convertedBlob) {
              URL.revokeObjectURL(svgUrl);
              resolve(convertedBlob);
            } else {
              reject(new Error("Failed to create raster image"));
            }
          }, `image/${fileType}`);
        };

        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error("Failed to render SVG"));
        };
        img.src = svgUrl;
      });
    });
  }
});
