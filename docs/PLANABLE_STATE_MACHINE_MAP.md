# Planable state machine map

**Access date:** 2026-09-23.  
These machines are separate. A date on a draft is not Scheduled. Approval is not a publishing state.

## A. Content authoring

| State                 | Meaning                                 | Evidence                |
| --------------------- | --------------------------------------- | ----------------------- |
| Draft, no date        | Saved, grey icon, Calendar Saved column | EV-HC-STATUS, EV-HC-CAL |
| Draft, date set       | Still not scheduled                     | EV-HC-SCHED             |
| Edited after approval | Blocked when lock-after-approval is on  | EV-HC-WS                |
| Archived              | `UNKNOWN`                               | —                       |

## B. Approval

| State                        | Meaning                                    | Evidence                |
| ---------------------------- | ------------------------------------------ | ----------------------- |
| Not requested / not approved | Named in custom-view filters               | EV-HC-CUSTOM            |
| Pending my approval          | Filter value                               | EV-HC-CUSTOM            |
| Partially approved           | Filter value; fits multi-level in progress | EV-HC-CUSTOM, EV-HC-ML  |
| Approved                     | All required approval done                 | EV-HC-APPROVE, EV-HC-ML |
| Workflow off                 | None: approvals disabled                   | EV-HC-WS                |
| Changes requested / rejected | `UNKNOWN` as named states                  | —                       |

## C. Scheduling and publishing

| State                      | Meaning                                 | Evidence     |
| -------------------------- | --------------------------------------- | ------------ |
| Unscheduled                | Grey icon, with or without a date       | EV-HC-STATUS |
| Scheduled                  | Clock overlay; will publish at the date | EV-HC-STATUS |
| Published                  | Full-color icon                         | EV-HC-STATUS |
| Cannot schedule            | Orange exclamation                      | EV-HC-STATUS |
| Failed                     | Red no-entry                            | EV-HC-STATUS |
| Marked published           | Flag; published outside Planable        | EV-HC-STATUS |
| Imported                   | Cloud icon                              | EV-HC-STATUS |
| Facebook draft / dark post | Pencil / megaphone                      | EV-HC-STATUS |

## D. Visibility

| State                        | Meaning                                             | Evidence     |
| ---------------------------- | --------------------------------------------------- | ------------ |
| All members                  | Default visibility filter                           | EV-HC-FILTER |
| Team only                    | Hidden from the wider member set                    | EV-HC-FILTER |
| Locked                       | Edits blocked after approval when the setting is on | EV-HC-WS     |
| Client can see brand context | Choice in settings                                  | EV-CHG-HOME  |

## E. Correction

| Action                       | Result                                                   | Evidence      |
| ---------------------------- | -------------------------------------------------------- | ------------- |
| Unapprove                    | Returns the post from approved; needs approve permission | EV-HC-APPROVE |
| Hover failed or blocked icon | Shows the reason                                         | EV-HC-STATUS  |
| Retry command                | `UNKNOWN` as a named control                             | —             |

## Transitions

| ID  | Actor          | Precondition                                | Command                | Result                   | Visible UI                                           | OMA audit                                                 | Evidence                    |
| --- | -------------- | ------------------------------------------- | ---------------------- | ------------------------ | ---------------------------------------------------- | --------------------------------------------------------- | --------------------------- |
| T1  | Editor         | Page connected                              | Save draft             | Draft, date optional     | Grey icon                                            | Record authoring save                                     | EV-HC-SCHED                 |
| T2  | Editor         | Draft                                       | Set date/time and save | Still draft              | Saved leaves the undated column when placed on a day | Record schedule intent separately from publish state      | EV-HC-CAL, EV-HC-SCHED      |
| T3  | Editor         | Optional workflow, or Required and approved | Schedule               | Scheduled                | Clock icon                                           | Record schedule command                                   | EV-HC-SCHED, EV-HC-APPROVAL |
| T4  | System or user | Approved, date set, auto-schedule on        | Approve                | Scheduled                | Clock icon                                           | Record approval and schedule as two facts                 | EV-HC-APPROVAL              |
| T5  | Approver       | Approve permission                          | Approve                | Approved (or next level) | Approval control                                     | Immutable approval record in OMA                          | EV-HC-APPROVE               |
| T6  | Approver       | Already approved by them                    | Unapprove              | Not approved             | Checkmark toggles                                    | OMA immutable approvals may forbid this; `OMA_ADAPTATION` | EV-HC-APPROVE               |
| T7  | Publisher      | Scheduled time or Publish now               | Publish                | Published or Failed      | Color or red icon                                    | Record outcome, not the click alone                       | EV-HC-STATUS                |
| T8  | Editor         | External publish                            | Mark as published      | Marked published         | Flag icon                                            | Do not treat as OMA publisher success                     | EV-HC-SCHED                 |

OMA audit expectation is an OMA rule, not a Planable internal claim.
