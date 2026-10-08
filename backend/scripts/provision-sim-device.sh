#!/usr/bin/env bash
# Creates an X.509 certificate for the simulator thing and attaches it to the
# device policy. Credentials are written to backend/certs/ (git-ignored) and
# never leave this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION=ap-south-1
THING=sim-demo-hostel-a-roof-1
POLICY=tanksaathi-dev-device
mkdir -p certs

if [[ -f certs/device.cert.pem ]]; then
  echo "certs/device.cert.pem already exists; delete certs/ first to rotate."
  exit 0
fi

ARN=$(aws iot create-keys-and-certificate --region "$REGION" --set-as-active \
  --certificate-pem-outfile certs/device.cert.pem \
  --private-key-outfile certs/device.private.key \
  --query certificateArn --output text)
echo "$ARN" > certs/certificate-arn.txt

aws iot attach-policy --region "$REGION" --policy-name "$POLICY" --target "$ARN"
aws iot attach-thing-principal --region "$REGION" --thing-name "$THING" --principal "$ARN"
curl -sSf https://www.amazontrust.com/repository/AmazonRootCA1.pem -o certs/AmazonRootCA1.pem
aws iot describe-endpoint --region "$REGION" --endpoint-type iot:Data-ATS --query endpointAddress --output text > certs/endpoint.txt

echo "certificate attached to $THING; endpoint $(cat certs/endpoint.txt)"
