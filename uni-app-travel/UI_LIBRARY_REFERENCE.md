# UI Component Reference (Vant Weapp / Wux Weapp)

This project now aligns core styles with component semantics inspired by:
- Vant Weapp: https://github.com/youzan/vant-weapp
- Wux Weapp: https://github.com/wux-weapp/wux-weapp

## Mapping used in current codebase
- `ui-cell`: list/card container pattern (Vant Cell / Wux Cell)
- `ui-tag`: compact status tag pattern
- `ui-btn-primary`: rounded primary action button pattern
- `ui-btn-danger`: compact destructive action button pattern

## Next migration steps
1. Replace remaining custom action rows with `ui-cell`-based list layout.
2. Introduce icon+text button pattern for all secondary actions.
3. Convert Mine/Plan action groups to unified cell and button primitives.
4. If dependency policy allows, progressively adopt official Vant Weapp components (`van-cell`, `van-button`, `van-tag`).

## Current environment note
- Direct package install from npm/GitHub is currently blocked by network policy (403).
- Temporary local adapter components are provided in `src/components/weui/`:
  - `VanCell.vue`
  - `VanButton.vue`
