# Mobile Responsive Audit — Final Polish

## PRIORITY 1: LANDING + PUBLIC PAGES

### Landing (app/(marketing)/page.tsx)
- Header nav: hide links behind hamburger on mobile (<md), show only logo + hamburger + "Prueba Gratis" CTA
- Feature descriptions: font-size 13px minimum (currently ~10-11px)
- Feature items spacing: gap 24px between items (currently ~12px)
- Footer text: font-size 12px minimum (currently ~9px)
- All body text on dark bg: minimum 14px, ensure contrast ≥4.5:1

### Pricing (app/(marketing)/pricing/page.tsx)
- Same header hamburger fix as landing  
- Plan feature list items: font-size 13px, padding 8px 0 between items
- Grayed out features: ensure contrast ≥3:1
- Valor Real section subtitle: font-size 13px

### Login/Register/Forgot Password
- Reduce top whitespace: padding-top 10vh instead of vertical centering
- Olvidaste contraseña link: min 44px touch target
- Placeholder text: ensure contrast ≥3:1

## PRIORITY 2: DASHBOARD PAGES

### Navigation (components/navigation.tsx)
- Hamburger icon: ensure 44x44px touch target with padding
- Add aria-label="Toggle menu"
- Menu items: 48px min height each
- Add subtle backdrop overlay when open

### Dashboard (app/(dashboard)/dashboard/page.tsx)
- Stat cards: equal width calc(50% - 6px), min-height 80px uniform
- Reduce section gaps from ~40px to 20px
- Se el primero en publicar button: min-height 44px
- Empty state: reduce excessive padding to 24px 16px
- Action card arrows: vertically center

### Backtester (app/(dashboard)/backtester/page.tsx)
- Slider thumbs: 32px diameter, track 8px height
- LOT SIZE/CAPITAL labels: 12px font with letter-spacing
- LIMITE input: make full width when alone on its row
- Trailing SL row: input min-width 56px, gap 8px
- Optimizer segmented control: fit all 3 in one row (13px font, tighter padding)
- Summary text: inherit font not monospace, 12px, centered
- Unify button colors to blue (remove purple CTA inconsistency)
- Refresh icon top right: 44x44px touch target

### Bot Operativo (app/(dashboard)/bot/page.tsx)
- Status header: fix "MT5: [] TG: []" brackets to show proper icons/text
- ALL form inputs: min-height 44px
- Replace native checkbox with toggle for Activar trailing SL
- MAKE SECTIONS COLLAPSIBLE accordion: Trailing SL, Grid, Restricciones, Daily Loss
- Guardar configuracion: sticky bottom bar with shadow
- Regenerar clave button: blue not green (match theme)
- Three-dot menu + trash icon: 44px touch targets
- Consistent section margins: 20px between all cards
- Explanatory text paragraphs: 14px, line-height 1.5

### Monitor (app/(dashboard)/bot/monitor/page.tsx)
- Back Config link: min-height 44px
- Auto:5s/Export/refresh controls: 44px touch targets, gap 16px
- Stats values: standardize to 20px font-weight 700
- Posiciones card: span full width or merge
- Signal timestamps: 11px minimum
- Signal text: line-clamp 2 instead of truncating to 1
- Trade history: 3 columns only [pair+type | PnL+pips | time]
- STOP_LOSS → SL, TAKE_PROFIT → TP abbreviations
- Trade list: max-height 500px with Ver mas button
- padding-bottom 32px

### Operativas (app/(dashboard)/operativas/page.tsx)
- Sort dropdown: full width
- Center empty state vertically

## GLOBAL RULES
- Min font 13px everywhere
- Min touch target 44x44px
- Page padding 16px horizontal
- Bottom padding 32px + safe area
- Dark theme text contrast ≥4.5:1
- All CTA buttons full width on mobile
- Consistent border-radius 10px cards, 8px buttons
