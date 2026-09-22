# OMA product journey and AI map

**Stage:** component parity + product clarity rebuild  
**Audience:** owner preview (not production readiness)

## Journey (user-facing)

```
Company → Brand → Website/Profile → Strategy → Campaign → Content
  → Request/Brief → Task → Deliverable → Review → Schedule → Analytics
```

Command Center answers:

1. Where am I? — Command Center + journey strip
2. Which brands? — portfolio panel
3. What needs attention? — needs-action list
4. Next step? — Getting Started checklist (dismissible)
5. Where is each brand? — workspace cards + status chips
6. What is connected? — Connection honesty panel

## Module clarity contract

| Module        | Input                      | Main action         | Output                   | Next               |
| ------------- | -------------------------- | ------------------- | ------------------------ | ------------------ |
| Brand         | Company                    | Create / open brand | Workspace                | Connect or profile |
| Profile       | Website or manual          | Review / approve    | Approved profile version | Strategy           |
| Strategy      | Approved profile           | Draft organic/paid  | Strategy package         | Campaign           |
| Campaign      | Strategy                   | Create campaign     | Campaign workspace       | Content            |
| Content       | Campaign                   | Plan / compose      | Posts on calendar        | Request            |
| Request/Brief | Content need               | Submit brief        | Request record           | Task               |
| Tasks         | Brief                      | Board move / assign | Task state               | Deliverable        |
| Deliverable   | Task output                | Upload / version    | Versioned asset          | Review             |
| Review        | Deliverable                | Comment / decide    | Decision                 | Schedule           |
| Schedule      | Approved content           | Plan slot           | Schedule row             | Analytics          |
| Analytics     | Scheduled/published sample | Inspect             | Sample insights          | Settings           |

## AI map (honest)

### AI-ready areas (future)

Website analysis · Brand profile suggestions · Organic/Paid strategy proposals · Campaign recommendations · Content ideas / calendar / brief / copy · Creative generation handoff · Paid recommendations · Analytics summaries

### Display rules when AI is not connected

- Label: **AI not connected**
- Manual path remains available
- No Generate button that does nothing
- Demo suggestions only if labeled **Demo AI suggestion**
- No model/provider claims · no AI approval · no autonomous publish · no autonomous ad spend

### Integrations

| State                | Meaning                                |
| -------------------- | -------------------------------------- |
| Available manually   | User can proceed without the connector |
| Demo adapter         | Sample / fixture data                  |
| Not connected        | No live OAuth/API                      |
| Deferred             | Final integration phase                |
| Admin setup required | Tenant admin must configure later      |

No API keys or OAuth in this preview.

## User-facing status vocabulary

Ready · Needs setup · Needs review · Approved · Changes requested · Planning only · Sample data · Not connected · Manual workflow available

Technical terms (Production-shaped, Demo-backed, Fixture) stay in tooltips/help only.
