#!/usr/bin/env python3
"""Builds site/i18n.js (every language the page speaks) from the dictionaries below.

Traditional Chinese is generated from Simplified with OpenCC (Taiwan wording), then a few
Taiwan-specific fixes are applied. Run:  python3 tools/build_i18n.py
Needs:  pip install opencc-python-reimplemented
"""
import json, pathlib, re
from opencc import OpenCC

OUT = pathlib.Path(__file__).resolve().parent.parent / "site" / "i18n.js"

EN = {
 "tagline": "Badminton racket prices across stores, checked for you.",
 "free": "Free plan", "preview": "Premium preview", "previewSw": "Preview premium",
 "watchlist": "Your watchlist", "slots": "{n} of {m} slots", "watching": "{n} watching",
 "subFree": "Prices checked every 3 days. No alerts on the free plan.", "subPrem": "Prices checked every hour. Alerts are on.",
 "openSlot": "Open slot. Tap Watch on any racket to add it here.", "emptyPrem": "Nothing here yet. Tap Watch on any racket to add it.",
 "premium": "Premium", "p1": "Watch as many rackets as you like", "p2": "Email or text when a price drops", "p3": "Prices checked every hour", "p4": "Full price history for every racket", "p5": "More stores, and add your own",
 "find": "Find a racket", "search": "Search by name, like Auraspeed", "all": "All",
 "sMost": "Most stores compared", "sLow": "Lowest price first", "sHigh": "Highest price first", "sOff": "Biggest listed discount",
 "gloss": "What do 4U, G5 and head heavy mean?", "g4u": "A lighter racket, about 80 to 84 grams.", "gg5": "A smaller grip size. Good for players with smaller hands or who like wrist control.", "ghh": "More weight toward the top. Hits harder, a bit slower to swing.", "ghl": "More weight toward the handle. Quicker to swing.", "tipEB": "Weight is spread evenly between the head and the handle.",
 "country": "Country", "region": "State", "regionCA": "Province", "pick": "Choose…", "lang": "Language",
 "hint": "Pick your {r} to see estimated totals with shipping, tax and tariffs.", "hintAKHI": "Alaska and Hawaii shipping is different, so only listed prices are shown.",
 "rackets": "{n} rackets", "racket1": "1 racket", "more": "Show more rackets ({n} left)", "none": "No rackets match that search. Try a shorter name.",
 "watch": "Watch", "watchingBtn": "Watching", "remove": "Remove", "view": "View at {s}", "lowest": "Lowest", "out": "Out of stock", "outAll": "Out of stock at every store right now",
 "at": "at {s}", "lockedHist": "Price history and alerts come with premium.", "alertBelow": "Alert me below", "hit": "Target hit", "alertsOn": "Email and text alerts on",
 "limit1": "Your free plan holds 3 rackets. Remove one, or preview premium for no limit.", "limit2": "Your free plan holds 3. Remove one from your watchlist first, or preview premium.", "limit3": "The free plan keeps your first 3 watches.",
 "realHist": "Real history since {d}", "lowHigh": "Low {l}, high {h}", "histStart": "History starts building from today. Check back after the next update.",
 "updated": "Prices updated {d}.", "comparing": "Comparing {s}.", "noteNoTotals": "Listed prices are before shipping, tax and tariffs.", "noteTotals": "Totals are estimates for one racket. Shipping rules come from each store; sales tax is a rough state average; the tariff on Canadian orders is a rough guess.",
 "loadFail": "Could not load prices right now. Please refresh in a moment.", "loading": "Loading prices…",
 "fromCA": "Ships from Canada", "total": "≈ {t} total", "ship": "shipping", "freeShip": "free shipping", "tax": "tax", "tariff": "tariff (est.)", "est": "estimate",
 "unknownShip": "Shipping to Canada not confirmed, listed price only", "importTax": "plus import taxes at delivery",
 "sHH": "Head Heavy", "sHL": "Head Light", "sEB": "Even Balance", "sBeg": "Beginner", "sInt": "Intermediate", "sAdv": "Advanced", "sPro": "Pro",
 "wlLead": "Premium isn't open yet. Leave your email and we'll tell you the day it launches. No payment now.", "wlEmail": "Your email", "wlBtn": "Notify me", "wlThanks": "Thanks! We'll email you when premium launches.", "wlErr": "Something went wrong. Please try again.",
}

ZH = {
 "tagline": "多家商店的羽毛球拍价格，替你盯着。",
 "free": "免费版", "preview": "高级版预览", "previewSw": "预览高级版",
 "watchlist": "我的关注", "slots": "已用 {n}/{m} 个名额", "watching": "关注 {n} 支",
 "subFree": "价格每 3 天更新一次。免费版没有提醒。", "subPrem": "价格每小时更新一次，提醒已开启。",
 "openSlot": "空位。点任意球拍的“关注”即可加入。", "emptyPrem": "这里还没有球拍。点“关注”即可添加。",
 "premium": "高级版", "p1": "关注球拍数量不限", "p2": "降价时发邮件或短信提醒", "p3": "价格每小时更新", "p4": "每支球拍的完整价格历史", "p5": "更多商店，还能添加你自己的",
 "find": "找球拍", "search": "按名称搜索，中英文都行，比如 神速 或 Auraspeed", "all": "全部",
 "sMost": "对比商店最多", "sLow": "价格从低到高", "sHigh": "价格从高到低", "sOff": "折扣最大",
 "gloss": "4U、G5 和“头重”是什么意思？", "g4u": "较轻的球拍，大约 80 到 84 克。", "gg5": "较细的握把。适合手小或喜欢手腕灵活的球友。", "ghh": "重量偏向拍头。杀球更有力，但挥拍稍慢。", "ghl": "重量偏向手柄。挥拍更快。", "tipEB": "重量在拍头和手柄之间分布均匀。",
 "country": "国家", "region": "州", "regionCA": "省", "pick": "请选择…", "lang": "语言",
 "hint": "选择你所在的{r}，即可看到含运费、税和关税的预估总价。", "hintAKHI": "阿拉斯加和夏威夷的运费不同，所以只显示标价。",
 "rackets": "{n} 支球拍", "racket1": "1 支球拍", "more": "显示更多球拍（还有 {n} 支）", "none": "没有符合搜索的球拍。试试更短的名字。",
 "watch": "关注", "watchingBtn": "已关注", "remove": "移除", "view": "去 {s} 查看", "lowest": "最低", "out": "缺货", "outAll": "所有商店目前都缺货",
 "at": "在 {s}", "lockedHist": "价格历史和提醒属于高级版。", "alertBelow": "低于此价提醒我", "hit": "已达目标价", "alertsOn": "邮件和短信提醒已开启",
 "limit1": "免费版最多关注 3 支球拍。请先移除一支，或预览高级版（不限数量）。", "limit2": "免费版最多关注 3 支。请先从关注列表移除一支，或预览高级版。", "limit3": "免费版保留你最先关注的 3 支。",
 "realHist": "真实价格历史，自 {d} 起", "lowHigh": "最低 {l}，最高 {h}", "histStart": "价格历史从今天开始积累，下次更新后再来看。",
 "updated": "价格更新于 {d}。", "comparing": "对比商店：{s}。", "noteNoTotals": "标价不含运费、税和关税。", "noteTotals": "总价为单支球拍的预估。运费规则来自各商店；销售税是各州的粗略平均值；加拿大订单的关税只是粗略估计。",
 "loadFail": "暂时无法加载价格，请稍后刷新。", "loading": "正在加载价格…",
 "fromCA": "从加拿大发货", "total": "总价约 {t}", "ship": "运费", "freeShip": "免运费", "tax": "税", "tariff": "关税（估）", "est": "估计",
 "unknownShip": "加拿大运费未确认，仅显示标价", "importTax": "另需在收货时缴纳进口税",
 "sHH": "头重", "sHL": "头轻", "sEB": "均衡", "sBeg": "入门", "sInt": "中级", "sAdv": "进阶", "sPro": "专业",
 "wlLead": "高级版还没开放。留下邮箱，上线当天我们会通知你。现在不需要付款。", "wlEmail": "你的邮箱", "wlBtn": "上线时通知我", "wlThanks": "谢谢！高级版上线时我们会发邮件给你。", "wlErr": "出错了，请再试一次。",
}

