# تأیید migration 0020 — حساب و اعلان مرورگر PartyPlay

## منبع اجرا

| مورد | مقدار |
|---|---|
| فایل | `supabase/migrations/0020_auth_dashboard_and_browser_notifications.sql` |
| commit منبع | `4cb6fb2` |
| SHA-256 | `fa409016e1041f7959e16b92dede25f0bf2ae25c5531e74adb6f2b37134387ea` |
| اندازهٔ متن | ۹٬۱۸۹ بایت |
| وضعیت بارگذاری در SQL Editor | کامل؛ نخستین خط متن با migration محلی تطبیق دارد |

## دامنهٔ تغییرات تأییدشده

Migration فقط افزایشی است: trigger ساخت پروفایل برای آیدی انتخابی کاربران جدید، جدول preferenceهای اعلان، جدول اشتراک Web Push، RLS، wrapperهای RPC و نوع‌های فعالیت جدید را اضافه یا به‌روزرسانی می‌کند. حساب‌ها، گروه‌ها، اتاق‌ها و داده‌های فعلی حذف نمی‌شوند.

## وضعیت اجرا

در انتظار اجرای نهایی در SQL Editor Supabase و سپس پرس‌وجوی فقط‌خواندنیِ تأیید.

## رخداد مرورگر

یک تلاش برای کلیک با شناسهٔ منقضی‌شده به صفحهٔ Realtime منتقل شد و اجرای SQL انجام نشد. بازگشت بعدی به SQL Editor نیز نشست Supabase را دوباره به صفحهٔ ورود هدایت کرد. هیچ تغییر migration ناشناخته یا اجرای نیمه‌کاره ثبت نشده است؛ اجرای migration همچنان در انتظار نشست فعال است.

## بارگذاری مجدد پس از ورود

پس از ورود دوباره، SQL Editor متن migration را از commit `4cb6fb2` دریافت و در مدل فعال قرار داد. خروجی کنترل بارگذاری: `bytes = 9189` و `ready = true`.

## کنترل اجرای SQL

دکمهٔ «View running queries» با کنترل اجرای migration اشتباه گرفته شد و فقط پنل تشخیصی dashboard باز شد. این پنل با کنترل `Close` بسته شد؛ متن migration همچنان در SQL Editor باقی مانده و migration اجرا نشده است. اجرای بعدی فقط از دکمهٔ Run خود ویرایشگر انجام می‌شود.

## اجرای نهایی

SQL Editor اجرای migration را با پیام `Success. No rows returned` تأیید کرد. اجرای اولیه و کنترل نهایی هر دو در همان query ثبت‌شده انجام شدند.

گام بعدی: پرس‌وجوی فقط‌خواندنی برای بررسی جدول‌ها، توابع RPC، trigger پروفایل و constraint رویدادهای اعلان.

## نتیجهٔ پرس‌وجوی ساختاری

| کنترل | نتیجه |
|---|---:|
| `pp_notification_preferences` | ۱ |
| `pp_web_push_subscriptions` | ۱ |
| `partyplay_notification_preferences()` | ۱ |
| `partyplay_update_notification_preferences()` | ۱ |
| `partyplay_save_push_subscription()` | ۱ |
| constraint نوع فعالیت | ۱ |
| trigger با نام تاریخی `on_auth_user_created` | ۰ |

تمام ساختارهای اعلان تأیید شدند. مقدار صفر فقط نشان می‌دهد trigger ساخت پروفایل در این پروژه نام دیگری دارد؛ در گام بعد trigger واقعیِ جدول `auth.users` و تابع متصل به آن فقط‌خواندنی بررسی می‌شود.

## تأیید trigger حساب

Trigger واقعی جدول `auth.users` با نام `pp_auth_user_created` به تابع `partyplay_create_profile` متصل است. بنابراین منطق جدیدِ آیدی انتخابی برای ثبت‌نام‌های بعدی فعال شده است؛ مقدار صفر در کنترل نام تاریخی، خطا نبود.
