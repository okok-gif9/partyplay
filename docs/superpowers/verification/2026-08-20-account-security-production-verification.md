# تأیید تولید — امنیت حساب و پاک‌سازی زمان‌بندی‌شده

در ۲۰ اوت ۲۰۲۶، مهاجرت `0013_account_security_and_moderation.sql` از commit ثابت GitHub `6b50eb7c1e2deb991fa35299d073868155943062` در پروژهٔ Supabase `mpwdwarcvohxwxqzedrm` اجرا شد. طول منبع اجراشده ۱۴٬۶۷۴ نویسه و SHA-256 آن `63e6f15a811da5f9d48ca9561134c9e6b4202d8660180c8fdabcbefdaafde385` بود. نتیجهٔ اجرا: `Success. No rows returned`.

پرس‌وجوی تأیید نشان داد جدول `public.pp_account_deletion_requests` و توابع `public.partyplay_account_security_state()` و `public.partyplay_admin_moderate_account(uuid,text,text,integer,text)` موجود هستند.

در ابتدا `cron.job` وجود نداشت و بنابراین مهاجرت 0013 طبق طراحی خود زمان‌بندی را ثبت نکرد. سپس `pg_cron` با `create extension if not exists pg_cron;` فعال و job روزانه با نام `partyplay-purge-due-accounts` ثبت شد. زمان‌بندی ثبت‌شده `17 3 * * *` است و تابع `select public.partyplay_purge_due_accounts()` را اجرا می‌کند. اجرای SQL مربوط به فعال‌سازی و ثبت job با نتیجهٔ `Success. No rows returned` پایان یافت.

مرحلهٔ بعد: افزودن migration متناظر به مخزن، ساخت رابط ورود چندروش، امنیت حساب و کنترل‌های مدیریت تخلف، سپس آزمون و انتشار.

