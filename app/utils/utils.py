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
from dust3r.cloud_opt import GlobalAlignerMode, global_aligner
from dust3r.image_pairs import make_pairs
from dust3r.inference import inference
from dust3r.model import AsymmetricCroCo3DStereo
from dust3r.utils.image import load_images
import open3d as o3d

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

def get_segmentation_polygon(coordinates, model, source, smooth=0.0005):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    with torch.no_grad():
        results = model(source, device=device, bboxes=coordinates, imgsz=1024, save=False, verbose=False)
    
    for result in results:
        for c in result:
            # Extract the polygon coordinates
            polygon = c.masks.xy[0].astype(int).tolist()
            if not polygon:
                continue
            # Convert to numpy array for OpenCV
            poly_np = np.array(polygon, dtype=np.int32)
            # Calculate epsilon (the approximation accuracy)
            epsilon = smooth * cv2.arcLength(poly_np, True)
            approx = cv2.approxPolyDP(poly_np, epsilon, True)
            # Convert back to list of [x, y]
            simplified = approx.reshape(-1, 2).tolist()
            del results
            torch.cuda.empty_cache()
            return simplified

    # If no results, return an empty list
    del results
    torch.cuda.empty_cache()
    return []

def crop_image_with_polygon(image_path, polygon):
    # Open image with PIL to handle EXIF orientation
    pil_img = PILImage.open(image_path).convert("RGBA")
    img = np.array(pil_img)

    # Convert RGBA to BGRA for OpenCV
    img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    # Create mask
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    pts = np.array(polygon, dtype=np.int32)
    cv2.fillPoly(mask, [pts], 255)

    # Apply mask to alpha channel
    img[:, :, 3] = mask

    # Crop to bounding rect of polygon
    x, y, w, h = cv2.boundingRect(pts)
    cropped = img[y:y+h, x:x+w]

    # Convert BGRA back to RGBA for PIL
    cropped = cv2.cvtColor(cropped, cv2.COLOR_BGRA2RGBA)

    # Convert to PIL Image for Flask send_file
    return PILImage.fromarray(cropped)

def reconstruct_cloud_point(folder_path, progress_callback=None, check_cancelled=None):
    if check_cancelled and check_cancelled():
        return None
        
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    batch_size = 1
    schedule = "cosine"
    lr = 0.01
    niter = 300
    model_name = "naver/DUSt3R_ViTLarge_BaseDecoder_512_dpt"
    model = AsymmetricCroCo3DStereo.from_pretrained(model_name).to(device)

    if progress_callback:
        progress_callback("loading", "Loading images...", 5)
    if check_cancelled and check_cancelled():
        return None

    images = load_images(folder_path, size=512)
    
    if progress_callback:
        progress_callback("pairing", "Pairing images...", 10)
    if check_cancelled and check_cancelled():
        return None

    pairs = make_pairs(images, scene_graph="complete", prefilter=None, symmetrize=True)
    
    if progress_callback:
        progress_callback("inference", "Running inference...", 30)
    if check_cancelled and check_cancelled():
        return None

    output = inference(pairs, model, device, batch_size=batch_size)
    
    if check_cancelled and check_cancelled():
        return None

    if progress_callback:
        progress_callback("aligning", "Global alignement...", 70)
    
    scene = global_aligner(
        output, device=device, mode=GlobalAlignerMode.PointCloudOptimizer
    )
    
    if check_cancelled and check_cancelled():
        return None

    loss = scene.compute_global_alignment(
        init="mst", niter=niter, schedule=schedule, lr=lr
    )
    
    if progress_callback:
        progress_callback("done", "Reconstruction finished!", 100)

    return scene

def poisson_reconstruction_from_point_cloud(
    input_file, output_mesh_file, depth=9, width=0, scale=1.1, linear_fit=False
):

    pcd = o3d.io.read_point_cloud(input_file)

    if not pcd.has_normals():
        pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamKNN(knn=30))
        pcd.orient_normals_consistent_tangent_plane(k=30)

    with o3d.utility.VerbosityContextManager(o3d.utility.VerbosityLevel.Debug) as cm:
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=depth, width=width, scale=scale, linear_fit=linear_fit
        )

    density_colors = np.asarray(densities)
    density_colors = density_colors / density_colors.max()
    density_mesh = o3d.geometry.TriangleMesh()
    density_mesh.vertices = mesh.vertices
    density_mesh.triangles = mesh.triangles
    density_mesh.vertex_colors = o3d.utility.Vector3dVector(
        np.zeros((len(density_mesh.vertices), 3))
    )

    vertices_to_remove = densities < np.quantile(densities, 0.1)
    mesh.remove_vertices_by_mask(vertices_to_remove)

    o3d.visualization.draw_geometries([mesh], mesh_show_back_face=True)

    o3d.io.write_triangle_mesh(output_mesh_file, mesh)

    return mesh