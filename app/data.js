/* Skład – baza wiedzy o dodatkach i składnikach kosmetyków.
   Poziomy: 0 = bez zastrzeżeń, 1 = niewielkie, 2 = umiarkowane, 3 = duże zastrzeżenia.
   Opisy są ostrożne i opierają się na publicznych stanowiskach EFSA, IARC, WHO i przepisach UE. */

const SOUTHAMPTON = 'Barwnik syntetyczny. W UE produkt z nim musi mieć ostrzeżenie, że może mieć szkodliwy wpływ na aktywność i skupienie uwagi u dzieci.';
const SULFITES = 'Siarczyny mogą wywoływać reakcje u astmatyków i osób wrażliwych. Na etykiecie muszą być oznaczone jak alergen.';
const NITRITE = 'W mięsie może sprzyjać powstawaniu nitrozoamin. IARC uznaje przetworzone mięso za rakotwórcze dla ludzi (grupa 1). EFSA uznaje dopuszczone ilości za bezpieczne, ale część osób może przekraczać dopuszczalne dzienne spożycie.';
const PHOSPHATES = 'Fosforany są w wielu przetworzonych produktach. EFSA (2019) ustaliła dopuszczalne dzienne spożycie, które przy takiej diecie łatwo przekroczyć.';
const POLYOLS = 'Poliol (alkohol cukrowy). Spożyty w większej ilości może działać przeczyszczająco.';
const SWEETENER = 'Słodzik. WHO (2023) odradza słodziki jako sposób na kontrolę masy ciała.';
const EMULS_GUT = 'Emulgator. W badaniach na zwierzętach zaburzał mikrobiotę jelitową. Wpływ na ludzi jest jeszcze badany.';
const CARAMEL_4MEI = 'Karmel może zawierać śladowe ilości 4-MEI, substancji uznanej przez IARC za możliwie rakotwórczą (grupa 2B). EFSA nie widzi zagrożenia przy obecnym spożyciu.';
const FLAVOUR_ENH = 'Wzmacniacz smaku, często dodawany razem z glutaminianem. Osoby z dną moczanową powinny go ograniczać.';
const OK_NATURAL = 'Substancja naturalnie występująca w żywności. Nie budzi zastrzeżeń w dopuszczonych ilościach.';
const OK_THICK = 'Zagęstnik pochodzenia roślinnego. Nie budzi zastrzeżeń w dopuszczonych ilościach.';
const OK_STARCH = 'Skrobia modyfikowana, zagęstnik. Nie budzi zastrzeżeń.';