HI = {
 "tagline": "कई दुकानों में बैडमिंटन रैकेट की कीमतें, आपके लिए जाँची हुई।",
 "free": "मुफ़्त प्लान", "preview": "प्रीमियम प्रीव्यू", "previewSw": "प्रीमियम देखें",
 "watchlist": "आपकी वॉचलिस्ट", "slots": "{m} में से {n} स्लॉट", "watching": "{n} पर नज़र",
 "subFree": "कीमतें हर 3 दिन में जाँची जाती हैं। मुफ़्त प्लान में अलर्ट नहीं हैं।", "subPrem": "कीमतें हर घंटे जाँची जाती हैं। अलर्ट चालू हैं।",
 "openSlot": "खाली स्लॉट। जोड़ने के लिए किसी भी रैकेट पर “वॉच” दबाएँ।", "emptyPrem": "यहाँ अभी कुछ नहीं है। जोड़ने के लिए किसी रैकेट पर “वॉच” दबाएँ।",
 "premium": "प्रीमियम", "p1": "जितने चाहें उतने रैकेट वॉच करें", "p2": "कीमत गिरने पर ईमेल या टेक्स्ट", "p3": "कीमतें हर घंटे जाँची जाती हैं", "p4": "हर रैकेट का पूरा कीमत इतिहास", "p5": "ज़्यादा दुकानें, और अपनी भी जोड़ें",
 "find": "रैकेट खोजें", "search": "नाम से खोजें, जैसे Auraspeed", "all": "सभी",
 "sMost": "सबसे ज़्यादा दुकानों की तुलना", "sLow": "सबसे कम कीमत पहले", "sHigh": "सबसे ज़्यादा कीमत पहले", "sOff": "सबसे बड़ी छूट",
 "gloss": "4U, G5 और हेड हेवी का क्या मतलब है?", "g4u": "हल्का रैकेट, लगभग 80 से 84 ग्राम।", "gg5": "छोटी ग्रिप। छोटे हाथ वाले या कलाई से खेलने वाले खिलाड़ियों के लिए अच्छी।", "ghh": "वज़न ऊपर की ओर ज़्यादा। ज़्यादा ताक़त, पर घुमाना थोड़ा धीमा।", "ghl": "वज़न हैंडल की ओर ज़्यादा। घुमाना तेज़।", "tipEB": "वज़न सिर और हैंडल के बीच बराबर बँटा है।",
 "country": "देश", "region": "राज्य", "regionCA": "प्रांत", "pick": "चुनें…", "lang": "भाषा",
 "hint": "शिपिंग, टैक्स और टैरिफ़ सहित अनुमानित कुल कीमत देखने के लिए अपना {r} चुनें।", "hintAKHI": "अलास्का और हवाई की शिपिंग अलग है, इसलिए सिर्फ़ लिस्टेड कीमतें दिख रही हैं।",
 "rackets": "{n} रैकेट", "racket1": "1 रैकेट", "more": "और रैकेट दिखाएँ ({n} बाकी)", "none": "इस खोज से कोई रैकेट नहीं मिला। छोटा नाम आज़माएँ।",
 "watch": "वॉच करें", "watchingBtn": "वॉच में", "remove": "हटाएँ", "view": "{s} पर देखें", "lowest": "सबसे कम", "out": "स्टॉक में नहीं", "outAll": "अभी हर दुकान पर स्टॉक में नहीं",
 "at": "{s} पर", "lockedHist": "कीमत इतिहास और अलर्ट प्रीमियम में मिलते हैं।", "alertBelow": "इससे कम होने पर बताएँ", "hit": "लक्ष्य पूरा", "alertsOn": "ईमेल और टेक्स्ट अलर्ट चालू",
 "limit1": "मुफ़्त प्लान में 3 रैकेट रखे जा सकते हैं। एक हटाएँ, या बिना सीमा के लिए प्रीमियम देखें।", "limit2": "मुफ़्त प्लान में 3 रैकेट रखे जा सकते हैं। पहले वॉचलिस्ट से एक हटाएँ, या प्रीमियम देखें।", "limit3": "मुफ़्त प्लान आपके पहले 3 रैकेट रखता है।",
 "realHist": "{d} से असली इतिहास", "lowHigh": "न्यूनतम {l}, अधिकतम {h}", "histStart": "इतिहास आज से बनना शुरू होता है। अगले अपडेट के बाद देखें।",
 "updated": "कीमतें {d} को अपडेट हुईं।", "comparing": "तुलना: {s}।", "noteNoTotals": "लिस्टेड कीमतों में शिपिंग, टैक्स और टैरिफ़ शामिल नहीं हैं।", "noteTotals": "कुल कीमतें एक रैकेट का अनुमान हैं। शिपिंग नियम हर दुकान से लिए गए हैं; सेल्स टैक्स राज्य का मोटा औसत है; कनाडा के ऑर्डर पर टैरिफ़ मोटा अंदाज़ा है।",
 "loadFail": "अभी कीमतें लोड नहीं हो सकीं। कृपया थोड़ी देर में रीफ़्रेश करें।", "loading": "कीमतें लोड हो रही हैं…",
 "fromCA": "कनाडा से शिप", "total": "कुल ≈ {t}", "ship": "शिपिंग", "freeShip": "मुफ़्त शिपिंग", "tax": "टैक्स", "tariff": "टैरिफ़ (अनुमान)", "est": "अनुमान",
 "unknownShip": "कनाडा की शिपिंग पक्की नहीं, सिर्फ़ लिस्टेड कीमत", "importTax": "डिलीवरी पर आयात कर अलग",
 "sHH": "हेड हेवी", "sHL": "हेड लाइट", "sEB": "संतुलित", "sBeg": "शुरुआती", "sInt": "मध्यम", "sAdv": "एडवांस्ड", "sPro": "प्रो",
 "wlLead": "प्रीमियम अभी शुरू नहीं हुआ है। अपना ईमेल दें, शुरू होने के दिन हम बता देंगे। अभी कोई भुगतान नहीं।", "wlEmail": "आपका ईमेल", "wlBtn": "मुझे बताएँ", "wlThanks": "धन्यवाद! प्रीमियम शुरू होने पर हम ईमेल करेंगे।", "wlErr": "कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।",
}

