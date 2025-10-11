@echo off
ECHO Starting MiniAid Flask Server...

REM Navigate to the 'app' directory using the absolute path
cd /d "C:\Users\gusta\Documents\Projetos Diversao\MiniAid\app"

REM Execute Flask using the Python interpreter from the venv (path is relative to the current directory)
"..\.venv\Scripts\python.exe" -m flask run

REM This line keeps the window open after the server stops, so you can see any error messages.
pause