const ADDITIVES = {
  E100: ['kurkumina', 0, 'Naturalny żółty barwnik z kurkumy.', ['kurkumina']],
  E101: ['ryboflawiny', 0, 'Witamina B2 użyta jako barwnik.'],
  E102: ['tartrazyna', 2, SOUTHAMPTON, ['tartrazyna']],
  E104: ['żółcień chinolinowa', 2, SOUTHAMPTON, ['żółcień chinolinowa']],
  E110: ['żółcień pomarańczowa FCF', 2, SOUTHAMPTON, ['żółcień pomarańczowa']],
  E120: ['koszenila, kwas karminowy', 1, 'Barwnik pozyskiwany z owadów. Może uczulać i nie jest wegański.', ['koszenila', 'karmin']],
  E122: ['azorubina', 2, SOUTHAMPTON, ['azorubina', 'karmoizyna']],
  E124: ['czerwień koszenilowa A', 2, SOUTHAMPTON, ['czerwień koszenilowa']],
  E129: ['czerwień Allura AC', 2, SOUTHAMPTON, ['czerwień allura']],
  E131: ['błękit patentowy V', 1, 'Barwnik syntetyczny. Rzadko może uczulać.'],
  E133: ['błękit brylantowy FCF', 1, 'Barwnik syntetyczny.'],
  E140: ['chlorofile', 0, 'Naturalny zielony barwnik.'],
  E141: ['miedziowe kompleksy chlorofili', 0, 'Zielony barwnik otrzymywany z chlorofilu.'],
  E150A: ['karmel', 0, 'Zwykły karmel z podgrzanego cukru.'],
  E150B: ['karmel siarczynowy', 1, 'Karmel otrzymywany z dodatkiem siarczynów.'],
  E150C: ['karmel amoniakalny', 2, CARAMEL_4MEI, ['karmel amoniakalny']],
  E150D: ['karmel amoniakalno-siarczynowy', 2, CARAMEL_4MEI, ['karmel amoniakalno-siarczynowy', 'karmel siarczynowo-amoniakalny']],
  E153: ['węgiel roślinny', 1, 'Czarny barwnik z węgla roślinnego.'],
  E160A: ['karoteny', 0, 'Naturalne barwniki, m.in. beta-karoten.'],
  E160B: ['annato, biksyna, norbiksyna', 1, 'Barwnik roślinny. U niektórych osób może uczulać.', ['annato']],
  E160C: ['ekstrakt z papryki', 0, 'Naturalny barwnik z papryki.'],
  E160D: ['likopen', 0, 'Czerwony barwnik obecny m.in. w pomidorach.'],
  E162: ['czerwień buraczana', 0, 'Naturalny barwnik z buraków.', ['czerwień buraczana']],
  E163: ['antocyjany', 0, 'Naturalne barwniki z owoców i warzyw.'],
  E170: ['węglan wapnia', 0, OK_NATURAL],
  E171: ['dwutlenek tytanu', 3, 'Od 2022 r. zakazany w żywności w UE, bo EFSA nie mogła wykluczyć działania genotoksycznego.', ['dwutlenek tytanu']],
  E172: ['tlenki żelaza', 0, 'Barwniki mineralne.'],
  E200: ['kwas sorbowy', 0, 'Konserwant. Nie budzi zastrzeżeń w dopuszczonych ilościach.', ['kwas sorbowy']],
  E202: ['sorbinian potasu', 0, 'Konserwant. Nie budzi zastrzeżeń w dopuszczonych ilościach.', ['sorbinian potasu']],
  E210: ['kwas benzoesowy', 1, 'Konserwant. U wrażliwych osób może nasilać objawy alergii.'],
  E211: ['benzoesan sodu', 2, 'Konserwant. W obecności witaminy C może tworzyć śladowe ilości benzenu. U wrażliwych osób może nasilać objawy alergii.', ['benzoesan sodu']],
  E212: ['benzoesan potasu', 1, 'Konserwant z grupy benzoesanów.'],
  E213: ['benzoesan wapnia', 1, 'Konserwant z grupy benzoesanów.'],
  E220: ['dwutlenek siarki', 2, SULFITES, ['dwutlenek siarki']],
  E221: ['siarczyn sodu', 2, SULFITES],
  E222: ['wodorosiarczyn sodu', 2, SULFITES],
  E223: ['pirosiarczyn sodu', 2, SULFITES, ['pirosiarczyn sodu', 'disiarczyn sodu']],
  E224: ['pirosiarczyn potasu', 2, SULFITES, ['pirosiarczyn potasu', 'disiarczyn potasu']],
  E226: ['siarczyn wapnia', 2, SULFITES],
  E227: ['wodorosiarczyn wapnia', 2, SULFITES],
  E228: ['wodorosiarczyn potasu', 2, SULFITES],
  E234: ['nizyna', 0, 'Naturalny konserwant wytwarzany przez bakterie.'],
  E235: ['natamycyna', 1, 'Środek przeciwgrzybiczy stosowany na powierzchni serów i kiełbas.'],
  E249: ['azotyn potasu', 3, NITRITE, ['azotyn potasu']],
  E250: ['azotyn sodu', 3, NITRITE, ['azotyn sodu', 'peklosól', 'sól peklująca']],
  E251: ['azotan sodu', 3, NITRITE, ['azotan sodu']],
  E252: ['azotan potasu', 3, NITRITE, ['azotan potasu', 'saletra']],
  E260: ['kwas octowy', 0, OK_NATURAL],
  E262: ['octany sodu', 0, OK_NATURAL],
  E270: ['kwas mlekowy', 0, OK_NATURAL, ['kwas mlekowy']],
  E290: ['dwutlenek węgla', 0, 'Gaz nadający napojom bąbelki.'],
  E296: ['kwas jabłkowy', 0, OK_NATURAL, ['kwas jabłkowy']],
  E300: ['kwas askorbinowy', 0, 'Witamina C. Nie budzi zastrzeżeń.', ['kwas askorbinowy']],
  E301: ['askorbinian sodu', 0, 'Sól witaminy C. Nie budzi zastrzeżeń.', ['askorbinian sodu']],
  E302: ['askorbinian wapnia', 0, 'Sól witaminy C. Nie budzi zastrzeżeń.'],
  E304: ['estry kwasu askorbinowego', 0, 'Pochodna witaminy C.'],
  E306: ['ekstrakt bogaty w tokoferole', 0, 'Witamina E. Nie budzi zastrzeżeń.', ['tokoferole']],
  E307: ['alfa-tokoferol', 0, 'Witamina E. Nie budzi zastrzeżeń.'],
  E310: ['galusan propylu', 2, 'Syntetyczny przeciwutleniacz. Może uczulać.'],
  E319: ['TBHQ', 2, 'Syntetyczny przeciwutleniacz. EFSA ustaliła niskie dopuszczalne dzienne spożycie.'],
  E320: ['BHA', 2, 'Syntetyczny przeciwutleniacz. IARC uznaje go za możliwie rakotwórczy (grupa 2B).', ['butylohydroksyanizol']],
  E321: ['BHT', 2, 'Syntetyczny przeciwutleniacz. Jego bezpieczeństwo jest przedmiotem dyskusji.', ['butylohydroksytoluen']],
  E322: ['lecytyny', 0, 'Emulgator, zwykle z soi lub słonecznika. Nie budzi zastrzeżeń.', ['lecytyna', 'lecytyny']],
  E325: ['mleczan sodu', 0, OK_NATURAL],
  E327: ['mleczan wapnia', 0, OK_NATURAL],
  E330: ['kwas cytrynowy', 0, OK_NATURAL, ['kwas cytrynowy']],
  E331: ['cytryniany sodu', 0, OK_NATURAL, ['cytrynian sodu', 'cytryniany sodu']],
  E332: ['cytryniany potasu', 0, OK_NATURAL],
  E333: ['cytryniany wapnia', 0, OK_NATURAL],
  E334: ['kwas winowy', 0, OK_NATURAL, ['kwas winowy']],
  E335: ['winiany sodu', 0, OK_NATURAL],
  E336: ['winiany potasu', 0, OK_NATURAL],
  E338: ['kwas fosforowy', 1, 'Typowy dla napojów typu cola. Nadmiar fosforanów w diecie nie jest korzystny, a kwaśny odczyn szkodzi szkliwu zębów.', ['kwas fosforowy', 'kwas ortofosforowy']],
  E339: ['fosforany sodu', 1, PHOSPHATES, ['fosforany sodu', 'fosforan sodu']],
  E340: ['fosforany potasu', 1, PHOSPHATES, ['fosforany potasu']],
  E341: ['fosforany wapnia', 1, PHOSPHATES, ['fosforany wapnia']],
  E392: ['ekstrakt z rozmarynu', 0, 'Naturalny przeciwutleniacz.', ['ekstrakt z rozmarynu']],
  E400: ['kwas alginowy', 0, OK_THICK],
  E401: ['alginian sodu', 0, OK_THICK, ['alginian sodu']],
  E406: ['agar', 0, OK_THICK, ['agar']],
  E407: ['karagen', 2, 'Zagęstnik z wodorostów. W badaniach na zwierzętach wiązany ze stanami zapalnymi jelit. EFSA (2018) zaleciła dalsze badania.', ['karagen', 'karagenina']],
  E407A: ['przetworzone wodorosty Eucheuma', 2, 'Zagęstnik podobny do karagenu, z tymi samymi zastrzeżeniami.'],
  E410: ['mączka chleba świętojańskiego', 0, OK_THICK, ['mączka chleba świętojańskiego', 'guma z chleba świętojańskiego']],
  E412: ['guma guar', 0, OK_THICK, ['guma guar']],
  E414: ['guma arabska', 0, OK_THICK, ['guma arabska']],
  E415: ['guma ksantanowa', 0, OK_THICK, ['guma ksantanowa']],
  E417: ['guma tara', 0, OK_THICK, ['guma tara']],
  E418: ['guma gellan', 0, OK_THICK, ['guma gellan']],
  E420: ['sorbitol', 1, POLYOLS, ['sorbitol', 'sorbitole']],
  E421: ['mannitol', 1, POLYOLS, ['mannitol']],
  E422: ['glicerol', 0, 'Substancja utrzymująca wilgotność. Nie budzi zastrzeżeń.', ['glicerol', 'gliceryna']],
  E432: ['polisorbat 20', 1, 'Emulgator syntetyczny.'],
  E433: ['polisorbat 80', 2, EMULS_GUT, ['polisorbat 80']],
  E435: ['polisorbat 60', 1, 'Emulgator syntetyczny.'],
  E436: ['polisorbat 65', 1, 'Emulgator syntetyczny.'],
  E440: ['pektyny', 0, OK_THICK, ['pektyna', 'pektyny']],
  E450: ['difosforany', 1, PHOSPHATES, ['difosforany', 'difosforan']],
  E451: ['trifosforany', 1, PHOSPHATES, ['trifosforany', 'trifosforan']],
  E452: ['polifosforany', 1, PHOSPHATES, ['polifosforany', 'polifosforan']],
  E460: ['celuloza', 0, 'Błonnik roślinny używany jako zagęstnik.'],
  E461: ['metyloceluloza', 0, 'Zagęstnik z celulozy.'],
  E464: ['hydroksypropylometyloceluloza', 0, 'Zagęstnik z celulozy.'],
  E466: ['karboksymetyloceluloza', 2, EMULS_GUT, ['karboksymetyloceluloza', 'karboksymetyloceluloza sodowa']],
  E471: ['mono- i diglicerydy kwasów tłuszczowych', 1, 'Emulgator. W dużym badaniu obserwacyjnym NutriNet-Santé (2023) większe spożycie wiązało się z wyższym ryzykiem chorób serca. To korelacja, a nie dowód przyczyny.', ['mono- i diglicerydy kwasów tłuszczowych', 'mono i diglicerydy']],
  E472A: ['estry kwasu octowego mono- i diglicerydów', 0, 'Emulgator.'],
  E472B: ['estry kwasu mlekowego mono- i diglicerydów', 0, 'Emulgator.'],
  E472C: ['estry kwasu cytrynowego mono- i diglicerydów', 0, 'Emulgator.'],
  E472E: ['estry kwasu mono- i diacetylowinowego mono- i diglicerydów', 1, 'Emulgator często używany w pieczywie.'],
  E476: ['polirycynooleinian poliglicerolu', 0, 'Emulgator używany w czekoladzie.'],
  E481: ['stearoilomleczan sodu', 0, 'Emulgator używany w pieczywie.'],
  E500: ['węglany sodu', 0, 'Spulchniacz, m.in. soda oczyszczona.', ['wodorowęglan sodu', 'węglany sodu']],
  E501: ['węglany potasu', 0, 'Regulator kwasowości.'],
  E503: ['węglany amonu', 0, 'Spulchniacz.', ['węglany amonu']],
  E504: ['węglany magnezu', 0, 'Substancja przeciwzbrylająca.'],
  E508: ['chlorek potasu', 0, OK_NATURAL],
  E509: ['chlorek wapnia', 0, OK_NATURAL],
  E516: ['siarczan wapnia', 0, OK_NATURAL],
  E524: ['wodorotlenek sodu', 0, 'Regulator kwasowości. W gotowym produkcie nie występuje w postaci żrącej.'],
  E551: ['dwutlenek krzemu', 1, 'Substancja przeciwzbrylająca. EFSA (2018) wskazała luki w danych o nanocząstkach.', ['dwutlenek krzemu']],
  E575: ['glukono-delta-lakton', 0, OK_NATURAL],
  E620: ['kwas glutaminowy', 1, 'Wzmacniacz smaku. EFSA (2017) ustaliła dopuszczalne dzienne spożycie, które przy dużym udziale przetworzonej żywności można przekroczyć.'],
  E621: ['glutaminian sodu', 1, 'Wzmacniacz smaku. EFSA (2017) ustaliła dopuszczalne dzienne spożycie, które przy dużym udziale przetworzonej żywności można przekroczyć.', ['glutaminian sodu', 'glutaminian monosodowy']],
  E627: ['guanylan disodowy', 1, FLAVOUR_ENH, ['guanylan disodowy']],
  E631: ['inozynian disodowy', 1, FLAVOUR_ENH, ['inozynian disodowy']],
  E635: ["5'-rybonukleotydy disodowe", 1, FLAVOUR_ENH, ['rybonukleotydy']],
  E640: ['glicyna', 0, 'Aminokwas.'],
  E900: ['dimetylopolisiloksan', 1, 'Substancja przeciwpieniąca.'],
  E901: ['wosk pszczeli', 0, 'Substancja glazurująca.', ['wosk pszczeli']],
  E903: ['wosk carnauba', 0, 'Substancja glazurująca z liści palmy.', ['wosk carnauba']],
  E904: ['szelak', 0, 'Substancja glazurująca.'],
  E920: ['L-cysteina', 0, 'Aminokwas używany w pieczywie.'],
  E941: ['azot', 0, 'Gaz ochronny w opakowaniu.'],
  E942: ['podtlenek azotu', 0, 'Gaz używany np. w bitej śmietanie w sprayu.'],
  E950: ['acesulfam K', 2, SWEETENER, ['acesulfam k', 'acesulfam']],
  E951: ['aspartam', 2, 'Słodzik. IARC (2023) uznała go za możliwie rakotwórczy (grupa 2B). JECFA utrzymała dopuszczalne dzienne spożycie 40 mg/kg masy ciała. Niedozwolony dla osób z fenyloketonurią.', ['aspartam']],
  E952: ['cyklaminiany', 2, SWEETENER, ['cyklaminian', 'cyklaminiany']],
  E954: ['sacharyna', 2, SWEETENER, ['sacharyna']],
  E955: ['sukraloza', 2, SWEETENER, ['sukraloza']],
  E960: ['glikozydy stewiolowe', 1, 'Słodzik pochodzenia roślinnego. WHO (2023) odradza słodziki jako sposób na kontrolę masy ciała.', ['glikozydy stewiolowe', 'stewia']],
  E961: ['neotam', 1, SWEETENER],
  E962: ['sól aspartamu-acesulfamu', 2, SWEETENER],
  E965: ['maltitol', 1, POLYOLS, ['maltitol', 'maltitole']],
  E966: ['laktitol', 1, POLYOLS, ['laktitol']],
  E967: ['ksylitol', 1, POLYOLS, ['ksylitol']],
  E968: ['erytrytol', 1, POLYOLS, ['erytrytol', 'erytrol']],
  E1103: ['inwertaza', 0, 'Enzym.'],
  E1404: ['skrobia utleniona', 0, OK_STARCH],
  E1410: ['fosforan monoskrobiowy', 0, OK_STARCH],
  E1412: ['fosforan diskrobiowy', 0, OK_STARCH],
  E1414: ['acetylowany fosforan diskrobiowy', 0, OK_STARCH],
  E1420: ['skrobia acetylowana', 0, OK_STARCH],
  E1422: ['acetylowany adypinian diskrobiowy', 0, OK_STARCH],
  E1440: ['skrobia hydroksypropylowana', 0, OK_STARCH],
  E1442: ['hydroksypropylowany fosforan diskrobiowy', 0, OK_STARCH],
  E1450: ['oktenylobursztynian skrobiowo-sodowy', 0, OK_STARCH],
  E1520: ['glikol propylenowy', 1, 'Nośnik aromatów. EFSA ustaliła dopuszczalne dzienne spożycie.', ['glikol propylenowy']]
};