ES = {
 "tagline": "Precios de raquetas de bádminton en varias tiendas, revisados por ti.",
 "free": "Plan gratis", "preview": "Vista previa premium", "previewSw": "Ver premium",
 "watchlist": "Tu lista de seguimiento", "slots": "{n} de {m} espacios", "watching": "Siguiendo {n}",
 "subFree": "Precios revisados cada 3 días. Sin alertas en el plan gratis.", "subPrem": "Precios revisados cada hora. Alertas activadas.",
 "openSlot": "Espacio libre. Toca Seguir en cualquier raqueta para añadirla.", "emptyPrem": "Aún no hay nada. Toca Seguir en una raqueta para añadirla.",
 "premium": "Premium", "p1": "Sigue todas las raquetas que quieras", "p2": "Correo o SMS cuando baje un precio", "p3": "Precios revisados cada hora", "p4": "Historial de precios completo de cada raqueta", "p5": "Más tiendas, y añade las tuyas",
 "find": "Buscar raqueta", "search": "Busca por nombre, como Auraspeed", "all": "Todas",
 "sMost": "Más tiendas comparadas", "sLow": "Precio más bajo primero", "sHigh": "Precio más alto primero", "sOff": "Mayor descuento",
 "gloss": "¿Qué significan 4U, G5 y cabeza pesada?", "g4u": "Una raqueta más ligera, de unos 80 a 84 gramos.", "gg5": "Un grosor de empuñadura menor. Bueno para manos pequeñas o para quien juega con la muñeca.", "ghh": "Más peso hacia arriba. Pega más fuerte, pero se mueve algo más lento.", "ghl": "Más peso hacia el mango. Más rápida de mover.", "tipEB": "El peso se reparte por igual entre la cabeza y el mango.",
 "country": "País", "region": "Estado", "regionCA": "Provincia", "pick": "Elige…", "lang": "Idioma",
 "hint": "Elige tu {r} para ver totales estimados con envío, impuestos y aranceles.", "hintAKHI": "El envío a Alaska y Hawái es distinto, así que solo se muestran los precios de lista.",
 "rackets": "{n} raquetas", "racket1": "1 raqueta", "more": "Mostrar más raquetas (quedan {n})", "none": "Ninguna raqueta coincide con la búsqueda. Prueba un nombre más corto.",
 "watch": "Seguir", "watchingBtn": "Siguiendo", "remove": "Quitar", "view": "Ver en {s}", "lowest": "Más bajo", "out": "Agotado", "outAll": "Agotada ahora en todas las tiendas",
 "at": "en {s}", "lockedHist": "El historial de precios y las alertas vienen con premium.", "alertBelow": "Avísame por debajo de", "hit": "Objetivo alcanzado", "alertsOn": "Alertas por correo y SMS activadas",
 "limit1": "Tu plan gratis admite 3 raquetas. Quita una, o prueba premium sin límite.", "limit2": "Tu plan gratis admite 3. Quita una de tu lista primero, o prueba premium.", "limit3": "El plan gratis conserva tus primeras 3.",
 "realHist": "Historial real desde {d}", "lowHigh": "Mín. {l}, máx. {h}", "histStart": "El historial empieza hoy. Vuelve después de la próxima actualización.",
 "updated": "Precios actualizados el {d}.", "comparing": "Comparando {s}.", "noteNoTotals": "Los precios de lista no incluyen envío, impuestos ni aranceles.", "noteTotals": "Los totales son estimaciones para una raqueta. Las reglas de envío vienen de cada tienda; el impuesto es un promedio aproximado por estado; el arancel de pedidos desde Canadá es una estimación aproximada.",
 "loadFail": "No se pudieron cargar los precios. Actualiza la página en un momento.", "loading": "Cargando precios…",
 "fromCA": "Envía desde Canadá", "total": "≈ {t} en total", "ship": "envío", "freeShip": "envío gratis", "tax": "impuestos", "tariff": "arancel (est.)", "est": "estimado",
 "unknownShip": "Envío a Canadá no confirmado, solo precio de lista", "importTax": "más impuestos de importación en la entrega",
 "sHH": "Cabeza pesada", "sHL": "Cabeza ligera", "sEB": "Equilibrada", "sBeg": "Principiante", "sInt": "Intermedio", "sAdv": "Avanzado", "sPro": "Pro",
 "wlLead": "Premium aún no está abierto. Deja tu correo y te avisamos el día que salga. Sin pago por ahora.", "wlEmail": "Tu correo", "wlBtn": "Avísame", "wlThanks": "¡Gracias! Te escribiremos cuando premium esté listo.", "wlErr": "Algo salió mal. Inténtalo de nuevo.",
}

FR = {
 "tagline": "Les prix des raquettes de badminton dans plusieurs boutiques, surveillés pour vous.",
 "free": "Offre gratuite", "preview": "Aperçu premium", "previewSw": "Voir le premium",
 "watchlist": "Votre liste de suivi", "slots": "{n} sur {m} places", "watching": "{n} suivies",
 "subFree": "Prix vérifiés tous les 3 jours. Pas d'alertes en offre gratuite.", "subPrem": "Prix vérifiés toutes les heures. Alertes activées.",
 "openSlot": "Place libre. Touchez Suivre sur une raquette pour l'ajouter.", "emptyPrem": "Rien ici pour l'instant. Touchez Suivre sur une raquette pour l'ajouter.",
 "premium": "Premium", "p1": "Suivez autant de raquettes que vous voulez", "p2": "E-mail ou SMS quand un prix baisse", "p3": "Prix vérifiés toutes les heures", "p4": "Historique complet des prix de chaque raquette", "p5": "Plus de boutiques, et ajoutez les vôtres",
 "find": "Trouver une raquette", "search": "Rechercher par nom, comme Auraspeed", "all": "Toutes",
 "sMost": "Le plus de boutiques comparées", "sLow": "Prix le plus bas d'abord", "sHigh": "Prix le plus haut d'abord", "sOff": "Plus forte remise",
 "gloss": "Que signifient 4U, G5 et tête lourde ?", "g4u": "Une raquette plus légère, d'environ 80 à 84 grammes.", "gg5": "Un manche plus fin. Convient aux petites mains ou à ceux qui jouent avec le poignet.", "ghh": "Plus de poids vers le haut. Frappe plus fort, un peu plus lent à manier.", "ghl": "Plus de poids vers le manche. Plus rapide à manier.", "tipEB": "Le poids est réparti également entre la tête et le manche.",
 "country": "Pays", "region": "État", "regionCA": "Province", "pick": "Choisir…", "lang": "Langue",
 "hint": "Choisissez votre {r} pour voir les totaux estimés avec livraison, taxes et droits de douane.", "hintAKHI": "La livraison en Alaska et à Hawaï est différente, donc seuls les prix affichés sont montrés.",
 "rackets": "{n} raquettes", "racket1": "1 raquette", "more": "Afficher plus de raquettes ({n} restantes)", "none": "Aucune raquette ne correspond. Essayez un nom plus court.",
 "watch": "Suivre", "watchingBtn": "Suivie", "remove": "Retirer", "view": "Voir chez {s}", "lowest": "Le moins cher", "out": "Rupture de stock", "outAll": "En rupture dans toutes les boutiques",
 "at": "chez {s}", "lockedHist": "L'historique des prix et les alertes sont réservés au premium.", "alertBelow": "Prévenez-moi sous", "hit": "Objectif atteint", "alertsOn": "Alertes e-mail et SMS activées",
 "limit1": "L'offre gratuite garde 3 raquettes. Retirez-en une, ou essayez le premium sans limite.", "limit2": "L'offre gratuite garde 3 raquettes. Retirez-en une d'abord, ou essayez le premium.", "limit3": "L'offre gratuite garde vos 3 premières.",
 "realHist": "Historique réel depuis le {d}", "lowHigh": "Min. {l}, max. {h}", "histStart": "L'historique commence aujourd'hui. Revenez après la prochaine mise à jour.",
 "updated": "Prix mis à jour le {d}.", "comparing": "Comparaison : {s}.", "noteNoTotals": "Les prix affichés n'incluent pas la livraison, les taxes ni les droits de douane.", "noteTotals": "Les totaux sont des estimations pour une raquette. Les règles de livraison viennent de chaque boutique ; la taxe est une moyenne approximative par État ; les droits sur les commandes canadiennes sont une estimation grossière.",
 "loadFail": "Impossible de charger les prix. Actualisez la page dans un instant.", "loading": "Chargement des prix…",
 "fromCA": "Expédié du Canada", "total": "≈ {t} au total", "ship": "livraison", "freeShip": "livraison gratuite", "tax": "taxes", "tariff": "droits (est.)", "est": "estimation",
 "unknownShip": "Livraison au Canada non confirmée, prix affiché seulement", "importTax": "plus taxes d'importation à la livraison",
 "sHH": "Tête lourde", "sHL": "Tête légère", "sEB": "Équilibrée", "sBeg": "Débutant", "sInt": "Intermédiaire", "sAdv": "Avancé", "sPro": "Pro",
 "wlLead": "Le premium n'est pas encore ouvert. Laissez votre e-mail et nous vous prévenons le jour du lancement. Aucun paiement pour l'instant.", "wlEmail": "Votre e-mail", "wlBtn": "Me prévenir", "wlThanks": "Merci ! Nous vous écrirons au lancement du premium.", "wlErr": "Une erreur s'est produite. Veuillez réessayer.",
}

