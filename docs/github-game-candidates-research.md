# پژوهش اولیهٔ بازی‌های متن‌باز GitHub برای پارتی پلی

این پرونده فقط برای غربال‌گری نامزدها است؛ **هیچ‌کدام هنوز برای ادغام یا انتشار تأیید نشده‌اند**. معیار اولیه شامل امکان اجرای مرورگری، کیفیت مستندات، مجوز باز، فعالیت اخیر و قابلیت جداکردن رابط از منطق بازی است.

| نامزد | دسته | نشانی | شاخص اولیهٔ مشاهده‌شده | مجوز اعلام‌شده | یادداشت |
|---|---|---|---:|---|---|
| boardgame.io | موتور بازی‌های نوبتی چندنفره | https://github.com/boardgameio/boardgame.io | در نتایج GitHub به‌عنوان موتور مدیریت وضعیت و چندنفره معرفی شد | بررسی در منبع اصلی لازم است | زیرساخت مناسب‌تر از بازی آماده؛ می‌تواند برای اتاق خصوصی و همگام‌سازی به کار رود. |
| LibreLudo | منچ / لودو | https://github.com/priyanshurav/libreludo | در جست‌وجوی عمومی به‌عنوان لودوی متن‌باز با چندنفرهٔ محلی و ربات معرفی شد | نیازمند بررسی مخزن | نامزد مستقیم برای منچ، اما باید کیفیت کد و مجوز بررسی شود. |
| BilalHaider20/SnakeLadderGame.github.io | مارپله | https://github.com/BilalHaider20/SnakeLadderGame.github.io | بازی دونفرهٔ مرورگری | نیازمند بررسی مخزن | نمونهٔ ساده؛ احتمالاً فقط برای الهام یا اقتباس بخشی از رابط مناسب است. |
| yashksaini/snakes-and-ladders-game | مارپله | https://github.com/yashksaini/snakes-and-ladders-game | انتخاب تعداد بازیکن و آواتار در توضیح جست‌وجو | نیازمند بررسی مخزن | باید فناوری و مجوز بررسی شود. |
| guilhermebkel/uno-game | اونو / بازی کارتی | https://github.com/guilhermebkel/uno-game | ۲۵۶ ستاره، به‌روزرسانی ۱۴ اوت ۲۰۲۶ | MIT | نامزد قوی برای یک بازی کارتی سبک؛ چندنفره‌بودن و کیفیت UI باید تأیید شود. |
| danguilherme/uno | منطق اونو | https://github.com/danguilherme/uno | ۱۰۴ ستاره، به‌روزرسانی ۲۷ ژوئیه ۲۰۲۶ | MIT | منطق بازی، نه لزوماً تجربهٔ آمادهٔ کاربر؛ مناسب برای استفاده به‌عنوان هسته. |
| Infinite-Chess/infinitechess.org | شطرنج آنلاین | https://github.com/Infinite-Chess/infinitechess.org | ۲۸۵ ستاره، به‌روزرسانی ۱۷ اوت ۲۰۲۶ | AGPL-3.0 | کیفیت و قابلیت‌های آنلاین بالا، اما AGPL برای ادغام مستقیم در سایت بسته/اختصاصی انتخاب مناسبی نیست. |
| dotnize/chessu | شطرنج آنلاین | https://github.com/dotnize/chessu | ۱۰۴ ستاره، به‌روزرسانی ۱۴ اوت ۲۰۲۶ | MIT | نامزد بالقوه برای شطرنج، نیازمند بررسی کامل معماری و وابستگی سرور. |
| josefjadrny/js-chess-engine | موتور شطرنج و ربات | https://github.com/josefjadrny/js-chess-engine | ۱۶۴ ستاره، به‌روزرسانی ۱۸ اوت ۲۰۲۶ | MIT | موتور TypeScript بدون وابستگی برای مرورگر؛ برای پیاده‌سازی شطرنج بومی مناسب‌تر از کپی UI. |
| aaron5670/PokeMMO-Online-Realtime-Multiplayer-Game | نمونهٔ فنی چندنفره | https://github.com/aaron5670/PokeMMO-Online-Realtime-Multiplayer-Game | ۳۳۵ ستاره، به‌روزرسانی ۱۶ اوت ۲۰۲۶ | WTFPL | برای طراحی بازی پارتی مناسب نیست؛ صرفاً مرجع فنی Realtime با Phaser و Colyseus. |

