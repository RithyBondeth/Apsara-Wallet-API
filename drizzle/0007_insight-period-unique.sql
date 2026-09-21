-- Duplicates already created by the check-then-insert race would make the
-- unique index fail to build: keep the oldest insight per (user, period).
DELETE FROM "notifications" n
USING "notifications" older
WHERE n."type" = 'insight'
  AND older."type" = 'insight'
  AND older."user_id" = n."user_id"
  AND (older."data" ->> 'periodKey') = (n."data" ->> 'periodKey')
  AND (older."created_at" < n."created_at"
       OR (older."created_at" = n."created_at" AND older."id" < n."id"));
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_insight_period_uidx" ON "notifications" USING btree ("user_id",("data" ->> 'periodKey')) WHERE "notifications"."type" = 'insight';