/* Rzeczy, o których warto wiedzieć, choć nie są dodatkami z numerem E. */
const WATCH_WORDS = [
  { words: ['częściowo utwardzony', 'częściowo uwodorniony', 'utwardzony tłuszcz', 'tłuszcz utwardzony', 'olej utwardzony'], label: 'Tłuszcz utwardzony', note: 'Częściowo utwardzone tłuszcze mogą zawierać tłuszcze trans. W UE ich ilość jest ograniczona do 2 g na 100 g tłuszczu.', level: 2 },
  { words: ['syrop glukozowo-fruktozowy', 'syrop fruktozowo-glukozowy', 'syrop glukozowo fruktozowy'], label: 'Syrop glukozowo-fruktozowy', note: 'Dodany cukier w płynnej postaci. Liczy się do cukrów dodanych.', level: 1 },
  { words: ['olej palmowy', 'tłuszcz palmowy'], label: 'Olej palmowy', note: 'Zawiera dużo tłuszczów nasyconych. Jego uprawa budzi zastrzeżenia środowiskowe.', level: 1 },
  { words: ['aromat dymu wędzarniczego', 'aromaty dymu wędzarniczego'], label: 'Aromat dymu wędzarniczego', note: 'UE wycofuje część aromatów dymu wędzarniczego z powodu zastrzeżeń EFSA co do genotoksyczności.', level: 2 }
];

