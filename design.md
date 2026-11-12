# ShopeeAI AutoChat — Design Direction

## Brand
- **Product**: ShopeeAI AutoChat
- **Tagline**: Shopeeチャットを、AIが自動で完結させる

## Colors
- Primary: `#EE4D2D` (Shopee orange-red)
- Accent: `#FF6633`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`
- Background: `#FFFFFF`
- Surface: `#F8F9FA`
- Border: `#E5E7EB`
- Text Primary: `#111827`
- Text Secondary: `#6B7280`
- Text Muted: `#9CA3AF`

## Typography
- Font: Poppins (headings, UI) + Inter (body text)
- Display: 700 weight, tight letter-spacing
- Body: 400/500 weight, 1.6 line-height
- Labels: 600 weight, uppercase for stat labels

## Layout
- Sidebar nav (fixed left, 240px) + main content area
- Max content width: 1280px
- Clean card-based content blocks, subtle shadow
- Generous white space

## Component Style
- Cards: white bg, `border border-gray-100 rounded-xl shadow-sm`
- Buttons: primary uses brand orange, sharp radius `rounded-lg`
- Badges: pill-shaped status indicators
- Tables: clean, zebra-stripe subtle, hover highlight
- Charts: recharts, brand colors

## Motion
- Page load: staggered fade-in (CSS)
- Sidebar active: smooth indicator transition
- Status badges: subtle pulse for live states

## Anti-patterns
- No purple gradients
- No generic card grids with heavy border-radius
- No dark theme (clean white is the brand)
