# Architectural Decisions

This document records major platform decisions.

Every significant architectural decision should be documented here.

---

## 2026-07

### Products remain independent

Status

Accepted

Reason

Users purchase products because they solve a specific problem.

Large unified dashboards reduce product clarity.

Decision

Every product receives its own dashboard, branding, navigation, and experience.

The platform remains invisible.

---

### Shared authentication

Status

Accepted

Decision

One account.

One login.

Shared across every product.

---

### Shared billing

Status

Accepted

Decision

Subscriptions belong to the platform.

Products consume platform entitlements.

---

### Redirect engine belongs to the platform

Status

Accepted

Decision

The redirect engine becomes shared infrastructure.

TubeLinkr, QRLinkr, and future products all use the same service.

---

### Build platform first

Status

Accepted

Decision

Do not rewrite TubeLinkr.

Gradually migrate it onto platform services.

---

### Migration strategy

Status

Accepted

Decision

Changes must be additive.

Avoid breaking production.

Keep backwards compatibility until migration is complete.

---

### AI discoverability

Status

Accepted

Decision

Every product should be built with AI search in mind from day one.

Documentation, structured data, product pages, and public resources should all support AI understanding.

---

### Platform philosophy

Status

Accepted

Decision

The platform exists to remove duplicated infrastructure.

Products exist to solve user problems.

The platform should never overshadow the products.