/* Składniki kosmetyków (INCI), nazwy małymi literami. */
const INCI = {
  'triclosan': [3, 'Środek antybakteryjny. Podejrzewany o działanie na układ hormonalny, w UE mocno ograniczony.'],
  'methylisothiazolinone': [3, 'Konserwant i silny alergen kontaktowy. W UE zakazany w kosmetykach niespłukiwanych.'],
  'methylchloroisothiazolinone': [3, 'Konserwant i silny alergen kontaktowy. W UE zakazany w kosmetykach niespłukiwanych.'],
  'formaldehyde': [3, 'IARC uznaje formaldehyd za rakotwórczy dla ludzi (grupa 1). Silny alergen.'],
  'hydroquinone': [3, 'Substancja rozjaśniająca. W UE zakazana w kosmetykach, poza systemami do sztucznych paznokci.'],
  'butylphenyl methylpropional': [3, 'Substancja zapachowa (lilial). Od 2022 r. zakazana w kosmetykach w UE, bo może szkodzić rozrodczości.'],
  'isobutylparaben': [3, 'Paraben zakazany w kosmetykach w UE od 2014 r.'],
  'isopropylparaben': [3, 'Paraben zakazany w kosmetykach w UE od 2014 r.'],
  'phenylparaben': [3, 'Paraben zakazany w kosmetykach w UE od 2014 r.'],
  'benzylparaben': [3, 'Paraben zakazany w kosmetykach w UE od 2014 r.'],
  'pentylparaben': [3, 'Paraben zakazany w kosmetykach w UE od 2014 r.'],
  'dmdm hydantoin': [2, 'Konserwant uwalniający formaldehyd. Może uczulać.'],
  'imidazolidinyl urea': [2, 'Konserwant uwalniający formaldehyd. Może uczulać.'],
  'diazolidinyl urea': [2, 'Konserwant uwalniający formaldehyd. Może uczulać.'],
  'quaternium-15': [2, 'Konserwant uwalniający formaldehyd. Może uczulać.'],
  'sodium hydroxymethylglycinate': [2, 'Konserwant uwalniający formaldehyd. Może uczulać.'],
  'butylparaben': [2, 'Paraben, którego stężenie UE ogranicza. Podejrzewany o działanie na układ hormonalny.'],
  'propylparaben': [2, 'Paraben, którego stężenie UE ogranicza. Podejrzewany o działanie na układ hormonalny.'],
  'methylparaben': [1, 'Paraben o krótkim łańcuchu. Uznawany za bezpieczny w dopuszczonych stężeniach.'],
  'ethylparaben': [1, 'Paraben o krótkim łańcuchu. Uznawany za bezpieczny w dopuszczonych stężeniach.'],
  'benzophenone-3': [2, 'Filtr UV. UE ogranicza jego stężenie. Podejrzewany o działanie na układ hormonalny.'],
  'oxybenzone': [2, 'Filtr UV. UE ogranicza jego stężenie. Podejrzewany o działanie na układ hormonalny.'],
  'homosalate': [2, 'Filtr UV. UE w 2022 r. obniżyła dopuszczalne stężenie.'],
  '4-methylbenzylidene camphor': [2, 'Filtr UV podejrzewany o działanie na układ hormonalny.'],
  'octocrylene': [1, 'Filtr UV. Może uczulać, a w starszych produktach może zawierać benzofenon.'],
  'ethylhexyl methoxycinnamate': [1, 'Filtr UV. Trwają badania nad wpływem na układ hormonalny.'],
  'cyclotetrasiloxane': [2, 'Silikon D4. W UE ograniczony z powodu możliwego wpływu na rozrodczość i środowisko.'],
  'cyclopentasiloxane': [1, 'Silikon D5. W UE ograniczony w kosmetykach spłukiwanych ze względów środowiskowych.'],
  'cocamide dea': [2, 'IARC uznaje go za możliwie rakotwórczy (grupa 2B).'],
  'bha': [2, 'Przeciwutleniacz. IARC uznaje go za możliwie rakotwórczy (grupa 2B).'],
  'butylated hydroxyanisole': [2, 'Przeciwutleniacz. IARC uznaje go za możliwie rakotwórczy (grupa 2B).'],
  'bht': [1, 'Przeciwutleniacz syntetyczny.'],
  'sodium lauryl sulfate': [1, 'Detergent. Może podrażniać skórę i oczy.'],
  'ammonium lauryl sulfate': [1, 'Detergent. Może podrażniać skórę.'],
  'sodium laureth sulfate': [1, 'Detergent łagodniejszy od SLS. Może zawierać śladowe zanieczyszczenia.'],
  'parfum': [1, 'Mieszanina zapachowa. Częsta przyczyna alergii kontaktowych.'],
  'fragrance': [1, 'Mieszanina zapachowa. Częsta przyczyna alergii kontaktowych.'],
  'limonene': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'linalool': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'citral': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'geraniol': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'citronellol': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'eugenol': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'coumarin': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'hexyl cinnamal': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'cinnamal': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'benzyl salicylate': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'benzyl alcohol': [1, 'Konserwant i substancja zapachowa z listy alergenów.'],
  'alpha-isomethyl ionone': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'hydroxycitronellal': [1, 'Substancja zapachowa z listy alergenów, które w UE trzeba podać na etykiecie.'],
  'paraffinum liquidum': [1, 'Olej mineralny. Bezpieczny w jakości kosmetycznej, ale u niektórych osób może zapychać pory.'],
  'mineral oil': [1, 'Olej mineralny. Bezpieczny w jakości kosmetycznej, ale u niektórych osób może zapychać pory.'],
  'petrolatum': [1, 'Wazelina. Bezpieczna w jakości kosmetycznej, mocno okluzyjna.'],
  'alcohol denat.': [1, 'Alkohol skażony. Może wysuszać skórę.'],
  'alcohol denat': [1, 'Alkohol skażony. Może wysuszać skórę.'],
  'talc': [1, 'Talk. Nie wdychać pudru w dużej ilości.'],
  'triethanolamine': [1, 'Regulator pH. Może podrażniać wrażliwą skórę.'],
  'retinol': [1, 'Witamina A. UE ogranicza jej stężenie w kosmetykach.'],
  'retinyl palmitate': [1, 'Pochodna witaminy A. UE ogranicza jej stężenie w kosmetykach.'],
  'salicylic acid': [1, 'Kwas salicylowy. Nie stosować u dzieci poniżej 3 lat, poza szamponami.'],
  'phenoxyethanol': [1, 'Konserwant dopuszczony w UE do stężenia 1%.'],
  'aluminum chlorohydrate': [1, 'Sól glinu w antyperspirantach. Naukowy komitet UE (SCCS) uznał ją za bezpieczną w ustalonych stężeniach.'],
  'aluminium chlorohydrate': [1, 'Sól glinu w antyperspirantach. Naukowy komitet UE (SCCS) uznał ją za bezpieczną w ustalonych stężeniach.']
};

