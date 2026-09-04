# Role and Permission Matrix — Feature 002 Reference Products

Only provable roles and permissions appear here. No paid-plan or enterprise permission was tested,
and none is guessed. A role observed in a selector is recorded as *the role exists*, which is weaker
than *the role behaves this way*; the two are distinguished per row.

**Critical limitation:** no permission boundary in any reference product was tested by attempting a
denied action. Every capability below is either read from official documentation or seen offered in
a UI control. A visible or documented permission is **not** proof of enforcement. OMA's own
authorization behaviour must be proven by OMA's tests, never by these rows.

---

## Planable

| Role | Documented capability | Evidence | Verification strength |
| --- | --- | --- | --- |
| Owner | The workspace creator by default, holding full rights | `EV-PLA-001` (creator becomes owner), `EV-PLA-006` | `DOC_VERIFIED`; role existence also live in the invite selector |
| Administrator | Create; schedule and publish; view analytics; invite people; connect channels; manage approval settings and automatic reminders | `EV-PLA-006` (see action `PLA-A-018` in `04-action-inventory.md`) | `DOC_VERIFIED`; not exercised |
| Approver | Approve and un-approve items; leave feedback. Under the default workflow a single approver suffices to mark an item approved | `EV-PLA-008`, `EV-PLA-002` | `DOC_VERIFIED`, plus live evidence that the role exists (it is the **default** value in the invite selector) and that its queue and approve control render |
| Contributor | Create and edit items; schedule and publish; leave feedback | `EV-PLA-006` | `DOC_VERIFIED`; not exercised |
| Writer | Create and edit items; leave feedback | `EV-PLA-006` | `DOC_VERIFIED`; not exercised |
| Guest | View content only | `EV-PLA-006` | `DOC_VERIFIED`; not exercised |

### Membership type, which is orthogonal to role

| Membership | Documented capability | Evidence | Verification strength |
| --- | --- | --- | --- |
| Team | Sees internal items and the internal-notes channel | `EV-PLA-011`, `EV-PLA-015` | `DOC_VERIFIED`; role existence live (it is the **default** value in the membership selector) |
| Client / external | Sees only externally visible items and comments; commonly the approving party in a client review loop | `EV-PLA-011`, `EV-PLA-014`, `EV-PLA-015` | `DOC_VERIFIED`; not exercised |
| External guest with no account, via a review link | May view a shared item or filtered view, comment, and leave suggestions — and **explicitly cannot approve** | `EV-PLA-012`, `EV-PLA-014` | `DOC_VERIFIED`; not exercised |

### Granular permission axes

The documentation describes permission as separable checkboxes rather than only as bundled roles,
covering approve, edit, publish, analyze and administrate. Evidence: `EV-PLA-006`, corroborated by
`planable.io/product/` (`EV-PLA-013`). Verification: `DOC_VERIFIED`.

**Relevance to 002.** Two properties are worth carrying as inputs. First, *approve* is a permission
in its own right, separable from *edit* and from *publish* — which matches OMA separating Insight
decide from Version approve from Brand read. Second, the strongest available external participant
is capped strictly below the approval boundary, which is the pattern behind OMA refusing to let a
client-supplied identifier or an unauthenticated link carry decision authority.

**Not proven.** Whether any of these permissions is enforced server-side, whether an approver can be
scoped to a subset of items, and how a permission change affects work already in flight. All
`UNKNOWN`. The live members and permissions screen was never opened.

---

## Linear

| Role | Observed or documented capability | Evidence | Verification strength |
| --- | --- | --- | --- |
| Workspace member (the inspecting account) | Read the shell and all visited pages; open filters, display options, the command menu and item detail; select a list row; read account preferences | `EV-LIN-001`, `EV-LIN-002`, `EV-LIN-003`, `EV-LIN-004`, `EV-LIN-007` | `LIVE_VERIFIED` for what was read only |
| Any role beyond the inspecting account's own | — | — | `UNKNOWN` |

Linear's roles, permission model, team membership boundaries and administrative scopes were **not
inspected**. The sidebar exposes members and teams entries and demotes them behind progressive
disclosure, but neither screen was opened and no permission was tested. Nothing about Linear
authorization may be cited from this baseline.

---

## Semrush

| Role | Observed capability | Evidence | Verification strength |
| --- | --- | --- | --- |
| Authenticated account without an active subscription | Read the public marketing surfaces and the public Site Audit entry form. The authenticated product shell does not render | `EV-SEM-001` | `LIVE_VERIFIED` — this is an entitlement boundary, not a role boundary |
| Any subscription tier's role | — | — | `UNKNOWN` |

