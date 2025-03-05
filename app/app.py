from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def landing_page():
    return render_template('LandingPage.html')

@app.route("/pre-painting")
def pre_painting_page():
    return render_template('PrePainting.html')

@app.route("/pre-painting-crop")
def pre_painting_page_crop():
    return render_template('PrePaintingCrop.html')

@app.route("/post-painting")
def post_painting_page():
    return "Post-painting"

@app.route("/about")
def about_page():
    return "About"

if __name__ == "__main__":
    app.run()