/* Alergeny z bazy Open Food Facts. */
const ALLERGENS = {
  'en:gluten': 'gluten', 'en:milk': 'mleko', 'en:eggs': 'jaja', 'en:nuts': 'orzechy', 'en:peanuts': 'orzeszki ziemne',
  'en:soybeans': 'soja', 'en:celery': 'seler', 'en:mustard': 'gorczyca', 'en:sesame-seeds': 'sezam',
  'en:sulphur-dioxide-and-sulphites': 'siarczyny', 'en:fish': 'ryby', 'en:crustaceans': 'skorupiaki',
  'en:molluscs': 'mięczaki', 'en:lupin': 'łubin'
};

/* Przykładowe kody do wypróbowania bez aparatu. */
const EXAMPLES = [
  { code: '3017620422003', label: 'Krem orzechowy' },
  { code: '5449000000996', label: 'Napój cola' }
];

/* Profil „czego unikam”. Słowa są porównywane bez polskich znaków (np. „mąka” = „maka”). */
const PROFILE_OPTIONS = {
  allergens: [
    { key: 'gluten', label: 'Gluten', tags: ['en:gluten'], words: ['pszen', 'zyto', 'zytni', 'jeczmien', 'owies', 'owsian', 'orkisz', 'gluten', 'kamut', 'semolin'] },
    { key: 'milk', label: 'Mleko', tags: ['en:milk'], words: ['mleko', 'mleka', 'mleczn', 'laktoz', 'serwatk', 'kazein', 'smietan', 'jogurt', 'twarog', 'ser ', 'sery'] },
    { key: 'eggs', label: 'Jaja', tags: ['en:eggs'], words: ['jaja', 'jajk', 'jaj ', 'jajeczn', 'albumin'] },
    { key: 'nuts', label: 'Orzechy', tags: ['en:nuts'], words: ['orzech', 'migdal', 'pistacj', 'nerkowc', 'laskow', 'pekan', 'makadami'] },
    { key: 'peanuts', label: 'Orzeszki ziemne', tags: ['en:peanuts'], words: ['orzeszki ziemne', 'orzeszkow ziemnych', 'arachid'] },
    { key: 'soy', label: 'Soja', tags: ['en:soybeans'], words: ['soja', 'soi', 'sojow'] },
    { key: 'sesame', label: 'Sezam', tags: ['en:sesame-seeds'], words: ['sezam'] },
    { key: 'celery', label: 'Seler', tags: ['en:celery'], words: ['seler'] },
    { key: 'mustard', label: 'Gorczyca', tags: ['en:mustard'], words: ['gorczyc', 'musztard'] },
    { key: 'sulphites', label: 'Siarczyny', tags: ['en:sulphur-dioxide-and-sulphites'], words: ['siarczyn', 'dwutlenek siarki'], codes: ['E220', 'E221', 'E222', 'E223', 'E224', 'E226', 'E227', 'E228'] },
    { key: 'fish', label: 'Ryby', tags: ['en:fish'], words: ['ryba', 'ryby', 'rybn', 'rybi', 'losos', 'tunczyk', 'dorsz', 'sledz', 'anchois', 'makrel'] },
    { key: 'crustaceans', label: 'Skorupiaki', tags: ['en:crustaceans'], words: ['krewet', 'krab', 'homar', 'langust', 'skorupiak'] },
    { key: 'molluscs', label: 'Mięczaki', tags: ['en:molluscs'], words: ['malz', 'ostryg', 'kalmar', 'osmiornic', 'mieczak'] },
    { key: 'lupin', label: 'Łubin', tags: ['en:lupin'], words: ['lubin'] }
  ],
  diet: [
    { key: 'vegan', label: 'Wegańska' },
    { key: 'vegetarian', label: 'Wegetariańska' },
    { key: 'glutenfree', label: 'Bezglutenowa' },
    { key: 'lactose', label: 'Bez laktozy' },
    { key: 'lowsodium', label: 'Niskosodowa' },
    { key: 'lowcarb', label: 'Niskowęglowodanowa (keto)' },
    { key: 'diabetes', label: 'Dla osób z cukrzycą', approx: true },
    { key: 'cardio', label: 'Dla serca (np. po zawale)', approx: true },
    { key: 'mediterranean', label: 'Śródziemnomorska', approx: true },
    { key: 'lightdiet', label: 'Lekkostrawna', approx: true }
  ],
  avoid: [
    { key: 'sugar', label: 'Dodany cukier' },
    { key: 'kidsugar', label: 'Dużo cukru' },
    { key: 'salt', label: 'Dużo soli' },
    { key: 'satfat', label: 'Dużo tłuszczów nasyconych' },
    { key: 'palm', label: 'Olej palmowy' },
    { key: 'hydrogenated', label: 'Tłuszcz utwardzony' },
    { key: 'sweeteners', label: 'Słodziki' },
    { key: 'nitrites', label: 'Azotyny i azotany' },
    { key: 'controversial', label: 'Dodatki z zastrzeżeniami' },
    { key: 'ultra', label: 'Wysoko przetworzone' },
    { key: 'alcohol', label: 'Alkohol' },
    { key: 'caffeine', label: 'Kofeina' },
    { key: 'pork', label: 'Wieprzowina' }
  ],
  cosmetic: [
    { key: 'fragrance', label: 'Substancje zapachowe' },
    { key: 'parabens', label: 'Parabeny' }
  ]
};
const MEAT_WORDS = ['mieso', 'miesa', 'wieprz', 'wolow', 'drob', 'kurczak', 'kurcza', 'indyk', 'cielec', 'boczek', 'szynk', 'kielbas', 'salami', 'smalec', 'zelatyn', 'podroby'];
const SUGAR_WORDS = ['cukier', 'cukru', 'syrop', 'glukoz', 'fruktoz', 'dekstroz', 'miod', 'melas', 'cukry'];
const SWEETENER_CODES = ['E420', 'E421', 'E950', 'E951', 'E952', 'E954', 'E955', 'E960', 'E961', 'E962', 'E965', 'E966', 'E967', 'E968'];
const FRAGRANCE_INCI = ['parfum', 'fragrance', 'aroma', 'limonene', 'linalool', 'citral', 'geraniol', 'citronellol', 'eugenol', 'coumarin', 'hexyl cinnamal', 'cinnamal', 'benzyl salicylate', 'alpha-isomethyl ionone', 'hydroxycitronellal', 'butylphenyl methylpropional'];

