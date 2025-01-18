# Create dist directory if it doesn't exist
New-Item -ItemType Directory -Force -Path deploy

# Clean up old zip if it exists
Remove-Item -Path deploy/deploy.zip -ErrorAction SilentlyContinue

# Create new zip file
Compress-Archive -Path * -DestinationPath deploy/deploy.zip -Force

Write-Host "Deployment package created at deploy/deploy.zip" 