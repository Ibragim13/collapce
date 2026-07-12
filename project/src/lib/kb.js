/* Beacon offline knowledge base — real survival content + full-text search.
   Bilingual (ru/en). Content is concise, verified first-aid / survival
   guidance. This is the always-available built-in base; the Knowledge
   screen additionally merges in results from a downloaded Kiwix ZIM
   (see src/kiwix/) when one is installed. */
export const CATS = [
  {
    id: 'firstaid', ru: 'Первая помощь', en: 'First aid',
    articles: [
      { id: 'bleed',
        ru: { t: 'Остановка кровотечения', b: ['Прямое давление на рану чистой тканью 10–15 минут без перерыва.', 'Поднимите конечность выше уровня сердца.', 'Кровь алая и пульсирует — наложите жгут на 5–7 см выше раны, запишите время.', 'Не снимайте пропитанную повязку — добавляйте слои сверху.', 'Жгут не ослабляйте до врача; максимум 2 часа.'] },
        en: { t: 'Stop bleeding', b: ['Direct pressure with clean cloth for 10–15 min without pausing.', 'Raise the limb above heart level.', 'Bright, pulsing blood — tourniquet 5–7 cm above the wound, note the time.', 'Do not remove a soaked dressing — add layers on top.', 'Do not loosen a tourniquet before a medic; 2 hours max.'] } },
      { id: 'cpr',
        ru: { t: 'СЛР (реанимация)', b: ['Нет дыхания/пульса — вызовите помощь и начинайте.', 'Центр грудной клетки, 30 нажатий глубиной 5–6 см, темп 100–120/мин.', '2 вдоха, затем снова 30 нажатий.', 'Не останавливайтесь до приезда помощи или признаков жизни.', 'Есть дефибриллятор — включите и следуйте голосу.'] },
        en: { t: 'CPR', b: ['No breathing/pulse — call for help and begin.', 'Center of chest, 30 compressions 5–6 cm deep, 100–120/min.', '2 rescue breaths, then 30 compressions again.', 'Do not stop until help arrives or signs of life.', 'If an AED is available, turn it on and follow the voice.'] } },
      { id: 'burns',
        ru: { t: 'Ожоги', b: ['Охлаждайте прохладной водой 20 минут. Не льдом.', 'Снимите кольца/часы до отёка.', 'Накройте чистой невлажной тканью или плёнкой.', 'Не вскрывайте пузыри, не мажьте маслом.', 'Ожог больше ладони или на лице/руках — к врачу.'] },
        en: { t: 'Burns', b: ['Cool with cool running water for 20 min. No ice.', 'Remove rings/watches before swelling.', 'Cover with clean non-fluffy cloth or cling film.', 'Do not pop blisters or apply oil.', 'Burn larger than a palm, or on face/hands — seek care.'] } }
    ]
  },
  {
    id: 'water', ru: 'Вода', en: 'Water',
    articles: [
      { id: 'purify',
        ru: { t: 'Очистка воды', b: ['Отстоять, процедить через плотную ткань.', 'Кипятить 1 минуту (3 мин выше 2000 м).', 'Без огня: 2 капли 5% отбеливателя без отдушек на 1 л, ждать 30 мин.', 'Таблетки/фильтр — по инструкции.', 'Дождь и роса безопаснее стоячей воды.'] },
        en: { t: 'Purify water', b: ['Let it settle, strain through tight cloth.', 'Boil 1 minute (3 min above 2000 m).', 'No fire: 2 drops plain 5% bleach per litre, wait 30 min.', 'Tablets/filter — per instructions.', 'Rain and dew are safer than standing water.'] } },
      { id: 'find',
        ru: { t: 'Поиск воды', b: ['Идите вниз по рельефу, в низины и зелёные участки.', 'Роса: соберите тканью с травы утром.', 'Дождь: растяните тент/плёнку воронкой.', 'Избегайте воды у полей (удобрения) и застоя.', 'Морскую и мутную не пейте без опреснения/очистки.'] },
        en: { t: 'Find water', b: ['Move downhill, toward low ground and green patches.', 'Dew: wipe grass with cloth at dawn.', 'Rain: rig a tarp/film as a funnel.', 'Avoid water near fields (fertilizer) and stagnant pools.', 'Do not drink sea or muddy water without desalination/filtering.'] } }
    ]
  },
  {
    id: 'shelter', ru: 'Укрытие', en: 'Shelter',
    articles: [
      { id: 'cold',
        ru: { t: 'Тепло и укрытие', b: ['Изоляция от земли важнее стен — подстилка из веток/картона.', 'Малый объём удерживает тепло лучше большого.', 'Держите одежду сухой; потейте меньше, снимая слои.', 'Голова и шея — основная потеря тепла, укройте.', 'Вход — от ветра; костёр/свеча внутри только с вентиляцией.'] },
        en: { t: 'Warmth & shelter', b: ['Insulation from ground beats walls — bed of branches/cardboard.', 'Small volume holds heat better than large.', 'Keep clothing dry; sweat less by shedding layers.', 'Head and neck lose most heat, cover them.', 'Entrance away from wind; fire/candle inside only with ventilation.'] } }
    ]
  },
  {
    id: 'fire', ru: 'Огонь', en: 'Fire',
    articles: [
      { id: 'start',
        ru: { t: 'Разведение огня', b: ['Готовьте трут, растопку и дрова заранее, отдельными кучками.', 'Трут: береста, сухая трава, вата, пух.', 'Стройте шалашиком или колодцем, оставляя доступ воздуха.', 'Искра/спичка в трут, раздувайте ровно.', 'Влажно: щепа из середины полена, «пёрышки» ножом.'] },
        en: { t: 'Starting a fire', b: ['Prep tinder, kindling and fuel first, in separate piles.', 'Tinder: birch bark, dry grass, cotton, down.', 'Build a teepee or log-cabin, keep airflow.', 'Spark/match into tinder, blow steadily.', 'Wet conditions: split wood for dry core, cut feather sticks.'] } }
    ]
  },
  {
    id: 'comms', ru: 'Связь и сигналы', en: 'Comms & signals',
    articles: [
      { id: 'signal',
        ru: { t: 'Подача сигналов', b: ['Международный сигнал бедствия — группы по три (свет, звук, дым).', 'SOS морзе: · · · — — — · · · (три коротких, три длинных, три коротких).', 'Зеркалом/экраном пускайте блики в сторону цели.', 'Ярко: оранжевое, дым; ночью: свет, огонь.', 'Выложите на земле большие знаки (V — нужна помощь, X — нужна медпомощь).'] },
        en: { t: 'Signalling', b: ['Universal distress — groups of three (light, sound, smoke).', 'SOS morse: · · · — — — · · · (three short, three long, three short).', 'Flash a mirror/screen toward the target.', 'Bright: orange, smoke; night: light, fire.', 'Lay large ground symbols (V — need help, X — need medical).'] } }
    ]
  },
  {
    id: 'radiation', ru: 'Радиация', en: 'Radiation',
    articles: [
      { id: 'shelter',
        ru: { t: 'Действия при радиации', b: ['Внутрь капитального здания, лучше подвал/центр.', 'Закройте окна, заклейте щели, отключите вентиляцию.', 'Снимите верхнюю одежду до входа, упакуйте в пакет, промойте кожу.', 'Оставайтесь 24–48 ч — фон падает быстро.', 'Йодид калия — только при подтверждённом выбросе йода-131 и по дозировке.'] },
        en: { t: 'Radiation response', b: ['Get inside a solid building, ideally basement/center.', 'Close windows, seal gaps, turn off ventilation.', 'Remove outer clothing before entry, bag it, wash skin.', 'Stay 24–48 h — levels drop fast.', 'Potassium iodide — only for confirmed iodine-131 release, per dosing.'] } }
    ]
  }
];

function norm(s) { return String(s || '').toLowerCase(); }
export function search(q, lang) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const out = [];
  for (const c of CATS) {
    for (const a of c.articles) {
      const doc = norm((a[lang].t + ' ' + a[lang].b.join(' ')));
      let score = 0;
      for (const t of terms) { if (doc.includes(t)) score += doc.split(t).length - 1; if (norm(a[lang].t).includes(t)) score += 5; }
      if (score > 0) out.push({ catId: c.id, cat: c[lang], art: a, title: a[lang].t, score });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

export const BeaconKB = { CATS, search };