/* Słowa do dopasowania po początku wyrazu (prefix) albo całym wyrazie (exact), bez polskich znaków. */
const WORDS = {
  alcohol: { exact: ['wino', 'wina', 'piwo', 'piwa', 'rum', 'rumu', 'gin'], prefix: ['alkohol', 'spirytus', 'likier', 'wodk', 'koniak', 'whisk', 'brandy', 'nalewk'] },
  caffeine: { exact: ['kawa', 'kawy', 'kawe', 'herbata', 'herbaty', 'guarana', 'yerba'], prefix: ['kofein', 'kawow', 'ekstrakt kawy'] },
  pork: { exact: ['smalec', 'smalcu', 'boczek', 'boczku'], prefix: ['wieprz', 'slonin'] },
  processedMeat: { exact: ['boczek', 'boczku'], prefix: ['wedlin', 'kielbas', 'salami', 'parowk', 'kabanos', 'pasztet', 'mortadel'] },
  lightdiet: { exact: ['bob', 'bobu'], prefix: ['fasol', 'groch', 'soczewic', 'ciecierzyc', 'kapust', 'brokul', 'kalafior', 'brukselk', 'cebul', 'czosn', 'chili', 'pieprz', 'chrzan', 'musztard', 'smazon', 'frytur', 'gazowan', 'jalapeno', 'cayenne'] },
  hydrogenated: { phrases: ['czesciowo utwardzon', 'czesciowo uwodorni', 'tluszcz utwardzon', 'olej utwardzon', 'tluszcze utwardzon', 'oleje utwardzon'] }
};
/* Własne składniki: gotowe odmiany dla popularnych słów. Klucz bez polskich znaków. */
const CUSTOM_SYNONYMS = {
  sol: { exact: ['sol', 'soli', 'sola'], prefix: ['solon', 'solank'] },
  cukier: { prefix: ['cukier', 'cukr', 'syrop', 'glukoz', 'fruktoz', 'sacharoz', 'dekstroz'] },
  mleko: { prefix: ['mlek', 'mlecz', 'laktoz'] },
  jajka: { prefix: ['jaj', 'jajk'] }, jaja: { prefix: ['jaj', 'jajk'] }, jajko: { prefix: ['jaj', 'jajk'] },
  maka: { prefix: ['mak'], exact: [] },
  drozdze: { prefix: ['drozdz'] },
  czosnek: { prefix: ['czosn'] },
  cebula: { prefix: ['cebul'] },
  kakao: { prefix: ['kakao', 'czekolad'] },
  czekolada: { prefix: ['czekolad'] },
  kawa: { exact: ['kawa', 'kawy', 'kawe'], prefix: ['kawow'] },
  miod: { exact: ['miod', 'miodu'], prefix: ['miodow'] },
  ryz: { exact: ['ryz', 'ryzu'], prefix: ['ryzow'] },
  pomidory: { prefix: ['pomidor'] }, pomidor: { prefix: ['pomidor'] },
  papryka: { prefix: ['papryk'] },
  grzyby: { prefix: ['grzyb', 'pieczark', 'borowik'] },
  kukurydza: { prefix: ['kukurydz'] },
  orzechy: { prefix: ['orzech'] },
  kokos: { prefix: ['kokos'] },
  wieprzowina: { prefix: ['wieprz'] },
  wolowina: { prefix: ['wolow'] },
  kurczak: { prefix: ['kurczak', 'kurczec', 'kurcza', 'drob'] },
  ser: { exact: ['ser', 'sera', 'serem', 'sery', 'serow'], prefix: ['serow'] },
  zelatyna: { prefix: ['zelatyn'] },
  aromat: { prefix: ['aromat'] },
  drob: { prefix: ['drob', 'kurczak', 'indyk'] }
};
const CUSTOM_MAX = 20;

/* Wersja D: cele to tylko skróty. Każdy cel zaznacza pozycje na liście „Pilnuję” (WATCH), a liczy się wyłącznie ta lista.
   Dzięki temu cukier, sól czy tłuszcze ustawia się w jednym miejscu i zawsze liczy tak samo. */
const GOALS = [
  { key: 'sugar', label: 'Mniej cukru (także przy cukrzycy)', watch: ['sugar'] },
  { key: 'heart', label: 'Serce i cholesterol', watch: ['satfat', 'salt'] },
  { key: 'pressure', label: 'Ciśnienie', watch: ['salt'] },
  { key: 'weight', label: 'Waga', watch: ['kcal', 'sugar'] },
  { key: 'muscle', label: 'Mięśnie', watch: ['protein'] },
  { key: 'digestion', label: 'Trawienie', watch: ['fiber'] },
  { key: 'clean', label: 'Mniej przetworzonej żywności', watch: ['processing'] },
  { key: 'healthy', label: 'Po prostu zdrowiej', watch: [], general: true }
];
const GOAL_TILES = {
  sugar: { label: 'Mniej cukru', hint: 'także przy cukrzycy', icon: 'sugar' },
  heart: { label: 'Serce', hint: 'cholesterol, tłuszcze', icon: 'heart' },
  pressure: { label: 'Ciśnienie', hint: 'mniej soli', icon: 'pressure' },
  weight: { label: 'Waga', hint: 'kalorie i cukier', icon: 'weight' },
  muscle: { label: 'Mięśnie', hint: 'więcej białka', icon: 'protein' },
  digestion: { label: 'Trawienie', hint: 'więcej błonnika', icon: 'fiber' },
  clean: { label: 'Mniej przetworzone', hint: 'mniej dodatków', icon: 'processing' },
  healthy: { label: 'Po prostu zdrowiej', hint: 'bez konkretnego celu', icon: 'healthy' }
};
/* „Pilnuję”: jedna zasada liczenia dla każdej pozycji.
   limit: mało +5, średnio −10 (najwyżej 74%), dużo −25 (najwyżej 45%), brak danych: najwyżej 70%.
   contains: zawiera −25 (najwyżej 45%), nie zawiera 0, nie wiadomo: najwyżej 70%.
   more: dużo +10, źródło +5, mało 0. */
const WATCH = [
  { key: 'sugar', label: 'Cukier', kind: 'limit', icon: 'sugar' },
  { key: 'salt', label: 'Sól', kind: 'limit', icon: 'salt' },
  { key: 'satfat', label: 'Tłuszcze nasycone', kind: 'limit', icon: 'fat' },
  { key: 'kcal', label: 'Kalorie', kind: 'limit', icon: 'kcal' },
  { key: 'processing', label: 'Przetworzenie i dodatki', kind: 'limit', icon: 'processing' },
  { key: 'palm', label: 'Olej palmowy', kind: 'contains', icon: 'palm' },
  { key: 'sweeteners', label: 'Słodziki', kind: 'contains', icon: 'sweetener' },
  { key: 'caffeine', label: 'Kofeina', kind: 'contains', icon: 'caffeine' },
  { key: 'protein', label: 'Białko (więcej)', kind: 'more', icon: 'protein' },
  { key: 'fiber', label: 'Błonnik (więcej)', kind: 'more', icon: 'fiber' }
];
const WATCH_MAX = 6;
const GOALS_MAX = 3;
const IRON_FOOD_WORDS = { prefix: ['watrob', 'wolow', 'soczewic', 'ciecierzyc', 'fasol', 'szpinak', 'kasza gryczana', 'kaszy gryczanej', 'pestki dyni', 'amarantus', 'komos', 'quinoa', 'natka pietruszki'] };
const CHOLESTEROL_PLUS_WORDS = { prefix: ['owsian', 'owies', 'beta glukan', 'betaglukan', 'sterol', 'stanol'] };
const WHOLEGRAIN_WORDS = { prefix: ['pelnoziarnist', 'razow', 'z pelnego ziarna', 'otrab'] };

