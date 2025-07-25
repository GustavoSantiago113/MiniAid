import numpy as np
import scipy.ndimage
import imageio
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from PIL import Image as PILImage
import cv2
import os
import torch
import sys
import glob
import gc
import time

sys.path.append("./vggt")

from visual_util import predictions_to_glb
from vggt.models.vggt import VGGT
from vggt.utils.load_fn import load_and_preprocess_images
from vggt.utils.pose_enc import pose_encoding_to_extri_intri
from vggt.utils.geometry import unproject_depth_map_to_point_map

device = "cuda" if torch.cuda.is_available() else "cpu"

model = VGGT()
_URL = "https://huggingface.co/facebook/VGGT-1B/resolve/main/model.pt"
model.load_state_dict(torch.hub.load_state_dict_from_url(_URL))

model.eval()
model = model.to(device)

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

def crop_image_with_polygon(image_path, polygon):
    try:
        # Open image with PIL and convert to RGB (remove alpha if present)
        pil_img = PILImage.open(image_path)
        
        # Handle EXIF orientation properly
        if hasattr(pil_img, '_getexif') and pil_img._getexif() is not None:
            exif = pil_img._getexif()
            orientation = exif.get(0x0112)
            if orientation == 3:
                pil_img = pil_img.rotate(180, expand=True)
            elif orientation == 6:
                pil_img = pil_img.rotate(270, expand=True)
            elif orientation == 8:
                pil_img = pil_img.rotate(90, expand=True)
        
        # Convert to RGB if it has transparency
        if pil_img.mode in ('RGBA', 'LA'):
            background = PILImage.new('RGB', pil_img.size, (255, 255, 255))
            if pil_img.mode == 'RGBA':
                background.paste(pil_img, mask=pil_img.split()[-1])
            else:
                background.paste(pil_img, mask=pil_img.split()[-1])
            pil_img = background
        elif pil_img.mode != 'RGB':
            pil_img = pil_img.convert('RGB')
        
        # Convert to numpy array for OpenCV processing
        img = np.array(pil_img)
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        
        # Create mask
        mask = np.zeros(img.shape[:2], dtype=np.uint8)
        pts = np.array(polygon, dtype=np.int32)
        
        # Ensure polygon coordinates are within image bounds
        pts[:, 0] = np.clip(pts[:, 0], 0, img.shape[1] - 1)
        pts[:, 1] = np.clip(pts[:, 1], 0, img.shape[0] - 1)
        
        cv2.fillPoly(mask, [pts], 255)
        
        # Create output image with transparent background
        height, width = img.shape[:2]
        result = np.zeros((height, width, 4), dtype=np.uint8)
        
        # Copy RGB channels where mask is white
        result[:, :, :3] = img
        result[:, :, 3] = mask  # Alpha channel
        
        # Get bounding rectangle of the polygon
        x, y, w, h = cv2.boundingRect(pts)
        
        # Add some padding if desired (optional)
        padding = 5
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(width - x, w + 2 * padding)
        h = min(height - y, h + 2 * padding)
        
        # Crop to bounding rectangle
        cropped = result[y:y+h, x:x+w]
        
        # Convert back to PIL Image
        cropped_rgb = cv2.cvtColor(cropped, cv2.COLOR_BGRA2RGBA)
        return PILImage.fromarray(cropped_rgb)
        
    except Exception as e:
        print(f"Error in crop_image_with_polygon: {e}")
        raise e

def adjust_black_point(img, black_point=20):
    """
    Adjust the black point of the image.
    """
    img = img.astype(np.float32)

    # Subtract black point
    img = np.clip(img - black_point, 0, 255 - black_point)

    # Rescale to full 0-255 range
    img = (img / (255 - black_point)) * 255
    img = np.clip(img, 0, 255).astype(np.uint8)

    return img

