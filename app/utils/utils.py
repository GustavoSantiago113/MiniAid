import io
import numpy as np
import scipy.ndimage
import imageio
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from PIL import Image as PILImage
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

def get_segmentation_polygon(coordinates, model, source, epsilon_ratio=0.0005):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    results = model.predict(source, device=device, bboxes=coordinates, imgsz=1024, conf=0.25)
    
    for result in results:
        for c in result:
            # Extract the polygon coordinates
            polygon = c.masks.xy.pop().astype(int).tolist()
            if not polygon:
                continue
            # Convert to numpy array for OpenCV
            poly_np = np.array(polygon, dtype=np.int32)
            # Calculate epsilon (the approximation accuracy)
            epsilon = epsilon_ratio * cv2.arcLength(poly_np, True)
            approx = cv2.approxPolyDP(poly_np, epsilon, True)
            # Convert back to list of [x, y]
            simplified = approx.reshape(-1, 2).tolist()
            return simplified

    # If no results, return an empty list
    return []