ID = {
 "tagline": "Harga raket bulu tangkis di berbagai toko, dipantau untukmu.",
 "free": "Paket gratis", "preview": "Pratinjau premium", "previewSw": "Lihat premium",
 "watchlist": "Daftar pantauan", "slots": "{n} dari {m} slot", "watching": "{n} dipantau",
 "subFree": "Harga dicek tiap 3 hari. Paket gratis tanpa peringatan.", "subPrem": "Harga dicek tiap jam. Peringatan aktif.",
 "openSlot": "Slot kosong. Ketuk Pantau pada raket mana pun untuk menambahkan.", "emptyPrem": "Belum ada apa-apa. Ketuk Pantau pada raket untuk menambahkan.",
 "premium": "Premium", "p1": "Pantau raket sebanyak yang kamu mau", "p2": "Email atau SMS saat harga turun", "p3": "Harga dicek tiap jam", "p4": "Riwayat harga lengkap tiap raket", "p5": "Lebih banyak toko, dan tambahkan tokomu sendiri",
 "find": "Cari raket", "search": "Cari nama, misalnya Auraspeed", "all": "Semua",
 "sMost": "Paling banyak toko dibandingkan", "sLow": "Harga terendah dulu", "sHigh": "Harga tertinggi dulu", "sOff": "Diskon terbesar",
 "gloss": "Apa arti 4U, G5, dan head heavy?", "g4u": "Raket lebih ringan, sekitar 80 sampai 84 gram.", "gg5": "Gagang lebih kecil. Cocok untuk tangan kecil atau pemain yang suka main dengan pergelangan.", "ghh": "Beban lebih ke atas. Pukulan lebih keras, ayunan agak lebih lambat.", "ghl": "Beban lebih ke gagang. Ayunan lebih cepat.", "tipEB": "Beban terbagi rata antara kepala dan gagang.",
 "country": "Negara", "region": "Negara bagian", "regionCA": "Provinsi", "pick": "Pilih…", "lang": "Bahasa",
 "hint": "Pilih {r} kamu untuk melihat perkiraan total dengan ongkir, pajak, dan tarif.", "hintAKHI": "Ongkir ke Alaska dan Hawaii berbeda, jadi hanya harga tertera yang ditampilkan.",
 "rackets": "{n} raket", "racket1": "1 raket", "more": "Tampilkan lebih banyak raket (sisa {n})", "none": "Tidak ada raket yang cocok. Coba nama yang lebih pendek.",
 "watch": "Pantau", "watchingBtn": "Dipantau", "remove": "Hapus", "view": "Lihat di {s}", "lowest": "Termurah", "out": "Stok habis", "outAll": "Stok habis di semua toko saat ini",
 "at": "di {s}", "lockedHist": "Riwayat harga dan peringatan ada di premium.", "alertBelow": "Kabari saya jika di bawah", "hit": "Target tercapai", "alertsOn": "Peringatan email dan SMS aktif",
 "limit1": "Paket gratis menyimpan 3 raket. Hapus satu, atau coba premium tanpa batas.", "limit2": "Paket gratis menyimpan 3 raket. Hapus satu dulu dari daftar, atau coba premium.", "limit3": "Paket gratis menyimpan 3 pantauan pertamamu.",
 "realHist": "Riwayat nyata sejak {d}", "lowHigh": "Terendah {l}, tertinggi {h}", "histStart": "Riwayat mulai terkumpul dari hari ini. Cek lagi setelah pembaruan berikutnya.",
 "updated": "Harga diperbarui {d}.", "comparing": "Membandingkan {s}.", "noteNoTotals": "Harga tertera belum termasuk ongkir, pajak, dan tarif.", "noteTotals": "Total adalah perkiraan untuk satu raket. Aturan ongkir dari tiap toko; pajak penjualan adalah rata-rata kasar per negara bagian; tarif untuk pesanan dari Kanada hanya tebakan kasar.",
 "loadFail": "Harga belum bisa dimuat. Muat ulang sebentar lagi.", "loading": "Memuat harga…",
 "fromCA": "Dikirim dari Kanada", "total": "≈ {t} total", "ship": "ongkir", "freeShip": "gratis ongkir", "tax": "pajak", "tariff": "tarif (perkiraan)", "est": "perkiraan",
 "unknownShip": "Pengiriman ke Kanada belum pasti, hanya harga tertera", "importTax": "ditambah pajak impor saat barang tiba",
 "sHH": "Head Heavy", "sHL": "Head Light", "sEB": "Seimbang", "sBeg": "Pemula", "sInt": "Menengah", "sAdv": "Lanjutan", "sPro": "Pro",
 "wlLead": "Premium belum dibuka. Tinggalkan emailmu dan kami kabari saat rilis. Belum ada pembayaran.", "wlEmail": "Emailmu", "wlBtn": "Kabari saya", "wlThanks": "Terima kasih! Kami akan mengirim email saat premium rilis.", "wlErr": "Terjadi kesalahan. Silakan coba lagi.",
}

