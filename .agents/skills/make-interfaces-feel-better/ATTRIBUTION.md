# make-interfaces-feel-better (vendored)

Source: https://github.com/jakubkrehel/make-interfaces-feel-better  
License: MIT (see `LICENSE.jakubkrehel`)

Installed in this repository for Cursor/OMA agents. OMA-specific workflow: `.agents/skills/oma-mobile-feel-better/SKILL.md`.

To update upstream:

```bash
git clone --depth 1 https://github.com/jakubkrehel/make-interfaces-feel-better.git /tmp/mifb
cp -r /tmp/mifb/skills/make-interfaces-feel-better/* .agents/skills/make-interfaces-feel-better/
cp /tmp/mifb/LICENSE .agents/skills/make-interfaces-feel-better/LICENSE.jakubkrehel
cp -r .agents/skills/make-interfaces-feel-better .cursor/skills/
```
