import base64
from io import BytesIO
import shutil
from flask import Flask, request, render_template, jsonify, send_file
import os
from PIL import Image
from utils import utils
import cv2
import io
import atexit
from ultralytics import SAM
import threading
import open3d as o3d

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'app/static/uploads'
app.config['UPLOAD_FOLDER_FRAMES'] = 'app/static/uploads/frames'
app.config['MODELS'] = 'app/static/models'
app.config['RECONSTRUCTION'] = 'app/static/reconstruction'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER_FRAMES'], exist_ok=True)
os.makedirs(app.config['MODELS'], exist_ok=True)

#model = SAM(os.path.join(app.config['MODELS'], "mobile_sam.pt"))
model = SAM(os.path.join(app.config['MODELS'], "sam2_l.pt"))

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
    
    for filename in os.listdir(app.config['RECONSTRUCTION']):
        file_path = os.path.join(app.config['RECONSTRUCTION'], filename)
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

    data = request.json
    file = data['image_path']
    coords_dict = data['coordinates']
    coords_list = [
        int(round(coords_dict['x_min'])),  # x_min
        int(round(coords_dict['y_min'])),  # y_min
        int(round(coords_dict['x_max'])),  # x_max
        int(round(coords_dict['y_max']))   # y_max
    ]
    confidence = data.get('confidence', 0.5)
    smooth = data.get('smooth', 0.0005)
    
    if file.startswith("http"):
        # Only keep the path after "/static/"
        file = file.split("/static/")[-1]
        file = os.path.join("app", "static", file)

    # Get the image data
    polygon_coords = utils.get_segmentation_polygon(coords_list, model, file, conf=confidence, smooth=smooth)

    # Return the image as a downloadable file
    return jsonify({'success': True, 'polygon': polygon_coords})

@app.route("/download-segmented", methods=['POST'])
def download_segmented():
    data = request.get_json()
    image_path = data['image_path']
    polygon = data['polygon']

    if image_path.startswith("http"):
        # Only keep the path after "/static/"
        image_path = image_path.split("/static/")[-1]
        image_path = os.path.join("app", "static", image_path)

    # Use the utility to crop and mask the image
    output_img = utils.crop_image_with_polygon(image_path, polygon)

    # Save to a BytesIO buffer
    img_io = BytesIO()
    output_img.save(img_io, "PNG")
    img_io.seek(0)

    return send_file(img_io, mimetype="image/png", as_attachment=True, download_name="segmented.png")

reconstruction_thread = None

@app.route("/make-point-cloud", methods=['POST'])
def point_cloud():
    global reconstruction_thread, progress_status

    # Reset progress status
    progress_status = {"stage": "idle", "message": "Waiting...", "percent": 0}

    # Check if a reconstruction thread is already running
    if reconstruction_thread and reconstruction_thread.is_alive():
        return jsonify({'success': False, 'message': 'Reconstruction is already in progress.'}), 400

    images_folder = app.config['UPLOAD_FOLDER_FRAMES']

    def run_reconstruction():
        try:
            set_progress("start", "Starting reconstruction...", 0)
            utils.reconstruct_cloud_point(images_folder, progress_callback=set_progress)
            if progress_status["stage"] != "cancelled":
                set_progress("done", "Reconstruction finished!", 100)
        finally:
            # Reset the thread after completion
            global reconstruction_thread
            reconstruction_thread = None

    # Start a new reconstruction thread
    reconstruction_thread = threading.Thread(target=run_reconstruction)
    reconstruction_thread.start()

    return jsonify({'success': True})

@app.route("/reconstruction-progress")
def reconstruction_progress():
    return jsonify(progress_status)

@app.route("/cancel-reconstruction", methods=['POST'])
def cancel_reconstruction():
    global progress_status
    progress_status["stage"] = "cancelled"
    progress_status["message"] = "Reconstruction cancelled"
    progress_status["percent"] = 0
    return jsonify({'success': True})

@app.route("/point-cloud-outliers", methods=['POST'])
def remove_outliers():
    data = request.json
    params = data.get('parameters')

    cloud_path = "app/static/reconstruction/point_cloud.ply"
    pcd = o3d.io.read_point_cloud(cloud_path)
    pcd, ind = pcd.remove_statistical_outlier(nb_neighbors=params[0], std_ratio=params[1])
    o3d.io.write_point_cloud("app/static/reconstruction/point_cloud.ply", pcd)
    o3d.visualization.draw_geometries([pcd], window_name="Point Cloud - Outliers removed")

    return jsonify({'success': True})

@app.route("/make-mesh", methods=['POST'])
def make_mesh():

    data = request.json
    depth = data.get('depth', 10)

    cloud_path = "app/static/reconstruction/point_cloud.ply"
    mesh_path = "app/static/reconstruction/reconstruction.ply"
    utils.poisson_reconstruction_from_point_cloud(cloud_path, mesh_path, depth=depth)

    return jsonify({'success': True})

@app.route("/download-point-cloud", methods=["GET"])
def download_point_cloud():
    file_path = "static/reconstruction/point_cloud.ply"
    return send_file(file_path, as_attachment=True, download_name="point_cloud.ply")

@app.route("/download-mesh", methods=["GET"])
def download_mesh():
    file_path = "static/reconstruction/reconstruction.ply"
    return send_file(file_path, as_attachment=True, download_name="reconstruction.ply")

@app.route("/about")
def about_page():
    return render_template('About.html')

if __name__ == "__main__":
    app.run()