## منابع اولیه

1. https://github.com/topics/ludo-game
2. https://github.com/topics/multiplayer-browser-game?l=javascript&o=desc&s=stars
3. https://github.com/topics/snakeandladder
4. https://github.com/topics/mafia-game
5. https://github.com/boardgameio/boardgame.io

> نتایج بالا هنوز با صفحه‌های README و فایل‌های LICENSE هر مخزن اعتبارسنجی نشده‌اند؛ مرحلهٔ بعد این بررسی منبع‌به‌منبع را انجام می‌دهد.

## اعتبارسنجی منبع‌به‌منبع، دور اول

| نامزد | نتیجهٔ بررسی README و مجوز | حکم اولیه |
|---|---|---|
| [adrianocola/spyfall](https://github.com/adrianocola/spyfall) | ۲۵۱ ستاره، ۱٬۹۶۶ commit و مجوز MIT. React + Firebase است و ساختار ترجمهٔ Crowdin دارد. | **گزینهٔ ممتاز برای اقتباس**؛ باید اتصال Firebase با Supabase جایگزین و همهٔ محتوای مکان‌ها فارسی‌سازی شود. |
| [Grispi/Uno_Game](https://github.com/Grispi/Uno_Game) | مجوز MIT، ۲ تا ۴ بازیکن، React / Next.js / Firebase و پوشه‌های `gameLogic` و `locales`. | **گزینهٔ خوب برای اونو**؛ منطق و دارایی‌ها قابل جداسازی‌اند ولی مسیر Realtime باید با Supabase بازنویسی شود. |
| [koosvary/codenames](https://github.com/koosvary/codenames) | مجوز MIT، کلاینت React + Redux و سرور Express. بسته‌های واژه و بازی تیمی آماده دارد. | **گزینهٔ خوب با قید محتوایی**؛ فقط موتور و UI اقتباس شود و واژه‌نامهٔ فارسیِ مستقل جایگزین واژه‌های بازی تجاری شود. |
| [boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io) | ۱۲٬۴۰۴ ستاره، ۱٬۹۱۳ commit و MIT. موتور حالت، نوبت، فاز، لابی و چندنفره دارد. | **زیرساخت ممتاز، نه بازی آماده**؛ برای بازی‌های تازه یا بازنویسی موتور بازی‌ها مناسب است، نه واردکردن مستقیم در صفحات فعلی. |
| [priyanshurav/libreludo](https://github.com/priyanshurav/libreludo) | TypeScript / React / Vite / Redux، ۲ تا ۴ بازیکن و ربات دارد، اما مجوز AGPL-3.0 است. | **برای مطالعهٔ UX مناسب؛ برای اقتباس مستقیم رد می‌شود** مگر تمام سایت با شرایط AGPL منتشر شود. |
| [CyberCitizen01/LUDO](https://github.com/CyberCitizen01/LUDO) | مجوز MIT و معماری Node.js + Socket.IO + Vanilla JS دارد؛ README و نگه‌داری محدود است. | **نامزد مشروط**؛ منطق چندنفره قابل استفاده است، اما UI و معماری با Vite/Supabase پارتی پلی ناسازگار است. |
| [Soupaul/snakes-and-ladders-multiplayer](https://github.com/Soupaul/snakes-and-ladders-multiplayer) | Socket.IO و Node.js دارد، اما مجوز اعلام نشده و از تصویر تختهٔ دارای منبع بیرونی استفاده شده است. | **رد برای اقتباس مستقیم**؛ مجوز نامشخص و دارایی تصویری غیرقابل‌اعتماد دارد. |
| [Jezternz/PlayMafia](https://github.com/Jezternz/PlayMafia) | مجوز MIT و موتور کامل روز/شب، لابی، پیام خصوصی و ۱۹ نقش دارد؛ اما بسیار قدیمی و متکی بر Redis/SockJS است. | **مرجع منطقی مفید، نه کد ادغامی**؛ نقش‌ها و سناریوها را می‌توان با حفظ معماری Supabase فعلی توسعه داد. |

> نکتهٔ حقوقی: مجوز MIT استفاده و تغییر کد را با حفظ متن مجوز اجازه می‌دهد؛ اما پروژه‌های AGPL یا پروژه‌های بی‌مجوز را نباید در کد اختصاصی پارتی پلی به‌صورت مستقیم ادغام کرد. همچنین کد یا فهرست واژهٔ بازی‌های تجاری باید فقط به‌عنوان مرجع تجربهٔ بازی دیده شود، نه دارایی قابل کپی.

## اعتبارسنجی منبع‌به‌منبع، دور دوم

| نامزد | نتیجهٔ بررسی README و مجوز | حکم اولیه |
|---|---|---|
| [quasoft/backgammonjs](https://github.com/quasoft/backgammonjs) | ۱۰۲ ستاره، ۱۶۲ commit، MIT و بازی چندنفرهٔ ماژولار. قواعد استاندارد و دو واریانت دیگر دارد. | **نامزد خوب برای تخته‌نرد**؛ منطق قابل‌اقتباس است اما UI قدیمی و سرور Node باید با تجربهٔ پارتی پلی جایگزین شود. |
| [therewillbecode/react-poker](https://github.com/therewillbecode/react-poker) | ۱۳۷ ستاره و کتابخانهٔ React برای انیمیشن پخش ورق. | **قطعهٔ رابط، نه بازی کامل**؛ برای ساخت پاسور با انیمیشن ورق مناسب است، اما قوانین، اتاق و همگام‌سازی باید جداگانه پیاده شود. |
| [dotnize/chessu](https://github.com/dotnize/chessu) | ۱۰۴ ستاره، ۳۰۹ commit، MIT، بازی شطرنج زنده با تماشاچی و چت؛ Next/Express/Socket.IO/PostgreSQL. | **نامزد مشروط**؛ امکانات کامل دارد اما معماری آن یکپارچه با Supabase نیست. برای UI، جریان اتاق و رفتار بازی مرجع خوبی است. |
| [guilhermebkel/uno-game](https://github.com/guilhermebkel/uno-game) | ۲۵۶ ستاره، ۶۲۳ commit، MIT؛ TypeScript / React / Socket.IO / Express / Redis و رابط آمادهٔ بازی. | **قوی‌ترین نامزد اونو**؛ بخش منطقی و رابط الگو می‌شود، ولی Socket/Redis باید به Supabase Realtime و RPC تبدیل شود. |
| [Arp-G/pictionary](https://github.com/Arp-G/pictionary) | ۳۷ ستاره، ۱۵۱ commit، MIT؛ اتاق خصوصی یا عمومی، واژهٔ سفارشی، بازیابی پس از قطع اتصال و Dark mode. | **نامزد خوب برای «بکش و حدس بزن»**؛ فرانت React دارد، اما بک‌اند Elixir باید با Supabase جایگزین شود. واژه‌های فارسی اختصاصی لازم است. |
| [simondiep/quiplash-js](https://github.com/simondiep/quiplash-js) | بازی ۳ تا ۸ نفره React/Node/Socket.IO؛ مجوز مشخص نشده و بر یک بازی تجاری الهام‌گرفته است. | **رد برای ادغام مستقیم**؛ ایدهٔ بازی جواب می‌دهد، ولی بدون مجوز روشن و با ریسک محتوایی فقط الهام UX است. |
| [ericterpstra/anagrammatix](https://github.com/ericterpstra/anagrammatix) | ۱۹۲ ستاره اما خود README آن را قدیمی و بدون نگه‌داری می‌داند. | **رد**؛ زیرساخت و الگوریتم واژه برای فارسی هم مناسب نیست. |
| [64bitpandas/SimultaneousScrabble](https://github.com/64bitpandas/SimultaneousScrabble) | مجوز MIT و ۲ تا ۱۰ بازیکن، ولی فرهنگ واژه و امتیازدهی انگلیسی دارد و ابزار ساخت قدیمی است. | **در حال حاضر رد**؛ برای فارسی‌سازی نیازمند فرهنگ‌لغت و تعادل قواعد تازه است. |
| [AdheeshaRavindu/Snake-and-Ladder](https://github.com/AdheeshaRavindu/Snake-and-Ladder) | MIT و بسیار نزدیک به نیاز: اتاق کددار، ۲ تا ۸ نفر، نوبت همگام، حرکت انیمیشنی، صدا و حالت موبایل. | **نامزد خوب برای جایگزینی مارپله**؛ پروژه جوان است اما ساختار سادهٔ HTML/CSS/JS و جداسازی `board.js` / `game.js`، انتقال به Supabase را عملی می‌کند. |
| [caleb531/connect-four](https://github.com/caleb531/connect-four) | ۳۲ ستاره، ۱٬۲۲۷ commit، MIT؛ بازی دوستانه یا ربات با رابط روان و پشتیبانی چندنفره. | **نامزد خوب برای جایگزینی دوز**؛ خود بازی «چهاردرردیف» جذاب‌تر و عمیق‌تر از دوز است و کد دارای آزمون و Vite است. |
| [sayjeyhi/snakeAndLadders](https://github.com/sayjeyhi/snakeAndLadders) | MIT، React/Redux/Canvas/React-Konva و انیمیشن مهره؛ فقط ۱۱ ستاره و تک‌نفره/محلی. | **مرجع بصری برای مارپله**؛ از نظر کد بازی آنلاین آماده نیست، اما قابلیت‌های Canvas/حرکت آن ارزش اقتباس دارد. |

## بررسی پاسور و حکم

| نامزد | نتیجهٔ بررسی | حکم اولیه |
|---|---|---|
| [matin-as/Online-hokm-game](https://github.com/matin-as/Online-hokm-game) | کد بازی حکم با اتاق خصوصی، چت و بازی با ربات را توصیف می‌کند و CC0-1.0 دارد؛ ولی Unity + Photon است، فقط ۶ commit دارد و برای وب React/Supabase مناسب نیست. | **برای طرح تجربه و قواعد حکم مرجع است، نه کد ادغامی**. اگر حکم انتخاب شود، باید قوانین و UI را بومی در React/Supabase بازنویسی کنیم. |
| [kripod/deckster](https://github.com/kripod/deckster) | کتابخانهٔ MIT برای دستهٔ استاندارد ۵۲ ورق و دور/پخش کارت است؛ کم‌فعالیت و کوچک است. | **به‌عنوان ایدهٔ API یا نمونهٔ مدل ورق مفید، نه وابستگی پیشنهادی**. برای محصول، مدل ورق نوع‌دارِ کوچک داخل پروژه پایدارتر است. |

> نتیجهٔ پاسور: در غربال فعلی، هیچ پروژهٔ وبِ مدرن، فعال و کاملاً سازگار با Supabase برای حکم/پاسور پیدا نشد. بهترین مسیر حرفه‌ای این است که از انیمیشن‌های MIT `react-poker` و قواعد مستقل حکم استفاده شود، نه اینکه یک پروژهٔ Unity یا سرور کازینویی به پارتی پلی وارد شود.
