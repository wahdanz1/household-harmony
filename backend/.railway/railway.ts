import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "household-harmony";
export default defineRailway(() => {
  const householdHarmony = service("household-harmony", {
    source: github("wahdanz1/household-harmony", { branch: "main", checkSuites: false, rootDirectory: "/backend" }),
    build: { builder: "RAILPACK", watchPatterns: ["backend/**"] },
    start: "uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    replicas: { "us-west2": 1 },
    deploy: { sleepApplication: true },
  });

  return project("household-harmony-backend", {
    variables: { managed: false },
    resources: [householdHarmony],
  });
});
