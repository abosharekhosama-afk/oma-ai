# OMA × Planable — R2 Component Parity

## Measured tokens (LIVE Planable CDP)

| Token                 | Planable     | OMA                          |
| --------------------- | ------------ | ---------------------------- |
| Body font             | 14/400/~21.5 | 14/400/22                    |
| Ink                   | #333         | #333                         |
| Muted                 | #5E6166      | #5E6166 (R2 token update)    |
| Canvas                | #F5F6F7      | #F5F6F7                      |
| Border                | #E2E3E5      | #E2E3E5                      |
| Control height        | 32           | 32 (`controlHeight`)         |
| Radius control        | 6            | 6                            |
| Compose/dialog radius | 8            | 8 (`borderRadiusLG`)         |
| Sidebar width         | 256          | 256                          |
| Motion mid            | 0.15–0.3s    | token motionDurationMid/Slow |

## Controls migrated to `@oma/ui`

Button / Input / Select / Segmented / Tabs / Modal / Drawer / DatePicker / Tooltip / SurfaceButton / OmaLinkButton (replaces page-local `oma-btn`).

## Overlays

Ant Design 6: `.ant-modal-container` / `.ant-drawer-section` forced opaque white (documented `!important`).

## Evidence

- Planable measures: `artifacts/.../r2-r6/planable/measures.json`
- OMA before: `artifacts/.../r2-r6/oma-before/measures.json`
- OMA after shots: `artifacts/.../r2-r6/oma-after/`

## Verdict

**R2_SHARED_COMPONENT_PARITY: PASS** (rendered before/after + token alignment; Composer Planable live remains limitation).
