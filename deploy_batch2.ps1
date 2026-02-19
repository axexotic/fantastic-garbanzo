# Deploy Batch 2 UI components
$keyPath = "c:\Users\dev\Documents\fantastic-garbanzo\fantastic-garbanzo.pem"
$ec2Host = "ubuntu@ec2-18-136-206-133.ap-southeast-1.compute.amazonaws.com"
$repoPath = "/home/ubuntu/fantastic-garbanzo"

Write-Host "🚀 Deploying Batch 2 UI Components..." -ForegroundColor Cyan

# Step 1: Pull latest code
Write-Host "`n📥 Pulling latest code from GitHub..." -ForegroundColor Yellow
$pullCmd = "cd $repoPath; git fetch origin; git reset --hard origin/main"
ssh -i $keyPath $ec2Host $pullCmd
if ($LASTEXITCODE -eq 0) { Write-Host "✅ Code updated" -ForegroundColor Green } else { Write-Host "❌ Pull failed" -ForegroundColor Red; exit 1 }

# Step 2: Build frontend
Write-Host "`n🔨 Building frontend image..." -ForegroundColor Yellow
$buildCmd = "cd $repoPath; docker-compose -f docker-compose.prod.yml build frontend"
ssh -i $keyPath $ec2Host $buildCmd
if ($LASTEXITCODE -eq 0) { Write-Host "✅ Frontend built" -ForegroundColor Green } else { Write-Host "❌ Build failed" -ForegroundColor Red; exit 1 }

# Step 3: Restart containers
Write-Host "`n🔄 Restarting containers..." -ForegroundColor Yellow
$restartCmd = "cd $repoPath; docker-compose -f docker-compose.prod.yml up -d"
ssh -i $keyPath $ec2Host $restartCmd
if ($LASTEXITCODE -eq 0) { Write-Host "✅ Containers restarted" -ForegroundColor Green } else { Write-Host "❌ Restart failed" -ForegroundColor Red; exit 1 }

# Step 4: Verify health
Write-Host "`n🏥 Verifying health..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
$healthCmd = "curl -s https://api.flaskai.xyz/api/health | jq ."
ssh -i $keyPath $ec2Host $healthCmd

Write-Host "`n✨ Batch 2 UI Deployment Complete!" -ForegroundColor Green
