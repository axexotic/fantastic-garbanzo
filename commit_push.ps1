Set-Location "c:\Users\dev\Documents\fantastic-garbanzo"
git add frontend/Dockerfile
git commit -m "Use npm install instead of npm ci in frontend Dockerfile"
git push origin main
Write-Output "DONE"
