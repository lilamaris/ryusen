-- This migration originally assumed `webCookies` already existed.
-- Guard it so `migrate reset` on a clean database does not fail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BotSession'
      AND column_name = 'webCookies'
  ) THEN
    ALTER TABLE "BotSession" ALTER COLUMN "webCookies" DROP DEFAULT;
  END IF;
END $$;
