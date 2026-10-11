# One building, one tank, one certificate: securing TankSaathi with AWS IoT Core and Cedar

**Description:** How TankSaathi pins every sensor to its own tank's MQTT topic with IoT Core policy variables, and keeps caretakers and residents in their own building with Cognito and Cedar.

**Tags:** aws-iot-core, amazon-cognito, security, serverless, hackathon

**Team NicobarAndaman · Environmental Hacks, Bharat Builds Tour · Heat and Water track**

## Why security matters for a water tank

TankSaathi watches rooftop tanks in shared buildings and raises leak alerts. If one building's sensor could publish readings for another building, someone could fake an empty tank or hide a real leak. And if a resident could see the caretaker's controls, they could resolve an alert that nobody has checked. We wanted both doors shut by design, not by careful coding.

## Devices: one policy, pinned by attributes

Each tank sensor connects to AWS IoT Core over MQTT with its own X.509 certificate. Instead of writing one policy per device, we wrote one policy and let IoT Core fill in the details from the thing registry:

```
topic/tanksaathi/v1/${iot:Connection.Thing.Attributes[channel]}/
      ${iot:Connection.Thing.Attributes[buildingId]}/
      ${iot:Connection.Thing.Attributes[tankId]}/reading
```

Our simulator's thing has the attributes `channel=sim`, `buildingId=demo-hostel-a` and `tankId=roof-1`, so its certificate can publish to exactly one topic. A second statement only allows `iot:Connect` when the client ID equals the thing name and the certificate is attached to that thing.

We didn't just trust this. A script, `check-topic-isolation.ts`, connects with the simulator's real certificate and tries to publish for another building and on the real-device channel. IoT Core answers an unauthorised publish by closing the connection, and the script checks that both attempts are denied.

The `sim` channel matters for honesty too. Simulated readings can never arrive on the `dev` channel that a real sensor would use, so simulated data can't be mistaken for field data.

## People: Cognito says who, Cedar says what

People sign in with Amazon Cognito. Two things come from the token:

- **Groups:** `caretaker`, `resident` or `demo-operator`.
- **Building:** `custom:buildingId`, an attribute only an admin can set. Users can't edit it, so nobody can move themselves into another building.

Amazon API Gateway checks the JWT, and then our API Lambda asks **Cedar**, AWS's open-source policy language, whether the request is allowed. The user becomes a Cedar entity whose parent is their building:

```
permit (
  principal,
  action in [TankSaathi::Action::"viewTank", TankSaathi::Action::"actOnIncident"],
  resource is TankSaathi::Building
)
when { principal in resource && principal.roles.contains("caretaker") };
```

Anything not permitted is denied. Residents only get `viewStatus` for their own building, which returns a plain message like "A possible leak is being checked. Please save water." with no litres and no incident details. Only a demo operator can run the simulator, and only on buildings marked as demo.

## Why Cedar instead of if-statements

- The rules live in one readable file, `policies.cedar`, not scattered across handlers.
- We unit-test the policies directly: caretaker of building B acting on building A's incident is denied, residents can't act, operators can't run scenarios on non-demo buildings.
- The WASM build of Cedar runs inside Lambda with no extra service to call.

## Takeaways

- IoT Core policy variables give you per-device isolation without per-device policies.
- Test your denials, not just your happy path.
- Put the tenant ID somewhere users can't write, and let a policy engine make the decision.

## Links

- Code: https://github.com/navneet-cerecode/tanksaathi
- Live app: https://main.d1ko9f9uvcz4tc.amplifyapp.com
- Demo video: https://youtu.be/QbfelV5P3hA
