# PikDrive TODO List

## Images and Assets
- [ ] Create high-quality favicon.ico (32x32 and 16x16)
- [ ] Create apple-touch-icon.png (180x180)
- [ ] Add team member photos:
  - [ ] Wilfred's profile photo
  - [ ] Jospen's profile photo
  - [ ] Placeholder female team member photo
- [ ] Add default avatar placeholder
- [ ] Create PikDrive logo

## Image Locations
- Brand assets: `/public/brand/`
  - logo.png
  - logo-dark.png
  - favicon.ico
  - apple-touch-icon.png
- Team photos: `/public/team/`
  - wilfred.jpg
  - jospen.jpg
  - placeholder.jpg
- Default images: `/public/defaults/`
  - avatar.png
  - car.png
  - city.png

## User-Generated Content
- User avatars: Stored in Supabase Storage bucket 'avatars'
- Structure: `avatars/[user_id]/[timestamp].[ext]`
