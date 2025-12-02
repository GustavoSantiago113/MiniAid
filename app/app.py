import base64
from io import BytesIO
import shutil
from flask import Flask, request, render_template, jsonify, send_file
import os
from PIL import Image
import numpy as np
from utils import utils
import cv2
import io
import atexit
from ultralytics import YOLO
import torch
import trimesh
import open3d as o3d

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['UPLOAD_FOLDER_FRAMES'] = 'static/uploads/images'
app.config['MODELS'] = 'static/models'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER_FRAMES'], exist_ok=True)
os.makedirs(app.config['MODELS'], exist_ok=True)

model = YOLO(os.path.join(app.config['MODELS'], "segmentation_model.pt"))
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def cleanup_upload_folder():
    for filename in os.listdir(app.config['UPLOAD_FOLDER']):
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')

atexit.register(cleanup_upload_folder)

progress_status = {"stage": "idle", "message": "Waiting...", "percent": 0}

def set_progress(stage, message, percent):
    progress_status["stage"] = stage
    progress_status["message"] = message
    progress_status["percent"] = percent

@app.route("/")
def landing_page():
    return render_template('LandingPage.html')

@app.route("/pre-painting")
def pre_painting_page():
    return render_template('PrePainting.html')

@app.route('/uploadImage', methods=['POST'])
def upload_image():

    if 'file' not in request.files:
         return jsonify({'success': False, 'error': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No files uploaded'}), 400

    # Save the file to the upload folder
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename.replace(" ", ""))
    file.save(file_path)

    # Return the filename as JSON
    return jsonify({'success': True, "filename": file.filename.replace(" ", "")})

@app.route("/pre-painting-crop", methods=['GET'])
def pre_painting_page_crop():

    # Get the filename from the query parameters
    filename = request.args.get('filename')
    if not filename:
        return jsonify({"error": "Filename is required"}), 400

    # Render the template with the filename
    return render_template('PrePaintingCrop.html', filename=filename)

@app.route("/crop", methods=['POST'])
def crop_image():

    data = request.json
    base64_image = data['image'].split(',')[1]  # Remove the data URL prefix
    filename = data['filename']

    # Decode the base64 image
    image_data = base64.b64decode(base64_image)
    img = Image.open(BytesIO(image_data))

    # Save the cropped image
    cropped_filename = f"cropped_{filename}"
    cropped_path = os.path.join(app.config['UPLOAD_FOLDER'], cropped_filename)

    # Convert to RGB if image has alpha channel before saving as JPEG
    if img.mode in ("RGBA", "LA"):
        img = img.convert("RGB")
    img.save(cropped_path)

    image = utils.createSketch(cropped_path)
    # Ensure the image is in a format compatible with OpenCV (BGR, uint8)
    if len(image.shape) == 3 and image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    cv2.imwrite(cropped_path, image)

    # Redirect to the color page with the filename
    return jsonify({
        'success': True,
        'croppedFileName': cropped_filename,
        'originalFileName': filename
    })

@app.route("/pre-painting-colors")
def pre_painting_page_colors():

    # Get the filename from the query parameters
    croppedFileName = request.args.get('croppedFileName')
    originalFileName = request.args.get('originalFileName')
    
    return render_template('PrePaintingColors.html', croppedFileName=croppedFileName, originalFileName = originalFileName)

@app.route('/export-pdf', methods=['POST'])
def export_pdf():
    
    data = request.get_json()
    text_color_dict = data.get("textColorDict", {})
    croppedFilename = data["croppedFilename"]
    cropped_path = os.path.join(app.config['UPLOAD_FOLDER'], croppedFilename)

    output = io.BytesIO()
    utils.generate_pdf(cropped_path, text_color_dict, output)

    output.seek(0)

    return send_file(output, as_attachment=True, download_name="color_palette.pdf", mimetype="application/pdf")

@app.route("/post-painting")
def post_painting_page():
    return render_template("PostPainting.html")

@app.route("/uploadImageFrame", methods=['POST'])
def images_upload():
    
    if 'files[]' not in request.files:
        return jsonify({'success': False, 'error': 'No files uploaded'}), 400

    files = request.files.getlist('files[]')
    if not files:
        return jsonify({'success': False, 'error': 'No files selected'}), 400

    for file in files:
        if file.filename == '':
            continue

        # Save each file to the upload folder
        filename = os.path.join(app.config['UPLOAD_FOLDER_FRAMES'], file.filename.replace(" ", ""))
        file.save(filename)

    # Return the filenames as JSON
    return jsonify({'success': True})

@app.route("/post-painting-frames")
def post_painting_frames():
    frames_path = app.config['UPLOAD_FOLDER_FRAMES']
    
    # List all files in the frames directory
    frames = [f for f in os.listdir(frames_path) if os.path.isfile(os.path.join(frames_path, f))]
    
    return render_template('PostPaintingFrames.html', frames=frames)

@app.route("/delete-all-images", methods=["POST"])
def delete_all_images():
    folder_path = app.config['UPLOAD_FOLDER_FRAMES']
    try:
        # Delete all files in the folder
        for filename in os.listdir(folder_path):
            file_path = os.path.join(folder_path, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        return jsonify({"success": True, "message": "All images deleted successfully."})
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to delete images: {str(e)}"}), 500

@app.route("/segment-image", methods=['POST'])
def segment_image():
    
    try:
        data = request.json
        image_path = data['image_path']

        # Load the image
        if image_path.startswith("http"):
            image_path = image_path.split("/static/")[-1]
            image_path = os.path.join("static", image_path)

        confidence = data.get('confidence', 0.75)
        smooth = data.get('smooth', 0.0005)

        # Perform inference
        results = model.predict(image_path, device=device, max_det=1, conf=confidence, save = False, verbose=False)

        polygons = []
        # Extract segmentation coordinates
        for result in results:
            for c in result:
                # Extract the polygon coordinates
                polygons = c.masks.xy[0].astype(int).tolist()
                
                # Convert to numpy array for OpenCV
                poly_np = np.array(polygons, dtype=np.int32)
                # Calculate epsilon (the approximation accuracy)
                epsilon = smooth * cv2.arcLength(poly_np, True)
                approx = cv2.approxPolyDP(poly_np, epsilon, True)
                # Convert back to list of [x, y]
                polygons = approx.reshape(-1, 2).tolist()
                torch.cuda.empty_cache()
        
        if not polygons:
                    return jsonify({'success': True, 'polygons': []})
        
        return jsonify({'success': True, 'polygons': polygons})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route("/download-segmented", methods=['POST'])
def download_segmented():
    try:
        data = request.get_json()
        image_path = data.get('image_path')
        polygon = data.get('polygon')
        
        if not image_path or not polygon:
            return jsonify({"error": "Missing image_path or polygon"}), 400
        
        if len(polygon) < 3:
            return jsonify({"error": "Polygon must have at least 3 points"}), 400

        # Handle URL paths
        if image_path.startswith("http"):
            # Only keep the path after "/static/"
            image_path = image_path.split("/static/")[-1]
            image_path = os.path.join("static", image_path)
        
        # Check if file exists
        if not os.path.exists(image_path):
            return jsonify({"error": f"Image file not found: {image_path}"}), 404

        # Use the utility to crop and mask the image
        output_img = utils.crop_image_with_polygon(image_path, polygon)

        # Save to a BytesIO buffer
        img_io = BytesIO()
        output_img.save(img_io, "PNG")
        img_io.seek(0)

        return send_file(
            img_io, 
            mimetype="image/png", 
            as_attachment=True, 
            download_name="segmented.png"
        )
        
    except Exception as e:
        print(f"Error in download_segmented: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/adjust-black-point", methods=["POST"])
def adjust_black_point():
    data = request.json
    image_src = data["imageSrc"]
    black_point = int(data["blackPoint"])

    # Load the image
    image_path = image_src.split("/static/")[-1]
    image_path = os.path.join("static", image_path)
    img = cv2.imread(image_path)

    # Adjust black point
    adjusted_img = utils.adjust_black_point(img, black_point)

    # Convert to base64 for frontend display
    _, buffer = cv2.imencode(".png", adjusted_img)
    base64_image = base64.b64encode(buffer).decode("utf-8")
    return jsonify({"adjustedImage": f"data:image/png;base64,{base64_image}"})

@app.route("/reconstruction", methods=["POST"])
def reconstruction():
    try:

        # Perform reconstruction
        utils.perform_reconstruction(target_dir=app.config['UPLOAD_FOLDER'])
        scene = trimesh.load('static/uploads/Reconstruction.glb')
        point_cloud_trimesh = scene.geometry['geometry_0']
        points = point_cloud_trimesh.vertices
        colors = point_cloud_trimesh.colors if hasattr(point_cloud_trimesh, 'colors') else None

        # Create Open3D point cloud
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        if colors is not None:
            pcd.colors = o3d.utility.Vector3dVector(colors[:, :3] / 255.0)

        # Save as .ply
        o3d.io.write_point_cloud('static/uploads/Reconstruction.ply', pcd)
        return jsonify({"success": True, "message": "Reconstruction completed successfully."})
    except Exception as e:
        set_progress("error", f"Reconstruction failed: {str(e)}", 0)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/update-visualization", methods=["POST"])
def update_visualization_endpoint():
    try:
        data = request.json
        confidence = float(data.get("confidence", 50.0))
        filter_sky = data.get("filterSky", True)
        filter_black_background = data.get("filterBlackBackground", True)

        print(f"Updating visualization with confidence: {confidence}, filterSky: {filter_sky}, filterBlackBackground: {filter_black_background}")

        # Call the update_visualization function
        target_dir = app.config['UPLOAD_FOLDER']
        utils.update_visualization(
            target_dir=target_dir,
            conf_thres=confidence,
            frame_filter="All",
            mask_black_bg=filter_black_background,
            mask_white_bg=False,
            show_cam=False,
            mask_sky=filter_sky,
            prediction_mode="Pointmap Regression",
            is_example="False",
        )

        scene = trimesh.load('static/uploads/Reconstruction.glb')
        point_cloud_trimesh = scene.geometry['geometry_0']
        points = point_cloud_trimesh.vertices
        colors = point_cloud_trimesh.colors if hasattr(point_cloud_trimesh, 'colors') else None

        # Create Open3D point cloud
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        if colors is not None:
            pcd.colors = o3d.utility.Vector3dVector(colors[:, :3] / 255.0)

        # Save as .ply with timestamp for verification
        ply_path = 'static/uploads/Reconstruction.ply'
        o3d.io.write_point_cloud(ply_path, pcd)
        print(f"PLY file updated at: {ply_path}, file size: {os.path.getsize(ply_path)} bytes")

        return jsonify({"success": True})
    except Exception as e:
        print(f"Error in update_visualization: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/save-updated-point-cloud", methods=["POST"])
def save_updated_point_cloud():
    try:
        # Save the updated point cloud to the same file
        ply_file_path = os.path.join(app.config['UPLOAD_FOLDER'], "Reconstruction.ply")
        with open(ply_file_path, "wb") as f:
            f.write(request.data)

        return jsonify({"success": True, "message": "Point cloud saved successfully."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/download-point-cloud", methods=["GET"])
def download_point_cloud():
    try:
        glbfile = os.path.join(app.config['UPLOAD_FOLDER'], "Reconstruction.ply")
        if not os.path.exists(glbfile):
            return jsonify({"success": False, "message": "Reconstruction file not found"}), 404

        return send_file(glbfile, as_attachment=True, download_name="Reconstruction.ply")
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/download-mesh-point-cloud", methods=["GET"])
def download_mesh_point_cloud():
    try:
        ply_path = os.path.join(app.config['UPLOAD_FOLDER'], "Reconstruction.ply")
        mesh_path = os.path.join(app.config['UPLOAD_FOLDER'], "ReconstructionMesh.ply")

        if not os.path.exists(ply_path):
            return jsonify({"success": False, "message": "Point cloud file not found"}), 404

        # Call the utility function for Poisson reconstruction
        utils.poisson_reconstruction_from_point_cloud(
            input_file=ply_path,
            output_mesh_file=mesh_path,
            depth=10, 
            width=0,
            scale=1.1,
            linear_fit=False
        )

        if not os.path.exists(mesh_path):
            return jsonify({"success": False, "message": "Mesh file not created"}), 500

        return send_file(mesh_path, as_attachment=True, download_name="ReconstructionMesh.ply")
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/save-processed-image", methods=["POST"])
def save_processed_image():
    try:
        data = request.get_json()
        image_data = data.get('imageData')  # base64 image
        filename = data.get('filename', 'processed_image')
        crop_coords = data.get('cropCoords')  # {x, y, width, height}
        target_size = data.get('targetSize')  # {width, height}
        
        if not image_data:
            return jsonify({'success': False, 'error': 'No image data provided'}), 400
        
        # Decode base64 image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        img = Image.open(BytesIO(image_bytes))

        # Apply crop if provided
        if crop_coords:
            x = int(crop_coords.get('x', 0))
            y = int(crop_coords.get('y', 0))
            width = int(crop_coords.get('width', img.width))
            height = int(crop_coords.get('height', img.height))
            img = img.crop((x, y, x + width, y + height))

        # Resize if target size is provided — preserve aspect ratio
        if target_size:
            img_w, img_h = img.size
            has_w = 'width' in target_size and target_size.get('width') not in (None, '')
            has_h = 'height' in target_size and target_size.get('height') not in (None, '')

            if has_w and not has_h:
                target_width = int(target_size.get('width'))
                target_height = max(1, int(round(target_width * img_h / img_w)))
            elif has_h and not has_w:
                target_height = int(target_size.get('height'))
                target_width = max(1, int(round(target_height * img_w / img_h)))
            elif has_w and has_h:
                tw = int(target_size.get('width'))
                th = int(target_size.get('height'))
                scale = min(tw / img_w, th / img_h)
                target_width = max(1, int(round(img_w * scale)))
                target_height = max(1, int(round(img_h * scale)))
            else:
                target_width, target_height = img_w, img_h

            img = img.resize((target_width, target_height), Image.LANCZOS)
        
        # Save to BytesIO
        output = BytesIO()
        img.save(output, format='PNG')
        output.seek(0)
        
        # Ensure filename has .png extension
        if not filename.lower().endswith('.png'):
            filename += '.png'
        
        return send_file(
            output,
            mimetype='image/png',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Error saving processed image: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route("/about")
def about_page():
    return render_template('About.html')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)