# تأیید تولید — امنیت حساب و پاک‌سازی زمان‌بندی‌شده

در ۲۰ اوت ۲۰۲۶، مهاجرت `0013_account_security_and_moderation.sql` از commit ثابت GitHub `6b50eb7c1e2deb991fa35299d073868155943062` در پروژهٔ Supabase `mpwdwarcvohxwxqzedrm` اجرا شد. طول منبع اجراشده ۱۴٬۶۷۴ نویسه و SHA-256 آن `63e6f15a811da5f9d48ca9561134c9e6b4202d8660180c8fdabcbefdaafde385` بود. نتیجهٔ اجرا: `Success. No rows returned`.

پرس‌وجوی تأیید نشان داد جدول `public.pp_account_deletion_requests` و توابع `public.partyplay_account_security_state()` و `public.partyplay_admin_moderate_account(uuid,text,text,integer,text)` موجود هستند.

در ابتدا `cron.job` وجود نداشت و بنابراین مهاجرت 0013 طبق طراحی خود زمان‌بندی را ثبت نکرد. سپس `pg_cron` با `create extension if not exists pg_cron;` فعال و job روزانه با نام `partyplay-purge-due-accounts` ثبت شد. زمان‌بندی ثبت‌شده `17 3 * * *` است و تابع `select public.partyplay_purge_due_accounts()` را اجرا می‌کند. اجرای SQL مربوط به فعال‌سازی و ثبت job با نتیجهٔ `Success. No rows returned` پایان یافت.

مرحلهٔ بعد: افزودن migration متناظر به مخزن، ساخت رابط ورود چندروش، امنیت حساب و کنترل‌های مدیریت تخلف، سپس آزمون و انتشار.


## افزودهٔ نهایی — migration 0014

پس از بازگشت نشست Supabase، migration `0014_enable_cron_and_admin_account_state.sql` از commit `7b3a8b60e9e0874c0c76f340efc9ddf37c36a95d` در پروژهٔ تولید اجرا شد. طول منبع اجراشده ۲٬۰۶۱ نویسه و SHA-256 آن `c6b7baa80135eb9ccebacfc4d6f17a5796b96381e4e5a2bddeccc655c4985326` بود. نتیجهٔ ویرایشگر SQL: `Success. No rows returned`.

این migration وجود extension `pg_cron` و job روزانهٔ پاک‌سازی را به‌صورت idempotent تضمین می‌کند و تابع `partyplay_admin_user_detail(uuid)` را طوری ارتقا می‌دهد که فقط وضعیت حساب، علت ثبت‌شده و زمان‌های محدودیت/پاک‌سازی را به مدیر مجاز نمایش دهد.

## پرس‌وجوی تأیید نهایی

پرس‌وجوی فقط‌خواندنی پس از اجرای migration 0014 تأیید کرد که `pg_cron` با نسخهٔ `1.6.4` نصب است، job با نام `partyplay-purge-due-accounts` و برنامهٔ `17 3 * * *` وجود دارد، و هر دو تابع `partyplay_admin_user_detail(uuid)` و `partyplay_purge_due_accounts()` قابل فراخوانی هستند.

## ۲۰ اوت ۲۰۲۶ — مرکز فعالیت اجتماعی

Migration `0015_social_activity_feed.sql` از commit `a547a1250e62b1d72795b0a842849fa58e1f3ce9` با SHA-256 `0ddf1342ce59266f864929ee687a373478115c7a7be9a2cae9170a34244a5126` در SQL Editor تولید Supabase اجرا شد.

نتیجهٔ Supabase: `Success. No rows returned`.

این migration جدول `pp_activity_events`، ایندکس‌های فعالیت، RLS دریافت‌کننده، subscription Realtime، triggerهای رخدادهای درخواست دوستی/پذیرش/افزوده‌شدن به گروه و RPCهای `partyplay_activity_feed` و `partyplay_mark_activity_read` را ایجاد کرد. هیچ دادهٔ موجودی حذف نشد.

پرس‌وجوی فقط‌خواندنی پس از اجرا تأیید کرد که جدول `pp_activity_events` وجود دارد، triggerهای `pp_activity_friend_request` و `pp_activity_group_member` فعال هستند، جدول در publication `supabase_realtime` قرار دارد و RPCهای `partyplay_activity_feed(integer)` و `partyplay_mark_activity_read(uuid[])` در دسترس‌اند.
