-- Square app icon for the PWA home-screen install / apple-touch-icon,
-- separate from the existing rectangular "logo" (in-app header) and
-- small "favicon" (browser tab) uploads, which are the wrong shape/size
-- for a home-screen icon.
ALTER TABLE public.white_label_applications
ADD COLUMN IF NOT EXISTS app_icon_url text null;

ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS app_icon_url text null;