def run_model(target_dir, model):
    """
    Run the VGGT model on images in the 'target_dir/images' folder and return predictions.
    """
    #print(f"Processing images from {target_dir}")

    #start_time = time.time()
    gc.collect()
    torch.cuda.empty_cache()

    # Move model to device
    model = model.to(device)
    model.eval()

    # Load and preprocess images
    image_names = glob.glob(os.path.join(target_dir, "images", "*"))
    image_names = sorted(image_names)
    #print(f"Found {len(image_names)} images")
    if len(image_names) == 0:
        raise ValueError("No images found. Check your upload.")

    images = load_and_preprocess_images(image_names).to(device)
    #print(f"Preprocessed images shape: {images.shape}")

    # Run inference
    #print("Running inference...")
    #dtype = torch.bfloat16 if torch.cuda.get_device_capability()[0] >= 8 else torch.float16

    with torch.no_grad():
        #with torch.cuda.amp.autocast(dtype=dtype):
        predictions = model(images)

    # Convert pose encoding to extrinsic and intrinsic matrices
    #print("Converting pose encoding to extrinsic and intrinsic matrices...")
    extrinsic, intrinsic = pose_encoding_to_extri_intri(predictions["pose_enc"], images.shape[-2:])
    predictions["extrinsic"] = extrinsic
    predictions["intrinsic"] = intrinsic

    # Convert tensors to numpy
    for key in predictions.keys():
        if isinstance(predictions[key], torch.Tensor):
            predictions[key] = predictions[key].cpu().numpy().squeeze(0)  # remove batch dimension

    # Generate world points from depth map
    #print("Computing world points from depth map...")
    depth_map = predictions["depth"]  # (S, H, W, 1)
    world_points = unproject_depth_map_to_point_map(depth_map, predictions["extrinsic"], predictions["intrinsic"])
    predictions["world_points_from_depth"] = world_points

    # Clean up
    torch.cuda.empty_cache()
    return predictions

def perform_reconstruction(target_dir,
    conf_thres=50.0,
    frame_filter="All",
    mask_black_bg=True,
    mask_white_bg=False,
    show_cam=False,
    mask_sky=True,
    prediction_mode="Pointmap Regression",
):
    """
    Perform reconstruction using the already-created target_dir/images.
    """
    if not os.path.isdir(target_dir) or target_dir == "None":
        return None, "No valid target directory found. Please upload first.", None, None

    start_time = time.time()
    gc.collect()
    torch.cuda.empty_cache()

    # Prepare frame_filter dropdown
    target_dir_images = os.path.join(target_dir, "images")
    all_files = sorted(os.listdir(target_dir_images)) if os.path.isdir(target_dir_images) else []
    all_files = [f"{i}: {filename}" for i, filename in enumerate(all_files)]
    frame_filter_choices = ["All"] + all_files

    print("Running run_model...")
    with torch.no_grad():
        predictions = run_model(target_dir, model)

    # Save predictions
    prediction_save_path = os.path.join(target_dir, "predictions.npz")
    np.savez(prediction_save_path, **predictions)

    # Handle None frame_filter
    if frame_filter is None:
        frame_filter = "All"

    # Build a GLB file name
    glbfile = os.path.join(
        target_dir,
        f"Reconstruction.glb",
    )

    # Convert predictions to GLB
    glbscene = predictions_to_glb(
        predictions,
        conf_thres=conf_thres,
        filter_by_frames=frame_filter,
        mask_black_bg=mask_black_bg,
        mask_white_bg=mask_white_bg,
        show_cam=show_cam,
        mask_sky=mask_sky,
        target_dir=target_dir,
        prediction_mode=prediction_mode,
    )
    glbscene.export(file_obj=glbfile)

    # Cleanup
    del predictions
    gc.collect()
    torch.cuda.empty_cache()

    #end_time = time.time()
    #print(f"Total time: {end_time - start_time:.2f} seconds (including IO)")
    #print(f"Reconstruction Success ({len(all_files)} frames).")

def update_visualization(
    target_dir, conf_thres, frame_filter, mask_black_bg, mask_white_bg, show_cam, mask_sky, prediction_mode, is_example
):
    """
    Reload saved predictions from npz, create (or reuse) the GLB for new parameters,
    and return it for the 3D viewer. If is_example == "True", skip.
    """

    # If it's an example click, skip as requested
    if is_example == "True":
        return None, "No reconstruction available. Please click the Reconstruct button first."

    if not target_dir or target_dir == "None" or not os.path.isdir(target_dir):
        return None, "No reconstruction available. Please click the Reconstruct button first."

    predictions_path = os.path.join(target_dir, "predictions.npz")
    if not os.path.exists(predictions_path):
        return None, f"No reconstruction available at {predictions_path}. Please run 'Reconstruct' first."

    key_list = [
        "pose_enc",
        "depth",
        "depth_conf",
        "world_points",
        "world_points_conf",
        "images",
        "extrinsic",
        "intrinsic",
        "world_points_from_depth",
    ]

    loaded = np.load(predictions_path)
    predictions = {key: np.array(loaded[key]) for key in key_list}

    glbfile = os.path.join(
        target_dir,
        f"Reconstruction.glb",
    )

    glbscene = predictions_to_glb(
        predictions,
        conf_thres=conf_thres,
        filter_by_frames=frame_filter,
        mask_black_bg=mask_black_bg,
        mask_white_bg=mask_white_bg,
        show_cam=show_cam,
        mask_sky=mask_sky,
        target_dir=target_dir,
        prediction_mode=prediction_mode,
    )
    glbscene.export(file_obj=glbfile)

    return glbfile