/* Sklepy i kategorie dla listy „Dobre dla Ciebie”. Tagi jak w Open Food Facts. */
/* Sieci działające w Polsce (3.0.5: rozszerzona lista). key = nazwa bez znaków (szukamy jej w polu „stores” produktu),
   alias = inne spotykane pisownie. Literówki do 1–2 znaków łączy A.storeKeyOf. Tesco nie ma (wyszło z Polski w 2021). */
const STORES = [
  { key: 'biedronka', label: 'Biedronka' },
  { key: 'lidl', label: 'Lidl' },
  { key: 'kaufland', label: 'Kaufland' },
  { key: 'auchan', label: 'Auchan' },
  { key: 'carrefour', label: 'Carrefour' },
  { key: 'dino', label: 'Dino' },
  { key: 'netto', label: 'Netto' },
  { key: 'aldi', label: 'Aldi' },
  { key: 'zabka', label: 'Żabka' },
  { key: 'stokrotka', label: 'Stokrotka' },
  { key: 'lewiatan', label: 'Lewiatan' },
  { key: 'polomarket', label: 'Polomarket' },
  { key: 'intermarche', label: 'Intermarché' },
  { key: 'spar', label: 'Spar' },
  { key: 'leclerc', label: 'E.Leclerc' },
  { key: 'spolem', label: 'Społem' },
  { key: 'mila', label: 'Mila' },
  { key: 'globus', label: 'Globus' },
  { key: 'delikatesycentrum', label: 'Delikatesy Centrum' },
  { key: 'topaz', label: 'Topaz' },
  { key: 'chatapolska', label: 'Chata Polska', alias: ['polskachata'] },
  { key: 'groszek', label: 'Groszek' },
  { key: 'freshmarket', label: 'Freshmarket' },
  { key: 'makro', label: 'Makro' },
  { key: 'selgros', label: 'Selgros' },
  { key: 'dealz', label: 'Dealz' },
  { key: 'rossmann', label: 'Rossmann' },
  { key: 'hebe', label: 'Hebe' }
];
/* Kategorie list „Najlepsze dla Ciebie”. Tagi kategorii Open Food Facts; liczby produktów w Polsce sprawdzone 19.10.2026
   (od ok. 60 do ok. 700 na kategorię). Grupy i ikony pokazuje ekran „Wszystkie kategorie”. */
const SHOP_GROUPS = [
  { key: 'dairy', label: 'Nabiał', icon: 'dept_dairy' },
  { key: 'breakfast', label: 'Pieczywo i śniadanie', icon: 'dept_breakfast' },
  { key: 'meat', label: 'Mięso i ryby', icon: 'dept_meat' },
  { key: 'pantry', label: 'Spiżarnia', icon: 'dept_pantry' },
  { key: 'ready', label: 'Dania gotowe i mrożonki', icon: 'dept_frozen' },
  { key: 'snacks', label: 'Przekąski i słodycze', icon: 'dept_snacks' },
  { key: 'drinks', label: 'Napoje', icon: 'dept_drinks' }
];
const SHOP_CATEGORIES = [
  { key: 'en:yogurts', label: 'Jogurty', group: 'dairy' },
  { key: 'en:cheeses', label: 'Sery', group: 'dairy' },
  { key: 'en:quarks', label: 'Twarogi i serki', group: 'dairy' },
  { key: 'en:milks', label: 'Mleko', group: 'dairy' },
  { key: 'en:butters', label: 'Masło', group: 'dairy' },
  { key: 'en:dairy-desserts', label: 'Desery mleczne', group: 'dairy' },
  { key: 'en:plant-based-milk-alternatives', label: 'Napoje roślinne', group: 'dairy' },
  { key: 'en:breads', label: 'Pieczywo', group: 'breakfast' },
  { key: 'en:breakfast-cereals', label: 'Płatki śniadaniowe', group: 'breakfast' },
  { key: 'en:mueslis', label: 'Musli i granola', group: 'breakfast' },
  { key: 'en:sweet-spreads', label: 'Słodkie kremy', group: 'breakfast' },
  { key: 'en:jams', label: 'Dżemy', group: 'breakfast' },
  { key: 'en:hummus', label: 'Hummus', group: 'breakfast' },
  { key: 'en:prepared-meats', label: 'Wędliny', group: 'meat' },
  { key: 'en:sausages', label: 'Kiełbasy i parówki', group: 'meat' },
  { key: 'en:fishes', label: 'Ryby', group: 'meat' },
  { key: 'en:canned-fishes', label: 'Konserwy rybne', group: 'meat' },
  { key: 'en:pastas', label: 'Makarony', group: 'pantry' },
  { key: 'en:groats', label: 'Kasze', group: 'pantry' },
  { key: 'en:rices', label: 'Ryż', group: 'pantry' },
  { key: 'en:legumes', label: 'Strączki', group: 'pantry' },
  { key: 'en:sauces', label: 'Sosy', group: 'pantry' },
  { key: 'en:ketchup', label: 'Ketchup', group: 'pantry' },
  { key: 'en:vegetable-oils', label: 'Oleje', group: 'pantry' },
  { key: 'en:canned-vegetables', label: 'Warzywa w puszce i słoiku', group: 'pantry' },
  { key: 'en:pickles', label: 'Kiszonki i marynaty', group: 'pantry' },
  { key: 'en:meals', label: 'Dania gotowe', group: 'ready' },
  { key: 'en:soups', label: 'Zupy', group: 'ready' },
  { key: 'en:pierogi', label: 'Pierogi', group: 'ready' },
  { key: 'en:pizzas', label: 'Pizza', group: 'ready' },
  { key: 'en:frozen-vegetables', label: 'Mrożone warzywa', group: 'ready' },
  { key: 'en:nuts', label: 'Orzechy', group: 'snacks' },
  { key: 'en:dried-fruits', label: 'Bakalie', group: 'snacks' },
  { key: 'en:salty-snacks', label: 'Słone przekąski', group: 'snacks' },
  { key: 'en:crisps', label: 'Chipsy', group: 'snacks' },
  { key: 'en:biscuits', label: 'Ciastka', group: 'snacks' },
  { key: 'en:chocolates', label: 'Czekolady', group: 'snacks' },
  { key: 'en:candies', label: 'Cukierki', group: 'snacks' },
  { key: 'en:ice-creams', label: 'Lody', group: 'snacks' },
  { key: 'en:fruit-juices', label: 'Soki', group: 'drinks' },
  { key: 'en:waters', label: 'Woda', group: 'drinks' },
  { key: 'en:sodas', label: 'Napoje gazowane', group: 'drinks' },
  { key: 'en:teas', label: 'Herbaty', group: 'drinks' },
  { key: 'en:coffees', label: 'Kawy', group: 'drinks' }
];

