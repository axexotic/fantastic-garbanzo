#!/bin/bash
set -e

# Get instance metadata
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
REGION="${AZ%?}"

echo "Instance: $INSTANCE_ID"
echo "Region: $REGION"

# Get the volume ID for the root device
VOLUME_ID=$(aws ec2 describe-volumes --region $REGION --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" "Name=attachment.device,Values=/dev/sda1,/dev/xvda,/dev/nvme0n1" --query "Volumes[0].VolumeId" --output text 2>/dev/null || echo "FAILED")

echo "Volume: $VOLUME_ID"

if [ "$VOLUME_ID" != "FAILED" ] && [ "$VOLUME_ID" != "None" ]; then
    echo "Resizing volume to 16GB..."
    aws ec2 modify-volume --region $REGION --volume-id $VOLUME_ID --size 16 2>&1
    echo "Waiting for volume modification..."
    sleep 10
    # Grow the partition
    sudo growpart /dev/nvme0n1 1 2>&1 || true
    sudo resize2fs /dev/nvme0n1p1 2>&1 || sudo xfs_growfs / 2>&1 || true
    df -h /
    echo "RESIZE_DONE"
else
    echo "Could not find volume ID. Trying alternative..."
    # List all volumes
    aws ec2 describe-volumes --region $REGION --filters "Name=attachment.instance-id,Values=$INSTANCE_ID" --query "Volumes[*].[VolumeId,Size,Attachments[0].Device]" --output text 2>&1
fi