MS = {
 "tagline": "Harga raket badminton di pelbagai kedai, dipantau untuk anda.",
 "free": "Pelan percuma", "preview": "Pratonton premium", "previewSw": "Lihat premium",
 "watchlist": "Senarai pantauan", "slots": "{n} daripada {m} slot", "watching": "{n} dipantau",
 "subFree": "Harga disemak setiap 3 hari. Pelan percuma tiada amaran.", "subPrem": "Harga disemak setiap jam. Amaran dihidupkan.",
 "openSlot": "Slot kosong. Tekan Pantau pada mana-mana raket untuk menambah.", "emptyPrem": "Belum ada apa-apa. Tekan Pantau pada raket untuk menambah.",
 "premium": "Premium", "p1": "Pantau seberapa banyak raket yang anda mahu", "p2": "E-mel atau SMS apabila harga turun", "p3": "Harga disemak setiap jam", "p4": "Sejarah harga penuh bagi setiap raket", "p5": "Lebih banyak kedai, dan tambah kedai anda sendiri",
 "find": "Cari raket", "search": "Cari mengikut nama, seperti Auraspeed", "all": "Semua",
 "sMost": "Paling banyak kedai dibandingkan", "sLow": "Harga terendah dahulu", "sHigh": "Harga tertinggi dahulu", "sOff": "Diskaun terbesar",
 "gloss": "Apakah maksud 4U, G5 dan head heavy?", "g4u": "Raket yang lebih ringan, kira-kira 80 hingga 84 gram.", "gg5": "Saiz pemegang lebih kecil. Sesuai untuk tangan kecil atau pemain yang suka main dengan pergelangan tangan.", "ghh": "Berat lebih ke atas. Pukulan lebih kuat, ayunan agak perlahan.", "ghl": "Berat lebih ke pemegang. Ayunan lebih laju.", "tipEB": "Berat dibahagi sama rata antara kepala dan pemegang.",
 "country": "Negara", "region": "Negeri", "regionCA": "Wilayah", "pick": "Pilih…", "lang": "Bahasa",
 "hint": "Pilih {r} anda untuk melihat anggaran jumlah termasuk penghantaran, cukai dan tarif.", "hintAKHI": "Penghantaran ke Alaska dan Hawaii berbeza, jadi hanya harga tersenarai dipaparkan.",
 "rackets": "{n} raket", "racket1": "1 raket", "more": "Papar lebih banyak raket ({n} lagi)", "none": "Tiada raket sepadan dengan carian itu. Cuba nama yang lebih pendek.",
 "watch": "Pantau", "watchingBtn": "Dipantau", "remove": "Buang", "view": "Lihat di {s}", "lowest": "Termurah", "out": "Kehabisan stok", "outAll": "Kehabisan stok di semua kedai sekarang",
 "at": "di {s}", "lockedHist": "Sejarah harga dan amaran ada dalam premium.", "alertBelow": "Beritahu saya jika bawah", "hit": "Sasaran dicapai", "alertsOn": "Amaran e-mel dan SMS dihidupkan",
 "limit1": "Pelan percuma menyimpan 3 raket. Buang satu, atau cuba premium tanpa had.", "limit2": "Pelan percuma menyimpan 3 raket. Buang satu dahulu dari senarai, atau cuba premium.", "limit3": "Pelan percuma menyimpan 3 pantauan pertama anda.",
 "realHist": "Sejarah sebenar sejak {d}", "lowHigh": "Terendah {l}, tertinggi {h}", "histStart": "Sejarah mula dikumpul dari hari ini. Semak semula selepas kemas kini seterusnya.",
 "updated": "Harga dikemas kini pada {d}.", "comparing": "Membandingkan {s}.", "noteNoTotals": "Harga tersenarai belum termasuk penghantaran, cukai dan tarif.", "noteTotals": "Jumlah ialah anggaran untuk satu raket. Peraturan penghantaran daripada setiap kedai; cukai jualan ialah purata kasar negeri; tarif untuk pesanan dari Kanada hanyalah tekaan kasar.",
 "loadFail": "Harga tidak dapat dimuatkan sekarang. Sila muat semula sebentar lagi.", "loading": "Memuatkan harga…",
 "fromCA": "Dihantar dari Kanada", "total": "≈ {t} jumlah", "ship": "penghantaran", "freeShip": "penghantaran percuma", "tax": "cukai", "tariff": "tarif (anggaran)", "est": "anggaran",
 "unknownShip": "Penghantaran ke Kanada belum pasti, harga tersenarai sahaja", "importTax": "serta cukai import semasa penghantaran",
 "sHH": "Head Heavy", "sHL": "Head Light", "sEB": "Seimbang", "sBeg": "Pemula", "sInt": "Pertengahan", "sAdv": "Mahir", "sPro": "Pro",
 "wlLead": "Premium belum dibuka. Tinggalkan e-mel anda dan kami akan maklumkan pada hari pelancaran. Tiada bayaran sekarang.", "wlEmail": "E-mel anda", "wlBtn": "Maklumkan saya", "wlThanks": "Terima kasih! Kami akan e-mel apabila premium dilancarkan.", "wlErr": "Sesuatu tidak kena. Sila cuba lagi.",
}

JA = {
 "tagline": "バドミントンラケットの価格を、複数のショップでまとめてチェック。",
 "free": "無料プラン", "preview": "プレミアム体験", "previewSw": "プレミアムを試す",
 "watchlist": "ウォッチリスト", "slots": "{m}枠中{n}枠", "watching": "{n}件ウォッチ中",
 "subFree": "価格は3日ごとに確認。無料プランには通知がありません。", "subPrem": "価格は1時間ごとに確認。通知はオンです。",
 "openSlot": "空き枠です。ラケットの「ウォッチ」を押すとここに追加されます。", "emptyPrem": "まだありません。ラケットの「ウォッチ」を押して追加しましょう。",
 "premium": "プレミアム", "p1": "ラケットを何本でもウォッチ", "p2": "値下がりをメールやSMSでお知らせ", "p3": "価格を1時間ごとに確認", "p4": "全ラケットの価格履歴", "p5": "対応ショップが増え、自分で追加も可能",
 "find": "ラケットを探す", "search": "名前で検索（例：Auraspeed）", "all": "すべて",
 "sMost": "比較ショップ数が多い順", "sLow": "価格が安い順", "sHigh": "価格が高い順", "sOff": "割引が大きい順",
 "gloss": "4U、G5、ヘッドヘビーとは？", "g4u": "軽めのラケットで、約80〜84グラムです。", "gg5": "グリップが細め。手が小さい人や手首を使うプレーヤー向きです。", "ghh": "重さが先端寄り。強く打てますが、振りはやや遅めです。", "ghl": "重さが手元寄り。振りやすく速く振れます。", "tipEB": "ヘッドと手元に重さが均等に分かれています。",
 "country": "国", "region": "州", "regionCA": "州・準州", "pick": "選択…", "lang": "言語",
 "hint": "{r}を選ぶと、送料・税・関税込みの概算合計が表示されます。", "hintAKHI": "アラスカとハワイは送料が異なるため、表示価格のみ表示します。",
 "rackets": "{n}本のラケット", "racket1": "1本のラケット", "more": "さらに表示（残り{n}本）", "none": "該当するラケットがありません。短い名前でお試しください。",
 "watch": "ウォッチ", "watchingBtn": "ウォッチ中", "remove": "削除", "view": "{s}で見る", "lowest": "最安", "out": "在庫なし", "outAll": "現在すべてのショップで在庫なし",
 "at": "{s}", "lockedHist": "価格履歴と通知はプレミアムで利用できます。", "alertBelow": "この価格以下で通知", "hit": "目標達成", "alertsOn": "メール・SMS通知オン",
 "limit1": "無料プランは3本まで。1本削除するか、プレミアムで上限なしを試してください。", "limit2": "無料プランは3本まで。先にウォッチリストから1本削除するか、プレミアムをお試しください。", "limit3": "無料プランでは最初の3本が残ります。",
 "realHist": "{d}からの実際の履歴", "lowHigh": "最安 {l}、最高 {h}", "histStart": "履歴は今日から蓄積されます。次回の更新後にご確認ください。",
 "updated": "価格は{d}に更新。", "comparing": "比較対象：{s}。", "noteNoTotals": "表示価格には送料・税・関税が含まれません。", "noteTotals": "合計はラケット1本の概算です。送料は各ショップの規定、売上税は州の大まかな平均、カナダ発送の関税はおおよその目安です。",
 "loadFail": "価格を読み込めませんでした。少し待ってから再読み込みしてください。", "loading": "価格を読み込み中…",
 "fromCA": "カナダから発送", "total": "合計 約{t}", "ship": "送料", "freeShip": "送料無料", "tax": "税", "tariff": "関税（概算）", "est": "概算",
 "unknownShip": "カナダへの送料は未確認のため、表示価格のみ", "importTax": "別途、受取時に輸入税",
 "sHH": "ヘッドヘビー", "sHL": "ヘッドライト", "sEB": "イーブン", "sBeg": "初心者", "sInt": "中級", "sAdv": "上級", "sPro": "プロ",
 "wlLead": "プレミアムはまだ開始していません。メールアドレスを残すと、開始日にお知らせします。現在お支払いは不要です。", "wlEmail": "メールアドレス", "wlBtn": "通知を希望", "wlThanks": "ありがとうございます。プレミアム開始時にメールします。", "wlErr": "エラーが発生しました。もう一度お試しください。",
}