/* Działy sklepu w kolejności typowego przejścia przez dyskont. Tagi kategorii OFF i słowa z nazwy (bez polskich znaków). */
const DEPARTMENTS = [
  { key: 'veg', label: 'Warzywa i owoce', icon: 'dept_veg', tags: ['en:fruits', 'en:vegetables', 'en:fresh-vegetables', 'en:fresh-fruits', 'en:fruits-and-vegetables-based-foods'], words: ['marchew', 'ziemniak', 'pomidor', 'ogor', 'cebul', 'czosn', 'jablk', 'banan', 'gruszk', 'cytryn', 'pomarancz', 'salat', 'kapust', 'papryk', 'brokul', 'kalafior', 'pietrusz', 'seler', 'por ', 'burak', 'owoc', 'warzyw', 'winogr', 'truskaw', 'malin', 'borowk', 'awokado', 'kiwi', 'mandaryn', 'grzyb', 'pieczark', 'rzodkiew', 'szpinak', 'cukini', 'dyni'] },
  { key: 'bread', label: 'Pieczywo', icon: 'dept_bread', tags: ['en:breads', 'en:bakery', 'en:viennoiseries'], words: ['chleb', 'bulk', 'bulecz', 'bagiet', 'rogal', 'pieczyw', 'tortill', 'grahamk', 'kajzerk'] },
  { key: 'dairy', label: 'Nabiał', icon: 'dept_dairy', tags: ['en:dairies', 'en:yogurts', 'en:cheeses', 'en:milks', 'en:eggs', 'en:butters'], words: ['mleko', 'jogurt', 'kefir', 'maslank', 'ser ', 'sery', 'twarog', 'serek', 'smietan', 'maslo', 'jaja', 'jajk', 'skyr'] },
  { key: 'meat', label: 'Mięso, ryby i wędliny', icon: 'dept_meat', tags: ['en:meats', 'en:prepared-meats', 'en:fishes', 'en:seafood', 'en:poultries'], words: ['mieso', 'kurczak', 'indyk', 'wolow', 'wieprz', 'szynk', 'kielbas', 'parowk', 'boczek', 'ryba', 'losos', 'dorsz', 'tunczyk', 'sledz', 'pasztet', 'filet'] },
  { key: 'frozen', label: 'Mrożonki', icon: 'dept_frozen', tags: ['en:frozen-foods'], words: ['mrozon', 'lody', 'pierogi mroz'] },
  { key: 'pantry', label: 'Sypkie, przetwory i przyprawy', icon: 'dept_pantry', tags: ['en:cereals-and-potatoes', 'en:pastas', 'en:rices', 'en:flours', 'en:canned-foods', 'en:sauces', 'en:condiments', 'en:spices', 'en:fats', 'en:legumes'], words: ['makaron', 'ryz', 'kasz', 'mak', 'cukier', 'sol', 'olej', 'oliw', 'przypraw', 'pieprz', 'sos', 'ketchup', 'musztard', 'majonez', 'konserw', 'fasol', 'ciecierzyc', 'soczewic', 'groch', 'koncentrat', 'passat', 'pomidory w puszce'] },
  { key: 'breakfast', label: 'Śniadanie', icon: 'dept_breakfast', tags: ['en:breakfasts', 'en:breakfast-cereals', 'en:spreads', 'en:honeys', 'en:jams'], words: ['platki', 'musli', 'granol', 'owsiank', 'dzem', 'miod', 'krem do smarowania', 'pasta'] },
  { key: 'snacks', label: 'Przekąski i słodycze', icon: 'dept_snacks', tags: ['en:snacks', 'en:sweet-snacks', 'en:salty-snacks', 'en:confectioneries', 'en:chocolates', 'en:biscuits-and-cakes'], words: ['chips', 'czips', 'paluszk', 'wafl', 'ciastk', 'herbatnik', 'czekolad', 'baton', 'cukierk', 'zelk', 'orzeszk', 'krakers', 'popcorn'] },
  { key: 'drinks', label: 'Napoje', icon: 'dept_drinks', tags: ['en:beverages', 'en:waters', 'en:juices', 'en:sodas', 'en:coffees', 'en:teas'], words: ['woda', 'wody', 'sok', 'napoj', 'cola', 'kawa', 'herbat', 'piwo', 'wino', 'lemoniad'] },
  { key: 'home', label: 'Dom i chemia', icon: 'dept_home', tags: [], words: ['papier', 'recznik', 'proszek', 'plyn do', 'mydlo', 'szampon', 'pasta do zebow', 'gabk', 'worki', 'folia', 'chusteczk', 'pieluch', 'kapsulk'] },
  { key: 'other', label: 'Inne', icon: 'dept_other', tags: [], words: [] }
];

/* Kafelki „Najlepsze dla Ciebie” na ekranie głównym (klucz kategorii jak w SHOP_CATEGORIES); reszta na ekranie „Wszystkie kategorie”. */
const HOME_TILES = [
  { cat: 'en:yogurts', label: 'Jogurty', icon: 'prod_yogurt', bg: '#FFF3CC' },
  { cat: 'en:breads', label: 'Pieczywo', icon: 'prod_bread', bg: '#FFE3DE' },
  { cat: 'en:breakfast-cereals', label: 'Płatki', icon: 'prod_bowl', bg: '#DDF5E8' }
];

/* Wersja D: „Nie jem” to tylko twarde wykluczenia. Reszta dawnych „unikam” i diet jest na liście „Pilnuję”. */
PROFILE_OPTIONS.diet = PROFILE_OPTIONS.diet.filter(o => ['vegan', 'vegetarian', 'glutenfree', 'lactose'].includes(o.key));
PROFILE_OPTIONS.avoid = PROFILE_OPTIONS.avoid.filter(o => ['pork', 'alcohol'].includes(o.key));

/* Wersja D: dodatkowe kategorie ze zdjęciami (strony albumu i listy „Najlepsze”). */
SHOP_GROUPS.splice(3, 0, { key: 'fresh', label: 'Owoce, warzywa i świeże', icon: 'dept_produce' });
SHOP_CATEGORIES.push(
  { key: 'en:creams', label: 'Śmietana', group: 'dairy' },
  { key: 'en:eggs', label: 'Jajka', group: 'dairy' },
  { key: 'en:fresh-meats', label: 'Mięso', group: 'meat' },
  { key: 'en:fresh-fruits', label: 'Owoce', group: 'fresh' },
  { key: 'en:fresh-vegetables', label: 'Warzywa', group: 'fresh' },
  { key: 'en:beers', label: 'Piwo', group: 'drinks' }
);
