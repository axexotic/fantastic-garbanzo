@echo off
ssh -i "c:\Users\dev\Documents\fantastic-garbanzo\fantastic-garbanzo.pem" ubuntu@ec2-18-136-206-133.ap-southeast-1.compute.amazonaws.com "cd /home/ubuntu/fantastic-garbanzo; git checkout -- .; git pull origin main 2>&1; echo GIT_PULL_DONE"