KO = {
 "tagline": "여러 쇼핑몰의 배드민턴 라켓 가격을 대신 확인해 드려요.",
 "free": "무료 플랜", "preview": "프리미엄 미리보기", "previewSw": "프리미엄 미리보기",
 "watchlist": "내 관심 목록", "slots": "{m}칸 중 {n}칸 사용", "watching": "{n}개 관심 중",
 "subFree": "가격은 3일마다 확인해요. 무료 플랜에는 알림이 없어요.", "subPrem": "가격은 1시간마다 확인해요. 알림이 켜져 있어요.",
 "openSlot": "빈 칸이에요. 아무 라켓의 ‘관심’을 누르면 여기에 담겨요.", "emptyPrem": "아직 아무것도 없어요. 라켓의 ‘관심’을 눌러 추가하세요.",
 "premium": "프리미엄", "p1": "라켓을 원하는 만큼 관심 등록", "p2": "가격이 내리면 이메일·문자로 알림", "p3": "가격을 1시간마다 확인", "p4": "모든 라켓의 전체 가격 기록", "p5": "더 많은 쇼핑몰, 직접 추가도 가능",
 "find": "라켓 찾기", "search": "이름으로 검색, 예: Auraspeed", "all": "전체",
 "sMost": "비교 쇼핑몰 많은 순", "sLow": "낮은 가격순", "sHigh": "높은 가격순", "sOff": "할인율 큰 순",
 "gloss": "4U, G5, 헤드 헤비가 무슨 뜻인가요?", "g4u": "가벼운 라켓으로, 약 80~84그램이에요.", "gg5": "더 가는 그립이에요. 손이 작거나 손목을 많이 쓰는 분께 좋아요.", "ghh": "무게가 위쪽에 쏠려 있어요. 더 강하게 치지만 휘두르기는 조금 느려요.", "ghl": "무게가 손잡이 쪽에 있어요. 더 빠르게 휘두를 수 있어요.", "tipEB": "무게가 헤드와 손잡이에 고르게 나뉘어 있어요.",
 "country": "국가", "region": "주", "regionCA": "주·준주", "pick": "선택…", "lang": "언어",
 "hint": "{r}을(를) 선택하면 배송비·세금·관세를 포함한 예상 총액을 볼 수 있어요.", "hintAKHI": "알래스카와 하와이는 배송비가 달라서 표시 가격만 보여드려요.",
 "rackets": "라켓 {n}개", "racket1": "라켓 1개", "more": "라켓 더 보기 ({n}개 남음)", "none": "검색과 맞는 라켓이 없어요. 더 짧은 이름으로 검색해 보세요.",
 "watch": "관심", "watchingBtn": "관심 중", "remove": "삭제", "view": "{s}에서 보기", "lowest": "최저가", "out": "품절", "outAll": "현재 모든 쇼핑몰에서 품절",
 "at": "{s}", "lockedHist": "가격 기록과 알림은 프리미엄에서 제공돼요.", "alertBelow": "이 가격 이하일 때 알림", "hit": "목표 달성", "alertsOn": "이메일·문자 알림 켜짐",
 "limit1": "무료 플랜은 3개까지예요. 하나를 삭제하거나, 프리미엄으로 무제한을 체험해 보세요.", "limit2": "무료 플랜은 3개까지예요. 먼저 관심 목록에서 하나를 삭제하거나 프리미엄을 체험해 보세요.", "limit3": "무료 플랜은 처음 3개만 유지해요.",
 "realHist": "{d}부터의 실제 기록", "lowHigh": "최저 {l}, 최고 {h}", "histStart": "기록은 오늘부터 쌓여요. 다음 업데이트 후에 다시 확인하세요.",
 "updated": "가격 업데이트: {d}.", "comparing": "비교 대상: {s}.", "noteNoTotals": "표시 가격에는 배송비, 세금, 관세가 포함되지 않아요.", "noteTotals": "총액은 라켓 1개 기준 예상치예요. 배송 규정은 각 쇼핑몰 기준, 판매세는 주별 대략적인 평균, 캐나다 주문의 관세는 대략적인 추정이에요.",
 "loadFail": "지금은 가격을 불러올 수 없어요. 잠시 후 새로고침해 주세요.", "loading": "가격 불러오는 중…",
 "fromCA": "캐나다에서 발송", "total": "총 약 {t}", "ship": "배송비", "freeShip": "무료 배송", "tax": "세금", "tariff": "관세(추정)", "est": "추정",
 "unknownShip": "캐나다 배송은 확인되지 않아 표시 가격만 보여요", "importTax": "수령 시 수입세 별도",
 "sHH": "헤드 헤비", "sHL": "헤드 라이트", "sEB": "이븐 밸런스", "sBeg": "초급", "sInt": "중급", "sAdv": "상급", "sPro": "프로",
 "wlLead": "프리미엄은 아직 열리지 않았어요. 이메일을 남기면 출시일에 알려 드려요. 지금은 결제가 없어요.", "wlEmail": "이메일", "wlBtn": "출시 알림 받기", "wlThanks": "감사합니다! 프리미엄이 출시되면 이메일을 보내 드릴게요.", "wlErr": "문제가 생겼어요. 다시 시도해 주세요.",
}

