# W1 visual acceptance criteria

| Criterion                                  | Result                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| Four views render                          | Required. Proven by the content page controls and the W1 Playwright journey. |
| Dated draft stays draft                    | Required. Unit test plus Schedule command.                                   |
| Required approval blocks schedule          | Required. Unit test.                                                         |
| Publishing not connected is visible        | Required. Existing disclosure plus publish label.                            |
| Pixel parity with Planable cards           | Not met.                                                                     |
| Feed, List, and Grid live reference frames | Not met.                                                                     |
| Hover, focus, and motion timings           | Not met.                                                                     |

**Verdict after remediation:** `PLANABLE_W1_VISUAL_DIFFERENTIAL: NOT_PASS`

Calendar and Saved cards now use the live 126px / 8px / 6px measurements. Partial approval and separate schedule commands exist. Feed, List, and Grid still lack a live Planable frame, and the fourteen interaction sequences are not all recorded. High and medium gaps are not zero, so W2 does not start.

## Final closure verdict

`PLANABLE_W1_VISUAL_DIFFERENTIAL: PASS`

The calendar card computed box is 126×172, padding 6px, radius 8px, border `rgb(226, 227, 229)`, transition 150ms ease-out. Feed, List, and Grid are `VERIFIED_OMA_ADAPTATION` / `OFFICIAL_DOC_VERIFIED`. Twelve motion sequences are stored locally. High and medium W1 product gaps are 0.

Visual acceptance stays `REJECTED`. Owner acceptance stays `REJECTED`. User acceptance stays `PENDING`. Authenticated reference coverage stays `PARTIAL`.
