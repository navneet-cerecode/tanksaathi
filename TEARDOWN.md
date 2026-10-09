# Teardown

Run this **after judging ends**, from `backend/`, signed in to the AWS account. Order matters: CloudFormation can't delete an IoT policy that is still attached to a certificate.

```bash
# 1. Detach and delete the simulator certificate (created outside the stack)
ARN=$(cat certs/certificate-arn.txt)
CERT_ID=${ARN##*/}
aws iot detach-thing-principal --region ap-south-1 --thing-name sim-demo-hostel-a-roof-1 --principal "$ARN"
aws iot detach-policy --region ap-south-1 --policy-name tanksaathi-dev-device --target "$ARN"
aws iot update-certificate --region ap-south-1 --certificate-id "$CERT_ID" --new-status INACTIVE
aws iot delete-certificate --region ap-south-1 --certificate-id "$CERT_ID"

# 2. Delete the stack: table, queue, functions, rule, workflow, topics,
#    user pool, API, Amplify app, alarms, dashboard and log groups
sam delete --stack-name tanksaathi-dev --region ap-south-1 --no-prompts

# 3. Remove what lives outside the stack
aws budgets delete-budget --account-id "$(aws sts get-caller-identity --query Account --output text)" --budget-name tanksaathi-hackathon
rm -rf certs .demo-users.local.json
```

Left behind on purpose: the SAM-managed artifact bucket (`aws-sam-cli-managed-default-*`), which holds deployment zips and costs cents. Empty and delete it in the S3 console if you no longer use SAM in this region.

Check afterwards: CloudFormation shows no `tanksaathi-dev` stack; IoT Core shows no `sim-demo-hostel-a-roof-1` thing; the Billing console shows no new usage.
