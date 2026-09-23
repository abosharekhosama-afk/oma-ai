# Planable AI assistance placement map

**Access date:** 2026-09-23.  
Placement only. `AI_LIVE_ENABLED: FALSE`. No image, video, or audio. No auto-approve. No auto-publish.  
Official constraint: generated content lands as a draft and follows the workspace approval flow (`EV-GUIDE-API`, `EV-CHG-V2`).

| ID    | Surface                  | User trigger                         | Input evidence                 | Output class        | Review UI                                 | Capability                  | Audit                | Manual fallback      | Proposed model class       |
| ----- | ------------------------ | ------------------------------------ | ------------------------------ | ------------------- | ----------------------------------------- | --------------------------- | -------------------- | -------------------- | -------------------------- |
| AI-01 | Website / brand analysis | User asks to read a site             | Fetched pages the user can see | FACT plus INFERENCE | Edit, Accept, Reject into a draft profile | Existing propose capability | Run, outbox, metrics | Type the profile     | Reasoning, not live-called |
| AI-02 | Evidence summary         | User asks to summarize evidence      | Stored evidence rows           | FACT                | Edit, Accept, Reject                      | Propose                     | Same                 | Write the summary    | Routine                    |
| AI-03 | Strategy suggestion      | User asks for a strategy draft       | Approved profile only          | PROPOSAL            | Edit, Accept, Reject                      | Propose strategy            | Same                 | Edit strategy fields | Reasoning                  |
| AI-04 | Audience / persona       | User asks                            | Profile evidence               | INFERENCE           | Edit, Accept, Reject                      | Propose                     | Same                 | Write personas       | Routine                    |
| AI-05 | Organic recommendations  | User asks                            | Strategy draft                 | PROPOSAL            | Edit, Accept, Reject                      | Propose                     | Same                 | Write the plan       | Routine                    |
| AI-06 | Paid planning            | User asks                            | Strategy draft                 | PROPOSAL            | Edit, Accept, Reject                      | Propose                     | Same                 | Write the plan       | Reasoning                  |
| AI-07 | Campaign brief           | User asks                            | Campaign plus strategy         | PROPOSAL            | Edit, Accept, Reject                      | Propose                     | Same                 | Write the brief      | Routine                    |
| AI-08 | Content brief            | User asks                            | Campaign brief                 | PROPOSAL            | Edit, Accept, Reject                      | Propose                     | Same                 | Write the brief      | Routine                    |
| AI-09 | Caption / copy           | Generate, matching Planable Generate | Brand context plus brief       | PROPOSAL            | Edit, Accept, Reject; result is a draft   | Propose                     | Same                 | Type the caption     | Routine                    |
| AI-10 | Compare / rewrite        | Rewrite or Continue                  | Current draft text             | PROPOSAL            | Edit, Accept, Reject                      | Propose                     | Same                 | Edit the text        | Routine                    |
| AI-11 | Review summary           | User asks on a review                | Comments the user can see      | INFERENCE           | Edit, Accept, Reject; cannot approve      | Propose                     | Same                 | Read the thread      | Routine                    |
| AI-12 | Analytics interpretation | User asks                            | Figures already on screen      | INFERENCE           | Edit, Accept, Reject; cannot publish      | Propose                     | Same                 | Read the chart       | Routine                    |

Brand context fields (tone, values, terminology, audience) are the official inputs for Generate, Rewrite, and Continue (`EV-CHG-HOME`). Owners and editors edit them. Client visibility is a setting.

Offline certification gaps stay `PAUSED_PENDING_REFERENCE_ALIGNMENT` until this workflow is implemented. This map does not activate a provider.