DA = {
 "tagline": "Priser på badmintonketsjere i flere butikker, tjekket for dig.",
 "free": "Gratis plan", "preview": "Premium-forhåndsvisning", "previewSw": "Prøv premium",
 "watchlist": "Din overvågningsliste", "slots": "{n} af {m} pladser", "watching": "Overvåger {n}",
 "subFree": "Priser tjekkes hver 3. dag. Ingen advarsler i den gratis plan.", "subPrem": "Priser tjekkes hver time. Advarsler er slået til.",
 "openSlot": "Ledig plads. Tryk Overvåg på en ketsjer for at tilføje den.", "emptyPrem": "Intet her endnu. Tryk Overvåg på en ketsjer for at tilføje den.",
 "premium": "Premium", "p1": "Overvåg lige så mange ketsjere, du vil", "p2": "E-mail eller sms, når en pris falder", "p3": "Priser tjekkes hver time", "p4": "Fuld prishistorik for hver ketsjer", "p5": "Flere butikker, og tilføj dine egne",
 "find": "Find en ketsjer", "search": "Søg på navn, fx Auraspeed", "all": "Alle",
 "sMost": "Flest butikker sammenlignet", "sLow": "Laveste pris først", "sHigh": "Højeste pris først", "sOff": "Største rabat",
 "gloss": "Hvad betyder 4U, G5 og hovedtung?", "g4u": "En lettere ketsjer på ca. 80 til 84 gram.", "gg5": "Et tyndere greb. Godt til små hænder eller spillere, der bruger håndleddet.", "ghh": "Mere vægt mod toppen. Slår hårdere, men er lidt langsommere at svinge.", "ghl": "Mere vægt mod håndtaget. Hurtigere at svinge.", "tipEB": "Vægten er fordelt jævnt mellem hoved og håndtag.",
 "country": "Land", "region": "Stat", "regionCA": "Provins", "pick": "Vælg…", "lang": "Sprog",
 "hint": "Vælg din {r} for at se anslåede totaler med fragt, moms og told.", "hintAKHI": "Fragt til Alaska og Hawaii er anderledes, så kun vejledende priser vises.",
 "rackets": "{n} ketsjere", "racket1": "1 ketsjer", "more": "Vis flere ketsjere ({n} tilbage)", "none": "Ingen ketsjere matcher søgningen. Prøv et kortere navn.",
 "watch": "Overvåg", "watchingBtn": "Overvåger", "remove": "Fjern", "view": "Se hos {s}", "lowest": "Billigst", "out": "Udsolgt", "outAll": "Udsolgt i alle butikker lige nu",
 "at": "hos {s}", "lockedHist": "Prishistorik og advarsler følger med premium.", "alertBelow": "Giv besked under", "hit": "Mål nået", "alertsOn": "E-mail- og sms-advarsler er slået til",
 "limit1": "Den gratis plan rummer 3 ketsjere. Fjern en, eller prøv premium uden grænse.", "limit2": "Den gratis plan rummer 3. Fjern først en fra din liste, eller prøv premium.", "limit3": "Den gratis plan beholder dine første 3.",
 "realHist": "Rigtig historik siden {d}", "lowHigh": "Lav {l}, høj {h}", "histStart": "Historikken begynder i dag. Kig forbi efter næste opdatering.",
 "updated": "Priser opdateret {d}.", "comparing": "Sammenligner {s}.", "noteNoTotals": "Viste priser er uden fragt, moms og told.", "noteTotals": "Totalerne er et skøn for én ketsjer. Fragtregler kommer fra hver butik; salgsafgift er et groft gennemsnit pr. stat; told på canadiske ordrer er et groft gæt.",
 "loadFail": "Priserne kunne ikke indlæses lige nu. Opdater siden om et øjeblik.", "loading": "Indlæser priser…",
 "fromCA": "Sendes fra Canada", "total": "≈ {t} i alt", "ship": "fragt", "freeShip": "gratis fragt", "tax": "afgift", "tariff": "told (skøn)", "est": "skøn",
 "unknownShip": "Fragt til Canada er ikke bekræftet, kun vist pris", "importTax": "plus importafgifter ved levering",
 "sHH": "Hovedtung", "sHL": "Hovedlet", "sEB": "Jævn balance", "sBeg": "Begynder", "sInt": "Øvet", "sAdv": "Avanceret", "sPro": "Pro",
 "wlLead": "Premium er ikke åbnet endnu. Skriv din e-mail, så giver vi besked på lanceringsdagen. Ingen betaling nu.", "wlEmail": "Din e-mail", "wlBtn": "Giv mig besked", "wlThanks": "Tak! Vi skriver til dig, når premium lanceres.", "wlErr": "Noget gik galt. Prøv igen.",
}

