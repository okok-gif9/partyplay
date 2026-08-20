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

## آمادهٔ اجرا — آمار و دستاورد پایدار

Migration `0016_player_progress_and_achievements.sql` از commit `c9bbf7fe303ef89e592771754ff37a593708c09f` در ویرایشگر Supabase بارگذاری و با SHA-256 `9d055e2b9636210723cee1a951b098967db98e72ab80175bf039932b1c8da7a8` تأیید شد. این migration در انتظار تأیید نهایی اجرای ساختاری Supabase است.

## اجرای نهایی — آمار و دستاورد پایدار

اجرای نخست migration `0016` به علت ارجاع به ستون ناموجود `pp_game_sessions.started_at` متوقف شد. نسخهٔ اصلاح‌شده و idempotent از commit `a7c48e5e1299191949c40d055d7e08a88aaa974c` با SHA-256 `fa2c470e2a4bf34fc74041384ab44bcde86e458260e5ff1f7fabaac9dbc16e4c` اجرا شد و Supabase نتیجهٔ `Success. No rows returned` را بازگرداند. نسخهٔ اصلاح‌شده از `created_at` جلسه برای آمار فعالیت استفاده می‌کند و سیاست RLS را پیش از ایجاد دوباره حذف می‌کند؛ هیچ داده‌ای حذف نشد.

## آمادهٔ اجرا — هویت مدیر و کاربران ویژه

Migration `0017_identity_tiers_and_premium.sql` از commit `d9f92e2e330d2dc8e9335172e1548eba57ef2bce` در Supabase بارگذاری و با SHA-256 `dcf706bf00b28b7599c590e976e2d1c9e841997bc113e77c6096a58aad47665d` تأیید شد. عملیات در انتظار تأیید نهایی Supabase است. این تغییر ستون‌های سطح عضویت و هویت عمومی را می‌افزاید، نقش نمایشی مدیران ثبت‌شده را همگام می‌کند، و تنها RPC ادمین برای اعطا/لغو ویژه‌بودن ایجاد می‌کند.

## اجرای موفق — هویت مدیر و کاربران ویژه

Migration `0017_identity_tiers_and_premium.sql` با تأیید کاربر اجرا شد و Supabase نتیجهٔ `Success. No rows returned` را بازگرداند. ستون‌های tier هویت، همگام‌سازی نقش نمایشی مدیران، آواتارهای ویژه با اعتبارسنجی سروری و RPC ادمین برای اعطا/لغو ویژه‌بودن اکنون در تولید فعال هستند.

## تأیید نهایی — هویت ویژه

پرس‌وجوی فقط‌خواندنی تولید تأیید کرد که هر چهار ستون هویت (`membership_tier`، `premium_until`، `site_role` و `profile_tagline`) و هر دو RPC اصلی نقش ویژه وجود دارند. همچنین همهٔ رکوردهای فعلی `pp_admins` دارای `site_role = 'site_admin'` هستند؛ بنابراین برچسب عمومی «مدیر سایت» از منبع مدیریتی معتبر همگام شده است.

## بررسی بصری محلی

نسخهٔ توسعه روی `http://localhost:5176/partyplay/` با پاسخ HTTP 200 باز شد. صفحهٔ خانه در نماهای رومیزی بدون شکست چیدمان رندر شد و سیلوئت‌های متفاوت آواتارهای بازی در کارت‌ها دیده شد. صفحهٔ تنظیمات حساب به‌علت نبود نشست Supabase در مرورگر sandbox فقط حالت بازیابی حساب را نمایش داد؛ بنابراین نمایش زندهٔ برچسب «مدیر سایت» نیازمند آزمون در نشست واقعی کاربر پس از انتشار است.

## آمادهٔ اجرا — ایمنی جامعه

Migration `0018_community_safety_and_reports.sql` از commit `a98cbbe97f79aa07d8882488132f2f495945dc85` در Supabase بارگذاری و با SHA-256 `8fa1767c186afe9b99f03b99408d934b929dd36e6c1eb1b4ba143b25f35c403f` تأیید شد. عملیات در انتظار تأیید نهایی است. این تغییر صرفاً جدول‌های مسدودسازی و گزارش، توابع کاربر و صف رسیدگی مدیر را ایجاد و توابع دوستی/گروه را برای جلوگیری از تماس جدید میان حساب‌های مسدودشده به‌روزرسانی می‌کند.

## اجرای موفق — ایمنی جامعه

Migration `0018_community_safety_and_reports.sql` با تأیید کاربر اجرا شد و Supabase نتیجهٔ `Success. No rows returned` را بازگرداند. زیرساخت مسدودسازی شخصی، گزارش خصوصی و مسیر رسیدگی مدیریتی اکنون در تولید فعال است.

## تأیید نهایی — ایمنی جامعه

پرس‌وجوی فقط‌خواندنی تولید وجود دو جدول ایمنی، هفت RPC و سه index عملکردی را تأیید کرد. بنابراین مسیر کاربر برای مسدودسازی/گزارش و مسیر ادمین برای رسیدگی در سطح پایگاه‌داده آماده است.

## آزمون یکپارچه و انتشار نهایی

نوع‌سنجی TypeScript و ساخت Vite برای نسخهٔ کامل با موفقیت انجام شد. گردش‌کار GitHub Pages برای commit `ba6eac6dfcf99dfdf6d141b186b16f87a55f1087` با نتیجهٔ `success` پایان یافت و نسخهٔ زندهٔ `https://okok-gif9.github.io/partyplay/` پاسخ HTTP 200 با زمان آخرین تغییر متناظر با انتشار را بازگرداند.
