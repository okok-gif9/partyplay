# ارزیابی جایگزین مارپله

**تاریخ:** ۱۹ اوت ۲۰۲۶  
**هدف:** انتخاب منبع متن‌بازِ حرفه‌ای‌تر از نسخهٔ منتشرشدهٔ فعلی، با تختهٔ روشن، تاس، حرکت مهره، مار/نردبان واقعی، واکنش‌گرایی و مجوز روشن.

| منبع | نقاط قوت | محدودیت | نتیجه |
|---|---|---|---|
| [`mohammadnedaei/Snakes-Ladders-React`](https://github.com/mohammadnedaei/Snakes-Ladders-React) | React/TypeScript، MIT، تا پنج بازیکن و ربات، دارایی ساخت و مسیر GitHub Pages. | همان نسخه‌ای است که قبلاً منتشر و از سوی کاربر ضعیف ارزیابی شد؛ README نیز واکنش‌گرایی را در فهرست کارهای آینده دارد. | **رد قطعی**. |
| [`rx4hvn/snakes-and-ladders`](https://github.com/rx4hvn/snakes-and-ladders) | استاتیک، MIT، پنج سطح و امکان اجرای مستقیم. | تجربهٔ اصلی یک بازی آموزشیِ سؤال‌محور است، نه مارپلهٔ دورهمی؛ فقط چهار commit. | **رد**. |
| [`alvaromontoro/snakes-and-ladders`](https://github.com/alvaromontoro/snakes-and-ladders) | ایدهٔ چندنفرهٔ ۱ تا ۴ نفر و اجرای HTML/CSS خلاقانه. | مجوز روشن در صفحهٔ بررسی‌شده ندارد؛ تاس شبه‌تصادفی و محدودیت صریح صدا/مرورگر دارد. | **رد**. |
| [`datisekai/snake_and_ladder`](https://github.com/datisekai/snake_and_ladder) | قالب مدرن Phaser/Vite، MIT. | README عملاً مربوط به قالب Phaser است و شواهدی از بازی کامل یا تجربهٔ واقعی مارپله ارائه نمی‌کند. | **رد**. |
| [`sayjeyhi/snakeAndLadders`](https://github.com/sayjeyhi/snakeAndLadders) | React، Redux، Canvas/Konva، React Motion، Gatsby و مجوز MIT؛ دمو با تختهٔ تصویری و تاس در مرورگر اجرا شد. | تنها یک بازیکن در دموی بررسی‌شده، ظاهر هنوز ساده و وابستگی‌های قدیمی Gatsby/node-canvas؛ پاسخ تاس در آزمون کوتاه بازخورد واضحی نداد. | **نامزد مشروط برای آزمون محلی**. |

## آزمون دیداری نامزد مشروط

دموی `sayjeyhi/snakeAndLadders` یک تختهٔ بزرگ چوبی، مارها و نردبان‌های تصویری، مهره و کنترل‌های Reset/Roll را نمایش داد. طراحی آن از نسخهٔ فعلی متمایز است و منبع با مجوز MIT عرضه شده؛ با این حال در آزمون یک کلیک Roll، پیام یا حرکت مهره فوراً قابل مشاهده نبود. این منبع فقط پس از clone، ساخت محلی، آزمون چند نوبت و بررسی مسیرهای دارایی می‌تواند پذیرفته شود.

## تصمیم مرحلهٔ پژوهش

در حال حاضر هیچ منبعی بدون آزمون بیشتر، جایگزین نهایی مارپله نیست. گزینهٔ `sayjeyhi/snakeAndLadders` تنها نامزد باقی‌مانده است، اما پذیرش آن به آزمون انتقال واقعی وابسته است. اگر آزمون محلی نیز تجربهٔ ضعیف یا ناقص نشان دهد، مارپله همچنان خارج از آرکید می‌ماند تا منبع حرفه‌ای‌تر پیدا شود.

## منابع

[1] [mohammadnedaei/Snakes-Ladders-React — GitHub](https://github.com/mohammadnedaei/Snakes-Ladders-React)  
[2] [rx4hvn/snakes-and-ladders — GitHub](https://github.com/rx4hvn/snakes-and-ladders)  
[3] [alvaromontoro/snakes-and-ladders — GitHub](https://github.com/alvaromontoro/snakes-and-ladders)  
[4] [datisekai/snake_and_ladder — GitHub](https://github.com/datisekai/snake_and_ladder)  
[5] [sayjeyhi/snakeAndLadders — GitHub](https://github.com/sayjeyhi/snakeAndLadders)

### بررسی ساختار منبع `sayjeyhi/snakeAndLadders`

دریافت فقط‌خواندنی مخزن نشان داد این پروژه بر Gatsby قدیمی، React 16، `node-sass` 4 و بسته‌های ۲۰۱۹ تکیه دارد. مجوز موجود، متن مجوز قالب Gatsby با حق‌نشر GatsbyJS است و نسبت به دارایی‌های پروژه—از جمله چند تصویر نام‌گذاری‌شدهٔ دانلودی/مبهم—مجوز یا انتساب اختصاصی ارائه نمی‌کند. به‌علاوه، وابستگی‌های قدیمی آن احتمال ساخت پایدار در محیط مدرن را پایین می‌آورند.

**نتیجهٔ نهایی:** `sayjeyhi/snakeAndLadders` نیز رد می‌شود. به‌دلیل هم‌زمانِ نامشخص‌بودن مجوز دارایی‌ها، وابستگی‌های فرسوده و کیفیت تعاملی تأییدنشده، انتقال این منبع با استاندارد پارتی پلی سازگار نیست. مارپله تا یافتن منبع حرفه‌ای‌تر خارج از آرکید باقی می‌ماند.
