@echo off
rem ElektroLab launcher: starts the local server and opens the game in the browser.
rem Keep this window open while you play; close it to stop the server.
cd /d "%~dp0"
start "" http://localhost:8790
node serve.mjs
pause
