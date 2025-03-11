import base64
from io import BytesIO
import shutil
from flask import Flask, request, redirect, url_for, render_template, jsonify, send_file
import os
from PIL import Image
from utils import utils
import cv2
import io
import atexit

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'app/static/uploads'
app.config['UPLOAD_FOLDER_FRAMES'] = 'app/static/uploads/frames'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER_FRAMES'], exist_ok=True)

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

@app.route("/")
def landing_page():
    return render_template('LandingPage.html')

@app.route("/pre-painting")
def pre_painting_page():
    return render_template('PrePainting.html')

@app.route('/uploadImage', methods=['POST'])
def upload_image():

    if 'file' not in request.files:
        return "No file uploaded", 400

    file = request.files['file']
    if file.filename == '':
        return "No file selected", 400

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

    img.save(cropped_path)

    image = utils.createSketch(cropped_path)
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

@app.route("/uploadVideo", methods=['POST'])
def video_to_frame():
    if 'file' not in request.files:
        return "No file uploaded", 400

    file = request.files['file']
    if file.filename == '':
        return "No file selected", 400

    # Save the file to the upload folder
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename.replace(" ", ""))
    file.save(file_path)

    utils.extract_frames(file_path, app.config['UPLOAD_FOLDER_FRAMES'])

    # Return the filename as JSON
    return jsonify({'success': True})

@app.route("/post-painting-frames")
def post_painting_frames():
    return "Frames"

@app.route("/about")
def about_page():
    return "About"

if __name__ == "__main__":
    app.run()