TH = {
 "tagline": "ราคาไม้แบดมินตันจากหลายร้าน ตรวจให้คุณแล้ว",
 "free": "แผนฟรี", "preview": "ตัวอย่างพรีเมียม", "previewSw": "ลองพรีเมียม",
 "watchlist": "รายการติดตามของคุณ", "slots": "{n} จาก {m} ช่อง", "watching": "ติดตาม {n} รายการ",
 "subFree": "ตรวจราคาทุก 3 วัน แผนฟรีไม่มีการแจ้งเตือน", "subPrem": "ตรวจราคาทุกชั่วโมง เปิดการแจ้งเตือนแล้ว",
 "openSlot": "ช่องว่าง กด “ติดตาม” ที่ไม้ตัวไหนก็ได้เพื่อเพิ่มที่นี่", "emptyPrem": "ยังไม่มีอะไร กด “ติดตาม” ที่ไม้เพื่อเพิ่ม",
 "premium": "พรีเมียม", "p1": "ติดตามไม้ได้ไม่จำกัด", "p2": "แจ้งทางอีเมลหรือ SMS เมื่อราคาลด", "p3": "ตรวจราคาทุกชั่วโมง", "p4": "ประวัติราคาเต็มของไม้ทุกตัว", "p5": "ร้านค้ามากขึ้น และเพิ่มร้านของคุณเองได้",
 "find": "ค้นหาไม้แบด", "search": "ค้นหาด้วยชื่อ เช่น Auraspeed", "all": "ทั้งหมด",
 "sMost": "เทียบหลายร้านที่สุด", "sLow": "ราคาต่ำสุดก่อน", "sHigh": "ราคาสูงสุดก่อน", "sOff": "ส่วนลดมากที่สุด",
 "gloss": "4U, G5 และ Head Heavy หมายถึงอะไร", "g4u": "ไม้ที่เบากว่า หนักประมาณ 80 ถึง 84 กรัม", "gg5": "ด้ามจับเล็กกว่า เหมาะกับคนมือเล็กหรือคนที่เล่นด้วยข้อมือ", "ghh": "น้ำหนักไปทางหัวไม้ ตีแรงกว่า แต่สวิงช้ากว่าเล็กน้อย", "ghl": "น้ำหนักไปทางด้าม สวิงเร็วกว่า", "tipEB": "น้ำหนักกระจายเท่ากันระหว่างหัวไม้และด้าม",
 "country": "ประเทศ", "region": "รัฐ", "regionCA": "จังหวัด", "pick": "เลือก…", "lang": "ภาษา",
 "hint": "เลือก{r}ของคุณ เพื่อดูราคารวมโดยประมาณพร้อมค่าส่ง ภาษี และภาษีนำเข้า", "hintAKHI": "ค่าส่งไปอะแลสกาและฮาวายต่างออกไป จึงแสดงเฉพาะราคาป้าย",
 "rackets": "{n} ไม้", "racket1": "1 ไม้", "more": "แสดงไม้เพิ่ม (เหลือ {n})", "none": "ไม่พบไม้ที่ตรงกับคำค้น ลองใช้ชื่อที่สั้นลง",
 "watch": "ติดตาม", "watchingBtn": "กำลังติดตาม", "remove": "ลบ", "view": "ดูที่ {s}", "lowest": "ถูกที่สุด", "out": "สินค้าหมด", "outAll": "ตอนนี้สินค้าหมดทุกร้าน",
 "at": "ที่ {s}", "lockedHist": "ประวัติราคาและการแจ้งเตือนมีในพรีเมียม", "alertBelow": "แจ้งเตือนเมื่อต่ำกว่า", "hit": "ถึงราคาเป้าหมาย", "alertsOn": "เปิดแจ้งเตือนอีเมลและ SMS",
 "limit1": "แผนฟรีเก็บได้ 3 ไม้ ลบออกหนึ่งตัว หรือลองพรีเมียมแบบไม่จำกัด", "limit2": "แผนฟรีเก็บได้ 3 ไม้ ลบออกจากรายการก่อน หรือลองพรีเมียม", "limit3": "แผนฟรีเก็บ 3 รายการแรกของคุณไว้",
 "realHist": "ประวัติจริงตั้งแต่ {d}", "lowHigh": "ต่ำสุด {l} สูงสุด {h}", "histStart": "ประวัติเริ่มสะสมตั้งแต่วันนี้ กลับมาดูหลังอัปเดตครั้งถัดไป",
 "updated": "อัปเดตราคาเมื่อ {d}", "comparing": "กำลังเทียบ: {s}", "noteNoTotals": "ราคาป้ายยังไม่รวมค่าส่ง ภาษี และภาษีนำเข้า", "noteTotals": "ราคารวมเป็นการประมาณสำหรับไม้ 1 ตัว กฎค่าส่งมาจากแต่ละร้าน ภาษีขายเป็นค่าเฉลี่ยคร่าว ๆ ของแต่ละรัฐ และภาษีนำเข้าของออเดอร์จากแคนาดาเป็นการคาดเดาคร่าว ๆ",
 "loadFail": "โหลดราคาไม่ได้ในขณะนี้ โปรดรีเฟรชอีกครั้ง", "loading": "กำลังโหลดราคา…",
 "fromCA": "ส่งจากแคนาดา", "total": "รวมประมาณ {t}", "ship": "ค่าส่ง", "freeShip": "ส่งฟรี", "tax": "ภาษี", "tariff": "ภาษีนำเข้า (ประมาณ)", "est": "ประมาณการ",
 "unknownShip": "ยังไม่ยืนยันค่าส่งไปแคนาดา แสดงเฉพาะราคาป้าย", "importTax": "บวกภาษีนำเข้าตอนรับของ",
 "sHH": "Head Heavy", "sHL": "Head Light", "sEB": "สมดุล", "sBeg": "มือใหม่", "sInt": "ระดับกลาง", "sAdv": "ระดับสูง", "sPro": "โปร",
 "wlLead": "พรีเมียมยังไม่เปิด ฝากอีเมลไว้ แล้วเราจะแจ้งในวันเปิดตัว ตอนนี้ยังไม่ต้องชำระเงิน", "wlEmail": "อีเมลของคุณ", "wlBtn": "แจ้งฉัน", "wlThanks": "ขอบคุณ! เราจะส่งอีเมลเมื่อพรีเมียมเปิดตัว", "wlErr": "เกิดข้อผิดพลาด โปรดลองอีกครั้ง",
}

# ---- Traditional Chinese: convert from Simplified with Taiwan wording, then fix known differences ----
_cc = OpenCC("s2twp")
def _tw(s):
    s = _cc.convert(s)
    return (s.replace("羽毛球拍", "羽球拍").replace("羽毛球", "羽球")
             .replace("信箱", "電子郵件").replace("郵箱", "電子郵件").replace("短信", "簡訊")
             .replace("發郵件", "寄電子郵件").replace("發電子郵件", "寄電子郵件"))
ZH_TW = {k: _tw(v) for k, v in ZH.items()}

LANGS = {  # code -> name written in its own language (flags are for countries, not languages)
 "en": "English", "zh": "简体中文", "zh-TW": "繁體中文", "hi": "हिन्दी", "es": "Español", "fr": "Français",
 "id": "Bahasa Indonesia", "ms": "Bahasa Melayu", "ja": "日本語", "ko": "한국어", "da": "Dansk", "th": "ไทย",
}
TEXT = {"en": EN, "zh": ZH, "zh-TW": ZH_TW, "hi": HI, "es": ES, "fr": FR, "id": ID, "ms": MS, "ja": JA, "ko": KO, "da": DA, "th": TH}

# ---- racket-line and brand names in Chinese (checked against Chinese shopping guides, Nov 2026) ----
LINES_ZH = [  # (English line, Simplified Chinese). Longer names first.
 ("Brave Sword", "亮剑"), ("Drive X", "驭"), ("DriveX", "驭"), ("Auraspeed", "神速"), ("Thruster", "突击"), ("Jetspeed", "极速"),
 ("Astrox", "天斧"), ("Nanoflare", "疾光"), ("Arcsaber", "弓箭"), ("Duora", "双刃"),
 ("Axforce", "雷霆"), ("Bladex", "锋影"), ("Aeronaut", "风动"), ("3D Calibar", "风刃"),
]
BRANDS_ZH = {"Yonex": "尤尼克斯", "Victor": "威克多", "Li-Ning": "李宁", "Kawasaki": "川崎", "Dunlop": "邓禄普", "Mizuno": "美津浓", "Gosen": "高神"}
BRANDS_TW = dict(BRANDS_ZH, **{"Yonex": "優乃克", "Victor": "勝利", "Li-Ning": "李寧", "Dunlop": "鄧祿普", "Mizuno": "美津濃", "Gosen": "高神", "Kawasaki": "川崎"})
NAMES = {
 "zh": {"lines": LINES_ZH, "brands": BRANDS_ZH},
 "zh-TW": {"lines": [(e, _cc.convert(c)) for e, c in LINES_ZH], "brands": BRANDS_TW},
}

js = ("/* Generated by tools/build_i18n.py. Edit that file, not this one. */\n"
      "window.RR_LANGS = " + json.dumps(LANGS, ensure_ascii=False) + ";\n"
      "window.RR_T = " + json.dumps(TEXT, ensure_ascii=False, separators=(",", ":")) + ";\n"
      "window.RR_NAMES = " + json.dumps(NAMES, ensure_ascii=False, separators=(",", ":")) + ";\n")
OUT.write_text(js, encoding="utf-8")

# sanity: every language has every key, and the same {placeholders} as English
bad = 0
for code, d in TEXT.items():
    miss = set(EN) - set(d)
    if miss: print(code, "MISSING", sorted(miss)); bad += 1
    for k, v in EN.items():
        a = sorted(re.findall(r"\{(\w)\}", v)); b = sorted(re.findall(r"\{(\w)\}", d.get(k, "")))
        if a != b: print(code, "PLACEHOLDER MISMATCH", k, a, b); bad += 1
print("languages:", len(TEXT), "| keys:", len(EN), "| problems:", bad, "| wrote", OUT, OUT.stat().st_size, "bytes")
