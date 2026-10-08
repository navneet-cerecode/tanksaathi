// TankSaathi authorization policies (Cedar, AWS open source).
//
// Principals are TankSaathi::User entities whose parent is the Building they
// belong to (from the admin-set Cognito attribute custom:buildingId) and whose
// `roles` come from Cognito groups. Every resource is a TankSaathi::Building.
// Anything not permitted here is denied.

@id("own-building-status")
permit (
  principal,
  action == TankSaathi::Action::"viewStatus",
  resource is TankSaathi::Building
)
when { principal in resource };

@id("caretaker-own-building")
permit (
  principal,
  action in [
    TankSaathi::Action::"viewTank",
    TankSaathi::Action::"viewIncidents",
    TankSaathi::Action::"actOnIncident",
    TankSaathi::Action::"planRefill"
  ],
  resource is TankSaathi::Building
)
when { principal in resource && principal.roles.contains("caretaker") };

@id("demo-operator-simulator")
permit (
  principal,
  action in [TankSaathi::Action::"runScenario", TankSaathi::Action::"resetDemo"],
  resource is TankSaathi::Building
)
when { principal in resource && principal.roles.contains("demo-operator") && resource.demo };
