# Quick deployment verification script
$pemPath = "c:\Users\dev\Documents\fantastic-garbanzo\fantastic-garbanzo.pem"
$ec2Host = "ubuntu@ec2-18-136-206-133.ap-southeast-1.compute.amazonaws.com"

Write-Host "Checking container status..." -ForegroundColor Cyan
ssh -i $pemPath $ec2Host "cd /home/ubuntu/fantastic-garbanzo && docker-compose -f docker-compose.prod.yml ps" 2>&1 | Select-Object -Last 20

Write-Host "`nChecking backend logs..." -ForegroundColor Cyan
ssh -i $pemPath $ec2Host "docker logs fantastic-garbanzo_backend_1 2>&1 | tail -20"

Write-Host "`nChecking nginx logs..." -ForegroundColor Cyan
ssh -i $pemPath $ec2Host "docker logs fantastic-garbanzo_nginx_1 2>&1 | tail -20"

Write-Host "`nVerification complete!" -ForegroundColor Green