Semrush's own user roles, project sharing and team permissions were not observable. The one
authorization-adjacent behaviour that **is** documented is `EV-SEM-002`: bypassing robots and meta
directives requires proving site ownership by uploading a vendor-provided file to the site root, so
the reference treats "may I crawl what this site asked crawlers not to" as an ownership question.
OMA does not adopt this, because 002 does not bypass robots at all.

Entitlement tiers were documented incidentally — per-audit and monthly page ceilings, simultaneous
audit ceilings, and features gated to higher tiers such as JavaScript rendering. These are
**commercial packaging facts, not permission facts**, and are recorded only so nobody later mistakes
a tier limit for an authorization rule. Evidence: `EV-SEM-002`, `EV-SEM-004`.

---

## Jasper Brand IQ

All rows are documentation-only. No signed-in session exists.

| Role | Documented capability | Evidence | Verification strength |
| --- | --- | --- | --- |
| Administrator | Full control; sets workspace-level generation defaults; configures per-feature permission toggles; can view even content marked private to a user; sole audience for the audit log | `EV-JAS-013`, `EV-JAS-014`, `EV-JAS-016`, `EV-JAS-017` | `DOC_VERIFIED`; snapshot of the administrator article was truncated, so the enumeration is not exhaustive |
| Manager | Manages knowledge and brand voice; may view and edit permission settings; sees usage data | `EV-JAS-015` | `DOC_VERIFIED` |
| Developer | Scoped to API access | `EV-JAS-013` | `DOC_VERIFIED` |
| Member | Content creation with limited administrative scope | `EV-JAS-013` | `DOC_VERIFIED` |

Jasper documents **four** roles. Two further actors appear in the documentation but are *not* roles
in its role model, and are recorded separately so nobody counts them as such:

| Documented actor archetype (not a role) | Documented capability | Evidence | Verification strength |
| --- | --- | --- | --- |
| Asset creator | Manages their own knowledge assets unless a permission toggle restricts it. This is ownership of a record, not a role assignment | `EV-JAS-006` | `DOC_VERIFIED` |
| Product owner | Named in documentation as the recommended verifier of claims, disclaimers and specifications — a recommended practice, **not an enforced role** | `EV-JAS-008` | `DOC_VERIFIED` as a recommendation only |

### Permission mechanism

Per-feature toggles cover groups, brand voice, audience, style guide, visual guidelines and
knowledge base. Enabling a feature's toggle restricts create, edit and delete to administrators and
managers while leaving view and use open to everyone. Evidence: `EV-JAS-013`.

**Relevance to 002.** The reference separates *who may use brand context* from *who may change it*,
and pairs that with an audit trail — the same split OMA draws between Brand read, Insight edit,
Insight decide and Version approve.

**Not proven.** Whether brand-component edits themselves appear in the audit log, whether any
approval gate exists at all (no formal approve-or-reject workflow with sign-off is documented), and
all enforcement behaviour. `UNKNOWN`.

---

## Cross-reference summary

| Question relevant to 002 | Provable from references? |
| --- | --- |
| Is *approve* a permission distinct from *edit*? | Yes — `DOC_VERIFIED` in Planable and, in effect, in Jasper's use-versus-change split. |
| Can an external participant be capped below approval? | Yes — `DOC_VERIFIED` in Planable: account-less guests may comment and suggest but never approve. |
| Is approval attributed to a named actor on the artifact? | Yes — `LIVE_VERIFIED` in Planable. |
| Is there a distinct *reject the whole thing* permission? | **No.** `UNKNOWN` in every in-scope reference. |
| Is approval blocked when required information is missing? | **No.** `UNKNOWN`. No reference gates approval on completeness. |
| Are permissions re-checked on background job execution? | **No.** `UNKNOWN`. No reference exposes this. |
| Is tenant isolation observable? | **No.** `UNKNOWN`. Every reference was inspected from a single account, and cross-tenant probing was neither attempted nor permitted. |

The last three rows matter most: OMA's incompleteness gate (`FR-BWI-029a`), its worker
re-authorization requirement (`FR-BWI-017`) and its tenant isolation requirement (`FR-BWI-003`
through `FR-BWI-005`) have **no reference precedent in this baseline** and must be proven entirely
by OMA's own tests. No reference row may be cited as evidence for any of them.
