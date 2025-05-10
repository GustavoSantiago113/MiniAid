import io
import numpy as np
import scipy.ndimage
import imageio
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from PIL import Image as PILImage
import os
import cv2
import torch

def rgb2gray(rgb):
    # 2 dimensional array to convert image to sketch
    return np.dot(rgb[..., :3], [0.2989, 0.5870, .1140])
 
def createSketch(img):
    
    ss = imageio.imread(img)
    gray = rgb2gray(ss)
    
    i = 255-gray
    
    # To convert into a blur image
    blur = scipy.ndimage.filters.gaussian_filter(i, sigma=13)

    # If image is greater than 255 (which is not possible) it will convert it to 255
    final_sketch = blur*255/(255-gray)
    final_sketch[final_sketch > 255] = 255
    final_sketch[gray == 255] = 255
 
    # To convert any suitable existing column to categorical type we will use aspect function
    # And uint8 is for 8-bit signed integer

    return final_sketch.astype('uint8')

def generate_pdf(image_path, text_color_dict, output):
    c = canvas.Canvas(output, pagesize=letter)
    width, height = letter

    # Set margins
    margin = 0.5 * inch
    text_x = margin
    text_y = height - margin

    # Load the image
    img = PILImage.open(image_path)
    img_width, img_height = img.size

    # Resize the image to fit within a constant size while keeping proportions
    aspect_ratio = img_width / img_height
    img_height = 500
    img_width = int(img_height * aspect_ratio)

    # Calculate the position to center the image on the right part
    img_x = width - img_width - margin
    img_y = (height - img_height) / 2

    # Draw the image
    c.drawImage(image_path, img_x, img_y, width=img_width, height=img_height)

    # Draw the dictionary items
    column_width = (width - img_width - 2 * margin) / 2
    for i, (text, color) in enumerate(text_color_dict.items()):
        if text_y < margin:
            text_x += column_width
            text_y = height - margin

        c.setFillColor(HexColor(color))
        c.rect(text_x, text_y - 10, 10, 10, fill=1)
        c.setFillColor(HexColor("#000000"))
        c.drawString(text_x + 15, text_y - 10, f"{text}: {color}")
        text_y -= 20

    c.save()

def segmenting_image(coordinates, model, source):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    results = model.predict(source, device=device, bboxes=coordinates, imgsz=1024, conf=0.25)
    
    for result in results:
        img = np.copy(result.orig_img)
        for ci, c in enumerate(result):
            b_mask = np.zeros(img.shape[:2], np.uint8)
            
            # Create contour mask
            contour = c.masks.xy.pop().astype(np.int32).reshape(-1, 1, 2)
            cv2.drawContours(b_mask, [contour], -1, (255, 255, 255), cv2.FILLED)
            
            # Create an RGBA image with an alpha channel
            isolated = np.zeros((*img.shape[:2], 4), dtype=np.uint8)
            isolated[..., :3] = img
            isolated[b_mask == 0, 3] = 0    # Set alpha to 0 for background
            isolated[b_mask != 0, 3] = 255  # Set alpha to 255 for the segmented object
            
            contour = contour.reshape(-1, 2)
            x_min, y_min = np.min(contour, axis=0)
            x_max, y_max = np.max(contour, axis=0)
            
            # Crop the image to get only the segmented object
            cropped_image = isolated[y_min:y_max, x_min:x_max]
            
            # Create a square image with 4 channels (RGBA)
            height, width = cropped_image.shape[:2]
            size = max(height, width)
            square_image = np.zeros((size, size, 4), dtype=np.uint8)
            
            # Calculate the top-left corner to centralize the image
            y_offset = (size - height) // 2
            x_offset = (size - width) // 2
            
            # Copy the cropped image into the square image
            square_image[y_offset:y_offset + height, x_offset:x_offset + width] = cropped_image
            
            # Convert the image to bytes
            success, buffer = cv2.imencode(".png", square_image)
            if not success:
                raise Exception("Failed to encode image")
                
            image_bytes = io.BytesIO(buffer)
            image_bytes.seek(0)

            undesired_image = os.path.basename(source)

            if os.path.exists(undesired_image):
                os.remove(undesired_image)
            
            return image_bytes
    
    
    
    # If no results, return an empty BytesIO object
    return io.BytesIO()