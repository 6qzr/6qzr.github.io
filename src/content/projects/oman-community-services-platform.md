---
title: "Oman Community Services Platform"
track: "fullstack"
tagline: "A citizen reports a broken thing. The right department hears about it."
role: "Team lead — 4 engineers"
period: "2026 · Codeline .NET Bootcamp capstone"
stack:
  - "ASP.NET Core Web API"
  - "Entity Framework Core"
  - "SQL Server"
  - "JWT"
  - "Swagger"
highlights:
  - "Led four engineers through the full lifecycle — ERD first, then architecture, then code — and owned the branching strategy that kept a shared codebase coherent."
  - "Designed a 10-entity relational model with automatic department routing, status workflows, comments, notifications and citizen feedback ratings."
  - "Built on a three-layer architecture (repository, service, controller) with soft deletes, role-based access scoping and DTO-based contracts."
  - "Delivered through a structured GitHub workflow: 56 tracked issues across two sprints."
repo: null
repoNote: "Academic capstone — the repository is private to the bootcamp cohort."
order: 2
featured: true
---

Road damage, water leaks, waste that nobody collected. The problem is never that
citizens have nothing to report; it is that a report has to reach the one
department that can act on it, and then survive long enough to be resolved.

So the design started with the data model, not the endpoints. Ten entities,
every relationship argued over and validated before implementation — including
the cardinality problems that are cheap to fix on a diagram and expensive to fix
in a migration. Routing a report to the responsible department is a property of
that model, not a special case bolted on afterwards.

As team lead the harder work was not technical. Four people writing into one
codebase need a branching strategy they actually follow, issues small enough to
finish, and architectural decisions made once rather than re-litigated in every
pull request. Two sprints, 56 tracked issues, one codebase that still made sense
at the end of it.

The three-layer split — repository, service, controller — was deliberate for a
team this size. It gives four engineers four places to work without standing on
each other, and it keeps the business rules somewhere other than a controller.
