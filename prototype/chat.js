/* נגזר אוטומטית מ-index.html על ידי gen-bot.js. אל תערוך. */
/* sha1:3098655c3740c3e8 */
/* bot:js:start — מקור האמת של הצ'אט. gen-bot.js גוזר מכאן את chat.js שנטען ב-21 עמודי
   התוכן, ובדיקה 31 מוודאת שהשניים לא נפרדו. אל תערוך את chat.js ביד. */
(function(){
  var fab=document.getElementById('pgFab'), panel=document.getElementById('pgPanel');
  if(!fab||!panel) return;
  /* track מוגדר מחוץ ל-IIFE הזה, בדף הבית בלבד. כשהווידג'ט נגזר ל-chat.js ונטען בעמודי
     תוכן אחרים, הוא לא קיים שם, ולכן יש כאן נפילה לאחור לאותה מימוש בדיוק. בלעדיה כל
     קריאה ל-track בעמוד אחר הייתה זורקת, והצ'אט היה מת שם בשקט. */
  var track=(typeof window.track==='function')?window.track:function(ev,d){
    try{window.dataLayer=window.dataLayer||[];var o={event:ev};if(d)for(var k in d)o[k]=d[k];window.dataLayer.push(o);}catch(e){}
  };
  var msgs=document.getElementById('pgMsgs'), chipsWrap=document.getElementById('pgChips');
  var input=document.getElementById('pgInput'), sendBtn=document.getElementById('pgSend'), closeBtn=document.getElementById('pgClose');
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WA='https://wa.me/97286812050', TEL='tel:+972525893366', NAV='https://waze.com/ul?ll=31.60332,34.775553&navigate=yes';
  var opened=false, lastUser='', fails=0;
  var ctx={name:'',topic:'',device:'',issue:''}, flow=null;

  var waSvg='<img class="wa-ico" src="whatsapp-logo.png" alt="" width="22" height="22" decoding="async">';
  var telSvg='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4.5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1l-2.2 2.3Z"/></svg>';
  var navSvg='<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.2 8 12 8 12s8-6.8 8-12a8 8 0 0 0-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/></svg>';

  function greetWord(){var h=(new Date()).getHours();if(h>=5&&h<12)return 'בוקר טוב';if(h>=12&&h<16)return 'צהריים טובים';if(h>=16&&h<22)return 'ערב טוב';return 'שלום';}
  function openNow(){var d=new Date(),day=d.getDay(),h=d.getHours()+d.getMinutes()/60;if(day>=0&&day<=4)return h>=9&&h<18.5;if(day===5)return h>=9&&h<13;return false;}
  function hoursLine(){return openNow()?'אנחנו פתוחים עכשיו, אפשר לחייג ישירות:':'אנחנו סגורים כרגע. השאירו פרטים ונחזור אליכם, או שלחו WhatsApp:';}
  function contactCta(){return openNow()?['wa','tel']:['wa','callback'];}
  function track(ev,d){try{window.dataLayer=window.dataLayer||[];var o={event:ev};if(d)for(var k in d)o[k]=d[k];window.dataLayer.push(o);}catch(e){}}

  var LABELS={repair:'תיקון מכשיר',buy:'קניית מכשיר',celcom:'סלקום וקווים',hours:'שעות ומיקום',callback:'בקשת שיחה חוזרת',accessories:'אבזור וציוד',payments:'תשלומים',warranty:'אחריות',data:'העברת נתונים',offer:'ההטבה',gaming:'פלייסטיישן ומחשבים',tradein:'טרייד אין',business:'לקוחות עסקיים',price:'מחירים'};

  var INTENTS=[
    {id:'hours',c:1,k:['שעות','שעה','פתוח','פתוחים','סגור','מתי','כתובת','איפה','מיקום','להגיע','ניווט','נווט','מפה','וייז','חניה'],a:'אנחנו ברחבת תשרי 2, קרית גת (מול מכון מאר).\nפתוחים ראשון עד חמישי 9:00 עד 18:30, ושישי 9:00 עד 13:00.',cta:['nav','tel']},
    {id:'repair',c:1,k:['תיקון','לתקן','מתקן','מתקנים','מסך','סוללה','שבור','נשבר','נפל','נזק','מים','טעינה','שקע','רמקול','מצלמה','לא נדלק','לא עובד','תקוע'],a:''},
    {id:'buy',c:1,k:['לקנות','קניה','קנייה','לרכוש','מכשיר חדש','טלפון חדש','אייפון','סמסונג','שיאומי','גלקסי','דגם'],a:''},
    {id:'celcom',c:1,k:['סלקום','קו','קווים','סים','ניוד','מסלול','חבילה','חבילת','דקות','גלישה'],a:'פון גת הוא הסניף הראשון והיחיד של סלקום בקרית גת: פתיחת וניוד קו, החלפת סים ומסלולים, וגם שירות לכל חברות הסלולר.',cta:['tel','wa'],sug:['callback']},
    {id:'warranty',c:1,k:['אחריות','אחראי','ערבות','אחראים'],a:'כן. אנחנו נותנים אחריות בכתב על התיקונים שאנחנו מבצעים ועומדים מאחורי העבודה שלנו. על תיקוני נזקי נוזלים אין אחריות. לפרטים המדויקים לפי המכשיר, דברו איתנו.',cta:['wa'],sug:['repair']},
    {id:'data',c:1,k:['נתונים','גיבוי','אנשי קשר','תמונות','להעביר','העברת נתונים'],a:'אנחנו דואגים לשמור ולהעביר את הנתונים שלכם, אנשי קשר ותמונות, גם ממכשיר שבור וגם בקנייה של מכשיר חדש.',cta:['wa'],sug:['buy','repair']},
    {id:'offer',c:1,k:['מבצע','מבצעים','הטבה','מגן','זכוכית','מגן מסך'],a:'הטבה לקוראי האתר: מגן זכוכית מסך כולל הדבקה ב-9 ₪ (למעט מכשירים מעוגלים).\nובנוסף, רוכשי מכשיר חדש מקבלים העברת נתונים ללא עלות, גם אם הטלפון הישן שבור.',cta:['wa'],sug:['buy','accessories']},
    {id:'gaming',c:1,k:['פלייסטיישן','סוני','גיימינג','קונסולה','מחשב','מחשבים','לפטופ','בקר'],a:'בפלייסטיישן אנחנו מוכרים קונסולות סוני ומציעים אבזור גיימינג (תיקוני קונסולות איננו מבצעים). במחשבים אנחנו מסייעים בגיבוי והעברת נתונים (לא תיקוני חומרה).',cta:['wa','tel'],sug:['callback']},
    {id:'accessories',c:1,k:['אבזור','אביזר','כיסוי','כיסויים','מטען','כבל','אוזניות','ציוד לרכב','מטען לרכב','מעמד'],a:'יש לנו מבחר אבזור: כיסויים, מגני מסך, מטענים, כבלים, אוזניות וציוד לרכב. ספרו לנו לאיזה דגם ונכין לכם.',cta:['wa'],sug:['offer','buy']},
    {id:'payments',c:1,k:['תשלומים','אשראי','ביט','פריסה','פריסת','קרדיט'],a:'אפשר לרכוש מכשיר חדש בתשלומים. נשמח לפרט את האפשרויות המדויקות לפי הדגם, דברו איתנו.',cta:['wa','tel'],sug:['buy','callback']},
    {id:'tradein',c:1,k:['טרייד','טרייד אין','מכשיר ישן','זיכוי','להחליף מכשיר'],a:'אנחנו לא נותנים זיכוי על מכשיר ישן, אבל נשמח לעזור לכם לבחור מכשיר חדש בתשלומים נוחים, כולל העברת כל הנתונים מהמכשיר הישן, גם אם הוא שבור.',cta:['wa','callback'],sug:['buy','payments','data']},
    {id:'business',c:1,k:['עסק','עסקי','חשבונית','כמות','עוסק','חברה'],a:'אנחנו משרתים גם עסקים: מכשירים, קווים ואבזור בכמות, עם חשבונית. ספרו לנו על הצורך ונחזור עם הצעה.',cta:['callback','wa'],sug:['callback']},
    {id:'price',c:1,k:['כמה עולה','מחיר','מחירון','עולה','עלות','כמה זה','כמה יעלה'],a:'המחיר משתנה לפי המכשיר והשירות. נשמח לתת הצעה מהירה ומדויקת, בחרו נושא או השאירו פרטים:',cta:contactCta,sug:['repair','buy','callback']},
    {id:'human',c:1,k:['נציג','לדבר','בנאדם','אדם','ברוך','סיגל','להתקשר','מוקד','טלפון','לצלצל'],a:'אצלנו לא מדברים עם מוקד, מדברים ישירות עם ברוך וסיגל.',cta:contactCta,sug:['callback']},
    {id:'callback',c:1,k:['שיחה חוזרת','תחזרו','תתקשרו אלי','תתקשרו אליי','חזרו אליי','להשאיר פרטים','תשאירו לי'],a:''},
    {id:'greeting',c:0,k:['שלום','היי','אהלן','מה נשמע','מה קורה','בוקר טוב','ערב טוב','צהריים'],a:'! אני העוזר הדיגיטלי של פון גת. איך אפשר לעזור?',cta:[],sug:['repair','buy','callback']},
    {id:'thanks',c:0,k:['תודה','מעולה','סבבה','אחלה','יופי'],a:'בשמחה. אם צריך עוד משהו, אנחנו כאן.',cta:[]},
    {id:'bye',c:0,k:['ביי','להתראות','יום טוב','נתראה'],a:'תודה שפניתם לפון גת, נשמח לראותכם בחנות.',cta:[]}
  ];

  function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function stripNikud(s){return s.replace(/[֑-ׇ]/g,'');}
  function has(t,kw){return new RegExp('(^|[^א-ת])[בהלמוכש]{0,3}'+esc(kw)+(kw.length<=2?'(?=$|[^א-ת])':'')).test(t);}
  function matchIntent(text){
    var t=stripNikud(String(text)), best=null, bestLen=0, tiers=[1,0], ti, i, j;
    for(ti=0;ti<tiers.length;ti++){
      for(i=0;i<INTENTS.length;i++){
        if(INTENTS[i].c!==tiers[ti]) continue;
        for(j=0;j<INTENTS[i].k.length;j++){
          var kw=INTENTS[i].k[j];
          if(kw.length>bestLen && has(t,kw)){best=INTENTS[i];bestLen=kw.length;}
        }
      }
      if(best) return best;
    }
    return null;
  }
  function byId(id){for(var i=0;i<INTENTS.length;i++)if(INTENTS[i].id===id)return INTENTS[i];return null;}
  function digits(s){return (s||'').replace(/\D/g,'');}
  function validPhone(s){return /^0\d{8,9}$/.test(digits(s));}

  function nowT(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
  function dirOf(text){for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);if(c>=0x590&&c<=0x6FF)return 'rtl';if((c>=65&&c<=90)||(c>=97&&c<=122))return 'ltr';}return 'rtl';}
  function down(){msgs.scrollTop=msgs.scrollHeight;}
  function waHref(txt){return WA+'?text='+encodeURIComponent(txt||('היי, הגעתי דרך האתר של פון גת. '+(lastUser?('השאלה שלי: '+lastUser):'רציתי לשאול שאלה.')));}
  function ctaEl(type,waText){
    if(type==='callback'){var btn=document.createElement('button');btn.type='button';btn.className='tel';btn.innerHTML=telSvg+'שיחה חוזרת';btn.addEventListener('click',function(){startLead(ctx.topic||'כללי');});return btn;}
    var a=document.createElement('a');a.target='_blank';a.rel='noopener';
    if(type==='wa'){a.className='wa';a.href=waHref(waText);a.innerHTML=waSvg+'WhatsApp';a.addEventListener('click',function(){track('chat_whatsapp',{topic:ctx.topic||''});});}
    else if(type==='tel'){a.className='tel';a.href=TEL;a.innerHTML=telSvg+'חייגו';a.addEventListener('click',function(){track('chat_call',{});});}
    else{a.className='tel';a.href=NAV;a.innerHTML=navSvg+'ניווט';}
    return a;
  }
  function bubble(text,who,cta,waText){
    /* הודעה של המשתמש מסיימת את שלב ההצעות, ולכן סרגל הנושאים חוזר לגובה מלא. אם התשובה
       הבאה של הבוט תישא הצעות, suggestChips יכווץ אותו שוב. נמצא כאן ולא במטפל הצ'יפים
       כדי שגם הקלדה חופשית תשחרר אותו, ולא רק לחיצה. */
    if(who==='user'&&panel)panel.classList.remove('sug-on');
    var b=document.createElement('div');b.className='pg-b '+(who==='user'?'pg-user':'pg-bot');
    var d=dirOf(text);b.style.direction=d;b.style.textAlign=(d==='rtl'?'right':'left');
    var s=document.createElement('span');s.textContent=text;b.appendChild(s);
    if(cta&&cta.length){var box=document.createElement('div');box.className='pg-cta';for(var i=0;i<cta.length;i++)box.appendChild(ctaEl(cta[i],waText));b.appendChild(box);}
    var t=document.createElement('span');t.className='t';t.textContent=nowT();b.appendChild(t);
    msgs.appendChild(b);down();
  }
  function suggestChips(items){
    var barLabels=CHIPS.map(function(id){return LABELS[id]||id;});
    var list=[];
    for(var i=0;i<items.length;i++){var itm=items[i],lbl=(typeof itm==='string')?(LABELS[itm]||itm):itm[0];if(barLabels.indexOf(lbl)<0)list.push(itm);}
    if(!list.length)return;
    var box=document.createElement('div');box.className='pg-sug';
    for(var j=0;j<list.length;j++){(function(it){
      var label,fn;
      if(typeof it==='string'){label=LABELS[it]||it;fn=(function(id){return function(){doTopic(id);};})(it);}
      else{label=it[0];fn=it[1];}
      var b=document.createElement('button');b.type='button';b.className='pg-chip';b.textContent=label;
      b.addEventListener('click',function(){lastUser=label;bubble(label,'user');fn();focusInput();});
      box.appendChild(b);
    })(list[j]);}
    msgs.appendChild(box);down();
    if(panel)panel.classList.add('sug-on');
  }
  function botReply(text,opts){
    opts=opts||{};
    function done(){bubble(text,'bot',opts.cta,opts.waText);if(opts.sug&&opts.sug.length)suggestChips(opts.sug);}
    if(reduce){done();return;}
    var tp=document.createElement('div');tp.className='pg-typing';tp.setAttribute('aria-hidden','true');tp.innerHTML='<i></i><i></i><i></i>';
    msgs.appendChild(tp);down();
    setTimeout(function(){if(tp.parentNode)tp.parentNode.removeChild(tp);done();},650);
  }

  function respond(it){
    if(it.id==='repair'){startRepair();return;}
    if(it.id==='buy'){startBuy();return;}
    if(it.id==='callback'){startLead('כללי');return;}
    fails=0;ctx.topic=it.id;
    var text=(it.id==='greeting'?greetWord():'')+it.a;
    if(it.id==='hours')text=it.a+(openNow()?'\nאנחנו פתוחים עכשיו.':'\nכרגע אנחנו סגורים.');
    if(it.id==='human')text=it.a+'\n'+hoursLine();
    var cta=typeof it.cta==='function'?it.cta():it.cta;
    botReply(text,{cta:cta,sug:it.sug});
    track('chat_intent',{intent:it.id});
  }
  function runIntent(id){var it=byId(id);if(it)respond(it);}
  function doTopic(id){if(id==='repair')startRepair();else if(id==='buy')startBuy();else if(id==='callback')startLead('כללי');else runIntent(id);}
  function mainMenu(){flow=null;botReply('במה עוד אפשר לעזור?',{sug:['repair','buy','celcom','hours','callback']});}

  function startRepair(){flow={type:'repair',step:'device'};ctx.topic='repair';track('chat_flow',{flow:'repair'});botReply('בשמחה נעזור לתקן. איזה מכשיר צריך טיפול?',{sug:[['אייפון',function(){repDevice('אייפון');}],['סמסונג',function(){repDevice('סמסונג');}],['שיאומי',function(){repDevice('שיאומי');}],['מכשיר אחר',function(){repDevice('המכשיר');}]]});}
  function repDevice(dev){ctx.device=dev;flow={type:'repair',step:'issue'};botReply('מה קרה ל'+dev+'?',{sug:[['מסך שבור',function(){repIssue('מסך שבור');}],['בעיית סוללה',function(){repIssue('בעיית סוללה');}],['נפל למים',function(){repIssue('נזק מים');}],['לא נטען',function(){repIssue('בעיית טעינה');}],['תקלה אחרת',function(){repIssue('תקלה');}]]});}
  function repIssue(iss){ctx.issue=iss;flow=null;ctx.topic='תיקון '+iss+' '+ctx.device;track('chat_repair',{device:ctx.device,issue:iss});var wt='היי, הגעתי דרך האתר. אשמח להצעת מחיר לתיקון: '+iss+' ב'+ctx.device+'.';botReply(ctx.device+' עם '+iss+', בול בתחום שלנו. מעבדה וותיקה מעל 30 שנה, עם אחריות. המחיר תלוי בדגם המדויק, אז נשמח לתת הצעה מהירה ומדויקת.\n'+hoursLine(),{cta:contactCta(),waText:wt,sug:[['בקשת שיחה חוזרת',function(){startLead(ctx.topic);}],['שאלה אחרת',function(){mainMenu();}]]});}

  /* bot:facts:start — נתוני הקטלוג לבוט.
     קדם לזה BUY_MODELS, רשימה קשיחה שלא הייתה מחוברת לקטלוג. היא הציעה "Galaxy Z מתקפל"
     ואין מתקפל באף אחד מ-24 הדגמים במאגר, כלומר הבוט הציע קטגוריה שאין לה שום כיסוי.
     כאן הכל נגזר מ-bot-facts.json, ולכן קטגוריה ריקה לא מוצגת מעצם הבנייה.

     נטען רק כשהפאנל נפתח בפעם הראשונה ולא בטעינת העמוד: הבוט הוא ווידג'ט משני בדף הבית.
     FACTS נשאר null עד שהטעינה הצליחה, ואם היא נכשלת הבוט **מדלג על שלב הדגם ולא מנחש**.
     זה אותו כלל של שדה null: לא לנחש, לנתב. */
  var FACTS=null,factsState='idle';
  function loadFacts(){
    if(factsState!=='idle')return;
    factsState='loading';
    try{
      fetch('/bot-facts.json').then(function(r){return r.ok?r.json():null;}).then(function(j){
        if(j&&j.devices&&j.devices.length){FACTS=j;factsState='ready';}else{factsState='failed';}
      })['catch'](function(){factsState='failed';});
    }catch(e){factsState='failed';}
  }
  function soldByBrand(en){
    if(!FACTS)return [];
    return FACTS.devices.filter(function(d){return d.kind==='sold'&&d.brand===en;});
  }
  function factsBySlug(slug){
    if(!FACTS||!slug)return null;
    for(var i=0;i<FACTS.devices.length;i++)if(FACTS.devices[i].slug===slug)return FACTS.devices[i];
    return null;
  }
  /* הקטגוריה מנורמלת כאן ולא נלקחת משדה series, כי series בקטלוג אינו עקבי:
     Galaxy S26 Ultra ו-Galaxy S26+ יושבים תחת "Galaxy S", אבל Galaxy S26 תחת סדרה משלו.
     תפריט שנגזר ממנו ישירות היה מציג "Galaxy S" ו-"Galaxy S26" כשתי אפשרויות אחיות. */
  function buyCat(d){
    if(d.brand==='Samsung')return /^Galaxy A/.test(d.name)?'Galaxy A':'Galaxy S';
    if(d.brand==='Xiaomi')return /^Redmi/.test(d.name)?'רדמי נוט':'שיאומי';
    return /Pro/.test(d.name)?'פרו ופרו מקס':'רגיל';
  }
  var BUY_BRANDS=[['אייפון','Apple'],['סמסונג','Samsung'],['שיאומי','Xiaomi']];
  /* שלב הקטגוריה נכנס רק ליצרן עם יותר מכך דגמים. אפל ושיאומי חמישה כל אחד ונכנסים
     כצ'יפים ישר, סמסונג 11 ובלי פיצול הרשימה בלתי קריאה. */
  var BUY_SPLIT=6;
  /* התווית מקוצרת בצ'יפי דגם: היצרן והסדרה כבר נבחרו בשלב הקודם באותה שיחה, ולכן המילה
     "גלקסי" רק חוזרת. נמדד בדפדפן: "גלקסי A56" הוא 83px ו-"A56" הוא 48px, כלומר חמישה
     בשורה במקום שלושה, ושורה שלמה פחות. */
  var SHORT_PREFIX=['רדמי נוט','גלקסי','אייפון','שיאומי','רדמי','גוגל','וואן פלוס','נאת׳ינג פון'];
  function shortModel(he){
    for(var i=0;i<SHORT_PREFIX.length;i++)if(he.indexOf(SHORT_PREFIX[i]+' ')===0)return he.slice(SHORT_PREFIX[i].length+1);
    return he;
  }
  /* אין במאגר שום אות דירוג: launch_year ריק ב-24 מ-24, dates הוא null, ו-stock מלא
     ב-12 בלבד ולכן מחוץ לקובץ בכוונה. לכן הסדר נגזר ממספר הדגם שבשם, יורד. זה
     דטרמיניסטי, ולא ישתנה בשקט כשמישהו יסדר מחדש את devices.json.
     אם תגיע רשימה מפורשת של חמישה מובילים, מחליפים את הפונקציה הזאת ולא יותר. */
  function modelRank(d){var m=String(d.name).match(/\d+/);return m?parseInt(m[0],10):0;}
  var BUY_SHOW=5,moreSeq=0;
  /* bot:facts:end */

  /* bot:answers:start — תשובות על דגם מתוך bot-facts.json.
     כל הערכים מצוטטים מילה במילה מהשדה. אין ניסוח מחדש ואין ברירת מחדל סבירה-לשמע, כי
     "אחריות סטנדרטית 12 חודשים" שנכתב כדי למנוע מבוי סתום הופך להבטחה של המותג בלי בקרת
     אדם. שדה null מנתב לאדם, נקודה. */
  function normDev(s){return String(s).toLowerCase().replace(/[־–_-]/g,' ').replace(/\s+/g,' ').trim();}
  /* טוקן דגם נכלל רק אם יש בו ספרה **וגם** אות, עברית או לטינית: a56, s26 ultra, 17e,
     "פיקסל 10", "17 פרו". מספר עירום כמו "17" נדחה, כי הוא מתאים לחצי הקטלוג וניחוש הוא
     בדיוק מה שאסור. דרישת אות לטינית בלבד הייתה מפילה "פיקסל 10", שהיא הצורה שבה אנשים
     כותבים בעברית. */
  function devTokens(d){
    var full=normDev(d.name_he),en=normDev(d.name),sl=normDev(d.slug);
    var t=[full,en,sl];
    function ok(x){return x&&/\d/.test(x)&&/[a-z֐-׿]/.test(x);}
    var i,m;
    for(i=0;i<SHORT_PREFIX.length;i++){
      m=full.indexOf(normDev(SHORT_PREFIX[i])+' ')===0?full.slice(normDev(SHORT_PREFIX[i]).length+1):'';
      if(ok(m)){t.push(m);break;}
    }
    var me=en.replace(/^(galaxy|iphone|redmi note|redmi|xiaomi|google|oneplus|nothing phone)\s+/,'');
    if(me!==en&&ok(me))t.push(me);
    return t.filter(function(x,j,a){return x&&a.indexOf(x)===j;});
  }
  /* chat_device_unmatched קיים כדי למדוד ביקוש לדגמים שאיננו מחזיקים, ולכן הוא חייב לדעת
     **איזה** דגם, ומונה בלבד היה חסר טעם. אבל אנשים מקלידים לצ'אט "קוראים לי דוד
     0501234567, המסך שבור", ושליחת טקסט גולמי ל-GA4 היא בדיוק מה שתוקן ב-fallback:
     privacy.html §3 מבטיח מידע סטטיסטי בלבד, ושאלה חופשית אינה זה.
     לכן נשלחים רק טוקנים בצורת דגם, אות לצד ספרה או שם מותג מוכר. שם פרטי אינו בצורה
     הזאת, ורצף של חמש ספרות ומעלה מנוקה לפני הכל, כי זה מספר טלפון ולא דגם. */
  var BRAND_WORDS=['גלקסי','אייפון','סמסונג','שיאומי','רדמי','פיקסל','גוגל','וואן פלוס','נאת׳ינג','אפל',
                   'galaxy','iphone','samsung','xiaomi','redmi','pixel','google','oneplus','nothing','apple'];
  /* **בלי רווח בתוך הטוקן, וזה העיקר.** הגרסה הקודמת התירה [a-z]+\s?\d+, ולכן שם פרטי
     שנצמד למספר סמוך עבר: "ariel 052 589 3366 iphone" נתן "ariel 052 3366 iphone",
     כלומר שם ושברי טלפון ל-GA4, נגד privacy.html §3. ו-\d{5,} ניקה רצף רצוף בלבד, בזמן
     שמספר טלפון נכתב בקבוצות.
     עכשיו טוקן הוא צירוף צמוד של אותיות וספרות בלבד: a56, s26, note14, 17e, 15r.
     קבוצת ספרות בת שלוש ומעלה אינה מספר דגם ואינה עוברת בשום צורה. */
  function deviceHint(text){
    var t=normDev(text),out=[],i;
    var toks=(t.match(/[a-z]{1,6}\d{1,2}[a-z]{0,2}|\d{1,2}[a-z]{1,3}/g)||[])
      .filter(function(x){return x.length<=8;});
    for(i=0;i<toks.length&&out.length<3;i++)if(out.indexOf(toks[i])<0)out.push(toks[i]);
    for(i=0;i<BRAND_WORDS.length&&out.length<3;i++)if(t.indexOf(BRAND_WORDS[i])>=0&&out.indexOf(BRAND_WORDS[i])<0)out.push(BRAND_WORDS[i]);
    return out.join(' ').slice(0,40);
  }
  var WORDCH='0-9a-z\\u0590-\\u05ff';
  /* גבול שמאלי שמתיר תחילית עברית אחת. בעברית "ל", "ב", "ה", "מ", "ו", "ש", "כ" נדבקות
     למילה, ולכן "לאייפון 17 פרו" לא היה מתאים לטוקן "אייפון 17 פרו" בבדיקת גבול רגילה.
     זו אותה משפחה של \b שאינו קיים בעברית, והיא הפילה כאן כל שאלת השוואה. */
  function hasToken(hay,tok){
    var esc=tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(^|[^'+WORDCH+'][ולבמהשכ]?)'+esc+'([^'+WORDCH+']|$)').test(hay);
  }
  function countSub(hay,tok){var n=0,i=0;while((i=hay.indexOf(tok,i))>=0){n++;i+=tok.length;}return n;}
  /* מחזיר את הדגמים שהוזכרו, בסדר ההופעה במשפט.
     ההכלה נפתרת בספירה ולא בפסילה: "אחריות על אייפון 17 פרו" מזכיר את הטוקן "אייפון 17"
     פעם אחת, וכולה מוסברת על ידי "אייפון 17 פרו", ולכן אייפון 17 אינו אזכור נפרד.
     אבל "ההבדל בין אייפון 17 לאייפון 17 פרו" מזכיר אותו פעמיים ואת הארוך פעם אחת, כלומר
     נשאר אזכור אחד בלתי מוסבר, וזה דגם שני אמיתי. פסילה עיוורת לפי הכלה הייתה מאבדת את
     הצד השמאלי של כל שאלת השוואה. */
  function findDevices(text){
    if(!FACTS)return [];
    var hay=' '+normDev(text)+' ',hits=[];
    FACTS.devices.forEach(function(d){
      var toks=devTokens(d),best='';
      for(var i=0;i<toks.length;i++)if(hasToken(hay,toks[i])&&toks[i].length>best.length)best=toks[i];
      if(best)hits.push({d:d,tok:best,at:hay.indexOf(best)});
    });
    hits.sort(function(a,b){return b.tok.length-a.tok.length;});
    var out=[],used=[];
    hits.forEach(function(h){
      var left=countSub(hay,h.tok),i;
      for(i=0;i<used.length;i++)if(used[i].indexOf(h.tok)>=0)left-=countSub(hay,used[i]);
      if(left<=0)return;
      used.push(h.tok);out.push(h);
    });
    out.sort(function(a,b){return a.at-b.at;});
    return out.map(function(h){return h.d;});
  }
  /* סדר מהספציפי לכללי: "טעינה אלחוטית" לפני "טעינה", "מצלמה קדמית" לפני "מצלמה" */
  var DEV_FIELDS=[
    ['__good',['למי מתאים','מתאים לי','שווה לי','כדאי לי','למי זה','למי הוא מתאים']],
    ['__less',['למי לא מתאים','למי פחות','חסרונות','מה החסרונות']],
    ['warranty',['אחריות','אחראי']],
    ['payments',['תשלומים','תשלום','קרדיט','אשראי']],
    ['data_transfer',['העברת נתונים','להעביר נתונים','העברת מידע','גיבוי','אנשי קשר']],
    ['service_terms',['מכשיר חלופי','תנאי שירות','זמן תיקון']],
    ['charging_wireless',['טעינה אלחוטית','אלחוטית']],
    ['camera_front',['מצלמה קדמית','סלפי']],
    ['storage_offered',['אחסון','נפח']],
    ['screen_size',['גודל מסך','אינץ']],
    ['screen_type',['סוג מסך','אמולד','oled']],
    ['refresh_rate',['רענון','הרץ']],
    ['brightness',['בהירות','ניטס']],
    ['chip',['שבב','מעבד']],
    ['ram',['זיכרון','רם']],
    ['camera_main',['מצלמה','מגה פיקסל']],
    ['zoom',['זום','טלפוטו']],
    ['video',['וידאו','צילום וידאו']],
    ['battery',['סוללה','מיליאמפר']],
    ['charging_wired',['טעינה','וואט']],
    ['weight',['משקל','שוקל','גרם']],
    ['water_resistance',['מים','עמידות במים']],
    ['esim',['esim','אי סים']],
    ['security_updates',['עדכונים','עדכוני אבטחה']],
    ['colors_manufacturer',['צבע','צבעים','גוונים']],
    ['sim',['סים','כמה סימים']]
  ];
  function findField(text){
    var hay=' '+normDev(text)+' ';
    /* גם בלי ה"א הידיעה. מילת המפתח היא "גודל מסך", והשאלה הטבעית היא "מה גודל **ה**מסך",
       ולכן התאמת תת-מחרוזת פשוטה נכשלה ושאלת מפרט שלמה נחטפה לזרימת קנייה. אותה משפחה
       של תחיליות עבריות שנשכה בפרויקט הזה שוב ושוב. */
    var bare=hay.replace(/(^| )ה([֐-׿])/g,'$1$2');
    for(var i=0;i<DEV_FIELDS.length;i++){
      var kws=DEV_FIELDS[i][1];
      for(var j=0;j<kws.length;j++){
        var k=normDev(kws[j]);
        if(hay.indexOf(k)>=0||bare.indexOf(k)>=0)return DEV_FIELDS[i][0];
      }
    }
    return null;
  }
  /* גילוי נאות למכשיר ייחוס. מוחזר בכל אזכור ולא רק בראשון, ולכן הוא חלק מבניית התשובה
     ולא מצב שנשמר בשיחה. */
  function refNote(d){
    return d.kind==='reference'
      ? 'שימו לב: את '+d.name_he+' אנחנו לא מוכרים. הוא אצלנו במאגר רק כדי שאפשר להשוות אליו.'
      : '';
  }
  function devLink(d){
    return d.kind==='reference'?null:{label:'לעמוד של '+d.name_he,href:'/phones/'+d.slug+'/'};
  }
  var COMMERCIAL={warranty:1,payments:1,data_transfer:1,service_terms:1};
  function fieldAnswer(d,field){
    var note=refNote(d),pre=note?note+'\n':'';
    if(field==='__good'||field==='__less'){
      var arr=field==='__good'?d.good_for:d.less_for;
      if(!arr||!arr.length)return {text:pre+'על '+d.name_he+' אין לי את החלק הזה כתוב. ברוך וסיגל יסבירו בדיוק, בטלפון או בחנות.',human:true};
      return {text:pre+(field==='__good'?'למי מתאים ':'למי פחות מתאים ')+d.name_he+':\n• '+arr.slice(0,3).join('\n• ')};
    }
    if(COMMERCIAL[field]){
      /* מכשיר ייחוס אינו נמכר, ולכן אין לו תנאי מסחר. זו תשובה ולא נתון חסר. */
      if(d.kind==='reference')return {text:note+'\nולכן אין לו אצלנו אחריות ואין תנאי תשלום.',human:false};
      if(field==='warranty'){
        if(!d.warranty_by)return {text:pre+'על האחריות של '+d.name_he+' עדיף שתשמעו מברוך או מסיגל, כדי שלא אתן לכם מספר לא מדויק.',human:true,deferred:'warranty'};
        var t='האחריות על '+d.name_he+': '+d.warranty_by;
        if(typeof d.warranty_months==='number')t+='\nלמשך '+d.warranty_months+' חודשים.';
        if(d.service_terms)t+='\n'+d.service_terms;
        return {text:pre+t};
      }
      var v=d[field];
      if(!v)return {text:pre+'את זה לגבי '+d.name_he+' עדיף לשמוע מברוך או מסיגל.',human:true,deferred:field};
      return {text:pre+v};
    }
    /* שדה מפרט. null אינו "בערך", הוא "היצרן לא מפרסם". */
    var sv=d.spec?d.spec[field]:null;
    if(Array.isArray(sv))sv=sv.join(', ');
    if(sv===null||sv===undefined||sv==='')return {text:pre+'את הנתון הזה על '+d.name_he+' היצרן לא מפרסם. אם זה קריטי לבחירה, ברוך יבדוק מול המכשיר עצמו.',human:true};
    return {text:pre+d.name_he+', '+sv};
  }
  /* ההשוואה מחזירה עד שלושה הבדלים וקישור, ולא טבלה מלאה, כדי לא לקניבל את /compare/
     ואת /phones/ שנכתבו בשביל בדיוק השאילתה הזאת. הסדר הוא לפי מה שקונה מרגיש, ולא לפי
     סדר השדות במפרט. */
  var CMP_ORDER=[
    ['screen_size','גודל מסך'],['chip','שבב'],['camera_main','מצלמה ראשית'],
    ['zoom','זום'],['battery','סוללה'],['charging_wired','טעינה'],
    ['storage_offered','אחסון'],['refresh_rate','קצב רענון'],['weight','משקל'],
    ['water_resistance','עמידות במים'],['ram','זיכרון']
  ];
  function specStr(d,k){var v=d.spec?d.spec[k]:null;if(Array.isArray(v))v=v.join(', ');return (v===null||v===undefined)?'':String(v);}
  /* ערכי המפרט מפורטים, ותשובת השוואה מלאה יצאה כ-415 תווים, כלומר בועה שממלאת פאנל
     שכל שטח השיחה בו הוא 362px. הקיצור הוא **תחילית של המקור** ולא ניסוח מחדש: חותכים
     בפסיק הראשון, ולכן כל מספר שנשאר עדיין מופיע בשדה המקורי והקריטריון נשמר בבנייה.
     מה שנחתך יושב בעמוד ההשוואה, שאליו יש קישור בכל מקרה. */
  function clause(v){
    var s=String(v),cut=s.indexOf(',');
    if(cut>=8)s=s.slice(0,cut);
    if(s.length>36){var sp=s.lastIndexOf(' ',36);s=s.slice(0,sp>12?sp:36);}
    /* חיתוך משאיר פסיק או נקודתיים תלויים באוויר */
    return s.replace(/[\s,:;.\-]+$/,'');
  }
  /* שני ערכים שאין להם יחידה משותפת אינם ברי-השוואה בשורה אחת. אפל מציינת סוללה בשעות
     וידאו ו-וואן פלוס במיליאמפר, ו-"עד 30 שעות וידאו מול 7400 mAh" מרמז על השוואה שאינה
     קיימת. עדיף לדלג על השדה מלהציב הצבה מטעה, ויש עוד עשר שורות בסדר להמשיך אליהן. */
  var UNITS=[/\d\s*mah/i,/אינץ/,/\d\s*mp/i,/\d\s*hz/i,/\d\s*wh/i,/\d\s*גרם/,/\d\s*x/i,/שעות/,/מ״מ/,/ס״מ/,/\d\s*gb/i,/\d\s*tb/i];
  function unitSet(s){var o=[],i;for(i=0;i<UNITS.length;i++)if(UNITS[i].test(String(s)))o.push(i);return o;}
  function comparable(va,vb){
    var ua=unitSet(va),ub=unitSet(vb),i;
    /* טקסט מול טקסט, כמו שם שבב, בר-השוואה */
    if(!ua.length&&!ub.length)return true;
    for(i=0;i<ua.length;i++)if(ub.indexOf(ua[i])>=0)return true;
    return false;
  }
  /* מקשר רק לעמוד שקיים בפועל, לפי הרשימה שהמחולל גזר מהדיסק. אחרת לשער ההשוואות. */
  function comparePage(a,b){
    var list=(FACTS&&FACTS.comparePages)||[];
    if(list.indexOf(a.slug+'-vs-'+b.slug)>=0)return '/compare/'+a.slug+'-vs-'+b.slug+'/';
    if(list.indexOf(b.slug+'-vs-'+a.slug)>=0)return '/compare/'+b.slug+'-vs-'+a.slug+'/';
    return '/compare/';
  }
  function compareAnswer(a,b){
    var diffs=[],i,k,va,vb;
    for(i=0;i<CMP_ORDER.length&&diffs.length<3;i++){
      k=CMP_ORDER[i][0];va=specStr(a,k);vb=specStr(b,k);
      if(!va||!vb||va===vb)continue;
      var sa=clause(va),sb=clause(vb);
      /* אם הקיצור הפך את שני הערכים לזהים, השורה מאבדת את מה שהיא באה להראות, ואז
         חוזרים לערכים המלאים דווקא בשורה הזאת. */
      if(sa===sb){sa=va;sb=vb;}
      /* השומן חייב לרוץ על מה שמוצג ולא על הערך המלא, וזה היה באג אמיתי: הסוללה של
         גלקסי S26 היא "עד 30 שעות וידאו, 4300 mAh טיפוסית", ולכן היא בת-השוואה ל-mAh של
         וואן פלוס. אבל החיתוך בפסיק הראשון השאיר "עד 30 שעות וידאו" מול "7400 mAh",
         כלומר שעות מול מיליאמפר, וזו הצבה מטעה שעברה את הבדיקה על הערך המלא. */
      if(!comparable(sa,sb))continue;
      /* שמות הדגמים בכותרת ולא בכל שורה. הצורה הקודמת חזרה על שניהם שלוש פעמים, כלומר
         שש חזרות, וזה גם בזבוז מקום וגם בדיוק אותה צורה חוזרת שקוראת כמכונה. */
      diffs.push(CMP_ORDER[i][1]+': '+sa+' מול '+sb);
    }
    var notes=[refNote(a),refNote(b)].filter(function(x){return x;});
    var pre=notes.length?notes.join('\n')+'\n':'';
    if(!diffs.length)return {text:pre+'במפרט שיש לי, '+a.name_he+' ו'+b.name_he+' דומים בכל מה שבדקתי. ברוך יסביר במה הם נבדלים בשימוש עצמו.',human:true};
    return {text:pre+a.name_he+' מול '+b.name_he+', לפי הסדר הזה:\n• '+diffs.join('\n• ')};
  }
  function isCompareQ(text){
    var h=' '+normDev(text)+' ';
    return h.indexOf('הבדל')>=0||h.indexOf(' מול ')>=0||h.indexOf('לעומת')>=0||h.indexOf(' vs ')>=0;
  }
  /* מנוסה רק כשיש גם דגם וגם שדה, או שאלת השוואה עם שני דגמים. דגם לבד ממשיך להתנהגות
     הקיימת, כדי לא לחטוף "אני רוצה לקנות אייפון 17" מזרימת הקנייה. */
  function deviceAnswer(text){
    var devs=findDevices(text);
    if(isCompareQ(text)&&devs.length>=2){
      var a=devs[0],b=devs[1];
      fails=0;ctx.topic='השוואה';
      track('chat_device_compare',{slug_a:a.slug,slug_b:b.slug});
      var r=compareAnswer(a,b),href=comparePage(a,b);
      botReply(r.text,{cta:r.human?contactCta():null,sug:[[href==='/compare/'?'כל ההשוואות':'להשוואה המלאה',function(){location.href=href;}]]});
      return true;
    }
    var field=findField(text);if(!field)return false;
    if(!devs.length){
      /* יש שאלה על שדה אבל אין דגם מזוהה. מכריזים "לא זיהיתי דגם" **רק** כשבאמת היה
         בטקסט משהו בצורת דגם. אחרת זו שאלת תוכן ולא שאלת דגם, ושכבת התוכן תענה עליה.
         זה נמצא בעמוד המדריך ל-eSIM: "איך מעבירים eSIM למכשיר חדש" נתפס כאן, כי esim
         הוא גם שם שדה מפרט, והבוט השיב "לא זיהיתי איזה דגם" במקום לענות מהמדריך. */
      if(!FACTS)return false;
      if(!deviceHint(text))return false;
      track('chat_device_unmatched',{hint:deviceHint(text),q_len:Math.min(String(text).length,300)});
      botReply('לא זיהיתי איזה דגם. אפשר לכתוב את השם המלא, למשל "גלקסי A56" או "אייפון 17 פרו", או לבחור מהרשימה.',{sug:[['רשימת המכשירים',function(){startBuy();}],['לדבר עם ברוך',function(){startLead('שאלה על דגם');}]]});
      return true;
    }
    if(devs.length>1){
      var sug=[];
      for(var i=0;i<devs.length&&i<5;i++)(function(d){sug.push([d.name_he,function(){oneDevice(d,field);}]);})(devs[i]);
      botReply('על איזה מהם?',{sug:sug});
      return true;
    }
    oneDevice(devs[0],field);
    return true;
  }
  function oneDevice(d,field){
    fails=0;ctx.device=d.name_he;ctx.slug=d.slug;
    var a=fieldAnswer(d,field);
    track('chat_device_spec',{slug:d.slug,field:field});
    if(a.deferred)track('chat_commercial_deferred',{slug:d.slug,field:a.deferred});
    var link=devLink(d),cta=a.human?contactCta():null,sug=[];
    if(link)sug.push([link.label,function(){location.href=link.href;}]);
    if(!a.human)sug.push(['לדבר עם ברוך',function(){startLead('שאלה על '+d.name_he);}]);
    botReply(a.text,{cta:cta,sug:sug});
  }
  /* ---- תוכן האתר: 193 מקטעים מ-21 עמודים, מדריכים ועמודי שירות ומדריך התקלות ----
     מה שאינו כאן הוא בכוונה: עמודי מכשיר והשוואה נגזרים מאותו devices.json שממנו נגזר
     bot-facts, ואינדוקס שלהם היה יוצר שני נתיבי תשובה מתחרים לאותה שאלה.

     הכלל שמחזיק את זה: **מצטטים, לא מסכמים.** התשובה היא קטע רציף מתוך המקטע, ואחריה
     קישור לעמוד. סיכום היה הופך את הבוט לכותב בשם המותג בלי בקרת אדם, וזה בדיוק מה
     שנאסר בכל v1. */
  var CONTENT=null,contentState='idle';
  function loadContent(){
    if(contentState!=='idle')return;
    contentState='loading';
    try{
      fetch('/bot-content.json').then(function(r){return r.ok?r.json():null;}).then(function(j){
        if(j&&j.sections&&j.sections.length){CONTENT=j;contentState='ready';}else{contentState='failed';}
      })['catch'](function(){contentState='failed';});
    }catch(e){contentState='failed';}
  }
  /* תחיליות עבריות. **מוסיפים צורה, לא מחליפים אותה**, וזה תיקון לבאג אמיתי: הגרסה
     הראשונה הסירה כל אות תחילית בעיוורון, ולכן "לוקח" הפך ל"וקח". זה לא רק פספס את
     המילה, זה גם ייצר התאמת שווא, כי "וקח" תפס את "שלוקחת" בכותרת של מדריך אחסון.
     בכיוון הטקסט ההתאמה כתת-מחרוזת ממילא מטפלת בתחיליות, כי "שלוקחת" מכיל "לוקח". */
  function variants(w){
    var v=[w];
    if(w.length>3&&'ולבמהשכ'.indexOf(w.charAt(0))>=0)v.push(w.slice(1));
    return v;
  }
  var STOP={'של':1,'את':1,'זה':1,'אני':1,'מה':1,'איך':1,'יש':1,'לא':1,'על':1,'עם':1,'כמה':1,'אם':1,'או':1,'גם':1,'כל':1,'הוא':1,'היא':1,'אבל':1,'רק':1,'כי':1,'לי':1,'לכם':1,'אפשר':1,'צריך':1,'רוצה':1,'איפה':1,'מתי':1,'למה':1};
  function qTokens(text){
    var raw=normDev(text).replace(/[^0-9a-z֐-׿]+/g,' ').split(' ');
    var out=[],i;
    for(i=0;i<raw.length;i++){
      var w=raw[i];
      if(w.length<2||STOP[w])continue;
      if(out.indexOf(w)<0)out.push(w);
    }
    return out;
  }
  /* משקל לפי נדירות. בלעדיו "מסך", שמופיע כמעט בכל מקטע, שווה בדיוק כמו "esim" שמופיע
     בעמוד אחד, ושלושה עמודים שונים יוצאים באותו ניקוד. זה בדיוק מה שקרה במדידה:
     "כמה זמן לוקח להחליף מסך" נתן 4 לשלושה עמודים, וההכרעה ביניהם הייתה מקרית. */
  function idf(tok){
    var df=0,i,v=variants(tok);
    for(i=0;i<CONTENT.sections.length;i++){
      var s=CONTENT.sections[i],j;
      for(j=0;j<v.length;j++)if(s.h.indexOf(v[j])>=0||s.t.indexOf(v[j])>=0){df++;break;}
    }
    /* +1 כדי שמילה שאינה בשום מקטע לא תיתן חלוקה באפס, ורצפה כדי שמילה נפוצה מאוד
       עדיין תתרום משהו */
    return Math.max(0.25,Math.log(CONTENT.sections.length/(1+df)));
  }
  /* ציטוט: קטע רציף מתוך המקטע, שמתחיל במשפט שבו נמצאה המילה החזקה ביותר. תמיד תת-מחרוזת
     של המקור, ולכן אין בו מספר שלא היה שם. */
  function excerpt(t,toks){
    var lo=t.toLowerCase(),at=-1,i;
    for(i=0;i<toks.length&&at<0;i++)at=lo.indexOf(toks[i]);
    if(at<0)at=0;
    /* מתחילים בגבול משפט אמיתי. חיפוש רק אחרי נקודה החזיר ציטוט שנפתח באמצע שאלה,
       "זמן לוקח להחליף מסך?" במקום "כמה זמן לוקח". שאלה וקריאה הן סופי משפט גם הן. */
    var start=-1,marks=['. ','? ','! ','־ '],mi;
    for(mi=0;mi<marks.length;mi++){var p=t.lastIndexOf(marks[mi],at);if(p>start)start=p;}
    start=start>=0&&at-start<160?start+2:Math.max(0,at-40);
    /* אם ההתחלה כמעט בראש המקטע, פשוט מתחילים בראש. אחרת נחתכת מילה אחת מתוך שאלה
       ומתקבל "זמן לוקח להחליף מסך?" במקום "כמה זמן לוקח להחליף מסך?" */
    if(start<25)start=0;
    if(start>0){var sp=t.indexOf(' ',start);if(sp>=0&&sp-start<12)start=sp+1;}
    var s=t.slice(start,start+220);
    if(start+220<t.length){var cut=s.lastIndexOf(' ');if(cut>60)s=s.slice(0,cut);}
    return s.replace(/^[\s,.;:•]+/,'').replace(/[\s,;:]+$/,'');
  }
  /* min מאפשר שתי מעברות: אחת לפני הכוונות עם רף גבוה, ואחת אחריהן עם הרף הרגיל.
     הסיבה נמצאה בעמוד המדריך ל-eSIM: "איך מעבירים eSIM למכשיר חדש" נבלע על ידי הכוונה
     buy, שמילות המפתח שלה כוללות "מכשיר חדש", והמשתמש נשלח לזרימת קנייה במקום לקבל
     תשובה מהמדריך שהוא עומד עליו. התאמת תוכן חזקה וספציפית צריכה לנצח כוונה גנרית,
     אבל התאמה חלשה לא, ולכן שני רפים ולא היפוך סדר. */
  function contentAnswer(text,min){
    if(!CONTENT)return false;
    var toks=qTokens(text);
    if(toks.length<2)return false;
    /* ביטוי אחד לכל מילה, מורכב מראש. ההתאמה היא **מילה ולא תת-מחרוזת**: "לוקח" בתוך
       "שלוקחת" אינו אותה מילה אלא הטיה אחרת, וההתאמה החופשית שלחה את "כמה זמן לוקח
       להחליף מסך" למדריך אחסון שבכותרתו "הבדיקה שלוקחת חצי דקה". הגבול השמאלי מתיר
       תחילית עברית אחת, בדיוק כמו בזיהוי שמות הדגמים. */
    var w=[],re=[],i,j;
    for(i=0;i<toks.length;i++){
      w.push(idf(toks[i]));
      var alts=variants(toks[i]).map(function(x){return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|');
      re.push(new RegExp('(^|[^'+WORDCH+'][ולבמהשכ]?|[^'+WORDCH+'])('+alts+')([^'+WORDCH+']|$)'));
    }
    var best=null,sec,score,hit;
    for(i=0;i<CONTENT.sections.length;i++){
      sec=CONTENT.sections[i];
      var h=' '+sec.h.toLowerCase()+' ',b=' '+sec.t.toLowerCase()+' ';
      score=0;hit=0;
      for(j=0;j<toks.length;j++){
        var inH=re[j].test(h),inB=inH?false:re[j].test(b);
        if(inH){score+=3*w[j];hit++;}
        else if(inB){score+=w[j];hit++;}
      }
      /* דורש שתי מילים שונות לפחות. מילה אחת מתאימה לחצי האתר, וזה ניחוש. */
      if(hit>=2&&(!best||score>best.score))best={sec:sec,score:score,hit:hit};
    }
    /* הסף כויל מול 12 שאלות אמיתיות ומול ברכות. מתחתיו לא עונים, כי ניתוב לאדם עדיף
       על תשובה שקרובה ולא נכונה. */
    if(!best||best.score<(min||3.2))return false;
    var pg=CONTENT.pages[best.sec.p];
    fails=0;
    track('chat_content_hit',{url:pg.u,heading:String(best.sec.h).slice(0,60),score:best.score});
    botReply(best.sec.h+'\n'+excerpt(best.sec.t,toks),{
      sug:[['לעמוד המלא',function(){location.href=pg.u;}],
           ['לדבר עם ברוך',function(){startLead(String(best.sec.h).slice(0,40));}]]
    });
    return true;
  }
  /* bot:answers:end */
  function buyParts(){var p=[];if(ctx.rec)p.push('רוצה המלצה על הדגם המתאים');if(ctx.brand)p.push('יצרן: '+ctx.brand);if(ctx.model)p.push('דגם: '+ctx.model);if(ctx.storage)p.push('נפח: '+ctx.storage);if(ctx.imp)p.push('יבוא: '+ctx.imp);return p;}
  function buyWa(){var p=buyParts();return 'היי, הגעתי דרך האתר של פון גת. מעוניין/ת לקנות מכשיר חדש.'+(p.length?('\n'+p.join('\n')):'')+'\nאשמח להצעת מחיר.';}
  function buyTopic(){var p=buyParts();return 'קניית מכשיר'+(p.length?(' - '+p.join(', ')):'');}

  function startBuy(){
    flow={type:'buy',step:'brand'};ctx.topic='buy';ctx.brand='';ctx.model='';ctx.slug='';ctx.storage='';ctx.imp='';ctx.rec=false;
    track('chat_flow',{flow:'buy'});
    var sug=[],i;
    for(i=0;i<BUY_BRANDS.length;i++)(function(p){sug.push([p[0],function(){buyBrand(p[0],p[1]);}]);})(BUY_BRANDS[i]);
    sug.push(['רוצה המלצה',function(){buyBrand('','');}]);
    sug.push(['אבזור',function(){flow=null;runIntent('accessories');}]);
    botReply('נשמח לעזור לבחור. איזה מכשיר מעניין אתכם?',{sug:sug});
  }
  function buyBrand(he,en){
    ctx.brand=he;track('chat_buy_step',{step:'brand',value:he||'המלצה'});
    if(!he){ctx.rec=true;flow={type:'buy',step:'storage'};askStorage();return;}
    var list=soldByBrand(en);
    /* הקטלוג לא נטען. מדלגים על שלב הדגם וממשיכים, ולא ממציאים רשימה. */
    if(!list.length){ctx.model='';flow={type:'buy',step:'storage'};askStorage();return;}
    if(list.length>BUY_SPLIT){
      var cats=[],seen={},i,c;
      for(i=0;i<list.length;i++){c=buyCat(list[i]);if(!seen[c]){seen[c]=1;cats.push(c);}}
      var csug=[];
      for(i=0;i<cats.length;i++)(function(x){csug.push([x,function(){buyCatPick(en,x);}]);})(cats[i]);
      csug.push(['לא בטוח / דגם אחר',function(){buyModel('','');}]);
      flow={type:'buy',step:'cat'};
      botReply('מעולה. איזו סדרה מעניינת אתכם?',{sug:csug});
      return;
    }
    buyShowModels(list);
  }
  function buyCatPick(en,cat){
    track('chat_buy_step',{step:'cat',value:cat});
    var list=soldByBrand(en).filter(function(d){return buyCat(d)===cat;});
    if(!list.length){buyModel('','');return;}
    buyShowModels(list);
  }
  function buyShowModels(list){
    flow={type:'buy',step:'model'};
    var sorted=list.slice().sort(function(a,b){return modelRank(b)-modelRank(a);});
    var over=sorted.length>BUY_SPLIT;
    var head=over?sorted.slice(0,BUY_SHOW):sorted, rest=over?sorted.slice(BUY_SHOW):[];
    var sug=[],i;
    for(i=0;i<head.length;i++)(function(d){sug.push([shortModel(d.name_he),function(){buyModel(d.name_he,d.slug);}]);})(head[i]);
    if(rest.length)sug.push(['עוד דגמים',function(){moreModels(rest);}]);
    else sug.push(['לא בטוח / דגם אחר',function(){buyModel('','');}]);
    botReply('איזה דגם? אפשר גם להקליד שם מדויק.',{sug:sug});
  }
  /* מעל שישה דגמים, השאר נכנסים ל-select נייטיב ולא לשורת צ'יפים נוספת. פקד אחד בגובה
     44px במקום שורה שלמה, נגיש מלכתחילה למקלדת ולקורא מסך, ובמובייל פותח את הבורר של
     המערכת. גלילה אופקית נדחתה כי היא מסתירה אפשרויות בלי רמז חזותי. */
  function moreModels(rest){
    var box=document.createElement('div');box.className='pg-sug col';
    var id='pgMoreSel'+(++moreSeq);
    var lab=document.createElement('label');lab.className='pg-sug-label';lab.setAttribute('for',id);lab.textContent='עוד דגמים';
    var sel=document.createElement('select');sel.className='pg-select';sel.id=id;
    function opt(v,t){var o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);}
    opt('','בחרו דגם');
    for(var i=0;i<rest.length;i++)opt(rest[i].slug,rest[i].name_he);
    opt('__other','לא בטוח / דגם אחר');
    sel.addEventListener('change',function(){
      var v=sel.value;if(!v)return;
      sel.disabled=true;
      if(v==='__other'){lastUser='לא בטוח / דגם אחר';bubble(lastUser,'user');buyModel('','');return;}
      var d=factsBySlug(v),nm=d?d.name_he:'';
      lastUser=nm;bubble(nm,'user');buyModel(nm,v);
    });
    box.appendChild(lab);box.appendChild(sel);
    msgs.appendChild(box);down();
    setTimeout(function(){try{sel.focus();}catch(e){}},60);
  }
  /* טקסט חופשי בשלב הדגם מזוהה מול הקטלוג. בלי זה כל מחרוזת נרשמה כדגם לרכישה, וה-QA
     מצא את התוצאה: הקלדת "גוגל פיקסל 10" נרשמה כדגם, קיבלה "יבוא רשמי" שאין לו יבואן
     רשמי בישראל כלל, ונשלחה לחנות כבקשת הצעת מחיר, בלי גילוי נאות ותחת "יצרן: סמסונג".
     מכשיר ייחוס אינו נמכר, ולכן הוא נעצר כאן ולא ממשיך בזרימה. */
  var BRAND_EN={};
  (function(){for(var i=0;i<BUY_BRANDS.length;i++)BRAND_EN[BUY_BRANDS[i][0]]=BUY_BRANDS[i][1];})();
  function buyModel(m,slug){
    if(m&&!slug){
      var hits=findDevices(m);
      if(hits.length===1){
        if(hits[0].kind==='reference'){
          track('chat_ref_declined',{slug:hits[0].slug});
          botReply(refNote(hits[0])+'\nאפשר לבחור דגם אחר, או להמשיך בלי דגם ולהשאיר פרטים.',{
            sug:[['לבחור דגם אחר',function(){buyBrand(ctx.brand||'',BRAND_EN[ctx.brand]||'');}],
                 ['להמשיך בלי דגם',function(){buyModel('','');}]]});
          return;
        }
        /* דגם נמכר שזוהה: משלימים את השם המלא ואת ה-slug, וכך גם שלב הנפח מדויק */
        m=hits[0].name_he;slug=hits[0].slug;
      }
    }
    ctx.model=m||ctx.model||'';ctx.slug=slug||'';
    track('chat_buy_step',{step:'model',value:m||'לא בטוח'});
    flow={type:'buy',step:'storage'};askStorage();
  }
  /* הנפחים לפי storage_offered של הדגם שנבחר, כלומר מה שהיצרן מציע בפועל. בלי דגם נשארת
     הרשימה הגנרית. שדה storage_stocked, מה שיש אצלנו בחנות, מלא ב-2 מ-24 ולכן אינו בקובץ
     כלל: תשובת מלאי מנתון חלקי היא הבטחה בשם המותג בלי בקרת אדם. */
  function askStorage(){
    var d=factsBySlug(ctx.slug),opts=null,sug=[],i;
    if(d&&d.spec){
      var so=d.spec.storage_offered;
      if(Array.isArray(so)&&so.length)opts=so;
      else if(typeof so==='string'&&so)opts=so.split(',');
    }
    if(opts){for(i=0;i<opts.length;i++)(function(s){sug.push([String(s).trim(),function(){buyStorage(String(s).trim());}]);})(opts[i]);}
    else{sug.push(['128GB',function(){buyStorage('128GB');}]);sug.push(['256GB',function(){buyStorage('256GB');}]);sug.push(['512GB ומעלה',function(){buyStorage('512GB ומעלה');}]);}
    sug.push(['לא בטוח',function(){buyStorage('');}]);
    botReply(opts?('איזה נפח? אלה הנפחים שיש ל'+(ctx.model||'דגם הזה')+'.'):'איזה נפח זיכרון צריך?',{sug:sug});
  }
  function buyStorage(s){ctx.storage=s;track('chat_buy_step',{step:'storage',value:s||'לא בטוח'});flow={type:'buy',step:'import'};askImport();}
  function askImport(){botReply('ואיזה יבוא מעדיפים?',{sug:[['יבוא רשמי',function(){buyImport('רשמי');}],['יבוא מקביל',function(){buyImport('מקביל');}],['לא בטוח, שתסבירו לי',function(){buyImport('');}]]});}
  function buyImport(v){ctx.imp=v;track('chat_buy_step',{step:'import',value:v||'לא בטוח'});buyDone();}
  function buyDone(){
    flow=null;ctx.topic=buyTopic();
    var p=buyParts(),sum=p.length?('רשמתי לפניי:\n• '+p.join('\n• ')+'\n'):'';
    track('chat_buy',{device:ctx.brand||'המלצה',model:ctx.model||'',storage:ctx.storage||'',imp:ctx.imp||''});
    botReply(sum+'הכול בתשלומים, כולל העברת נתונים מהמכשיר הישן ואבזור. נשמח לתת לכם הצעת מחיר מדויקת.\n'+hoursLine(),{cta:contactCta(),waText:buyWa(),sug:[['תשלומים',function(){runIntent('payments');}],['העברת נתונים',function(){runIntent('data');}],['בקשת שיחה חוזרת',function(){startLead(ctx.topic);}]]});
  }

  function startLead(topic){ctx.topic=topic||ctx.topic||'כללי';track('chat_lead_start',{topic:ctx.topic});if(ctx.name){flow={type:'lead',step:'phone'};botReply('מעולה '+ctx.name+'. מה מספר הטלפון שנחזור אליו?');}else{flow={type:'lead',step:'name'};botReply('בשמחה נחזור אליכם. איך קוראים לכם?');}}
  function saveLead(name,phone,topic){
    /* The reply that promises "רשמנו את הפרטים" is printed by the caller before this
       request finishes, so a failure here has to speak up. It used to disappear twice over:
       fetch rejects asynchronously and the try/catch around it never saw that, and the only
       other copy went into localStorage.pg_leads, a key nothing in the project ever read.
       So the lead was lost while the customer was told it arrived. */
    var failed=function(){
      botReply('רגע, השליחה לא עברה והפרטים לא הגיעו אלינו. הדרך הבטוחה עכשיו היא WhatsApp או טלפון:',
        {cta:['wa','tel'],waText:'שיחה חוזרת מהאתר\nשם: '+name+'\nטלפון: '+phone+'\nנושא: '+topic});
    };
    /* Same rule as the contact form: a chat lead from staging must not reach the inbox.
       The caller says so on screen, through keyOk, because a reply printed from here lands
       BEFORE the caller's reply and the reassuring production wording would be the last
       thing a tester reads. */
    if(!window.PG_PROD){
      if(window.console)console.warn('[pg] '+window.PG_ENV+': הליד לא נשלח במייל');
      return;
    }
    /* own copy: the contact form moved to /contact/, so there is no #contactForm here to read */
    var key='99c6d9a8-827b-42d7-99f1-22e06a8643fe';
    if(!key||key.indexOf('YOUR_')===0){failed();return;}
    try{
      fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({access_key:key,subject:'ליד חדש מהצ׳אט - פון גת',from_name:'צ׳אט פון גת','שם':name,'טלפון':phone,'נושא':topic})})
        .then(function(r){return r.ok?r.json():null;})
        .then(function(j){if(!j||j.success!==true)failed();})
        .catch(failed);
    }catch(e){failed();}
  }
  function handleFlow(text){
    if(/(^|\s)(ביטול|תפריט|חזרה|עזוב|התחל)(\s|$)/.test(text)){mainMenu();return;}
    if(flow.type==='repair'){if(flow.step==='device')repDevice(text.slice(0,30));else repIssue(text.slice(0,40));return;}
    /* יצרן שהוקלד ביד חייב להיפתר לשם האנגלי, אחרת soldByBrand מקבל undefined, שלב
       הדגם נדלג בשקט, וכל מה שיוקלד אחריו נרשם כנפח. נתפס בבדיקת זרימה ולא בקריאה. */
    if(flow.type==='buy'){
      var bt=text.slice(0,40);
      /* גם שלב הסדרה. הוא נוסף עם הפיצול לפי יצרן, ובלעדיו הקלדת שם דגם שם חוזרת
         לשלב היצרן במקום להתקדם, וזו לולאה שהמשתמש לא מבין. */
      if(flow.step==='model'||flow.step==='cat')buyModel(bt);
      else if(flow.step==='storage')buyStorage(bt);
      else if(flow.step==='import')buyImport(bt);
      else{
        var he='',n=normDev(bt);
        for(var bi=0;bi<BUY_BRANDS.length;bi++)if(n.indexOf(normDev(BUY_BRANDS[bi][0]))>=0)he=BUY_BRANDS[bi][0];
        buyBrand(he||bt,BRAND_EN[he]||'');
      }
      return;
    }
    if(flow.type==='lead'){
      if(flow.step==='name'){ctx.name=text.replace(/[<>]/g,'').slice(0,40);flow.step='phone';botReply('נעים מאוד '+ctx.name+'. מה מספר הטלפון שנחזור אליו?');return;}
      if(flow.step==='phone'){if(!validPhone(text)){botReply('לא הצלחתי לזהות מספר תקין. אפשר להקליד מספר טלפון ישראלי, למשל 0525893366:');return;}var ph=digits(text);saveLead(ctx.name,ph,ctx.topic);track('chat_lead_submit',{topic:ctx.topic});flow=null;var keyOk=window.PG_PROD===true;   /* was a dead literal, so the false branch below could never run. It means "this lead is actually on its way": true only in production, where saveLead corrects itself if the request fails. */var waLead='שיחה חוזרת מהאתר\nשם: '+ctx.name+'\nטלפון: '+ph+'\nנושא: '+ctx.topic;var leadMsg=keyOk?('תודה '+ctx.name+'! רשמנו את הפרטים ('+ph+') ונחזור אליכם בהקדם. כדי לזרז, אפשר לשלוח את הפנייה גם ב-WhatsApp:'):('תודה '+ctx.name+'! זו סביבת בדיקות, ולכן הפנייה לא נשלחה לאף תיבה. הוולידציה והזרימה עבדו במלואן. כדי שנחזור אליכם באמת, שלחו את הפרטים ב-WhatsApp או חייגו ישירות:');botReply(leadMsg,{cta:['wa','tel'],waText:waLead,sug:[['חזרה לתפריט',function(){mainMenu();}]]});return;}
    }
  }
  /* This event used to carry a "q" parameter holding the visitor's raw typed text, on its way to GA4.
     People type "קוראים לי דוד 0501234567, המסך שבור" into a chat box, so that field could carry
     a name and a phone number to Google. privacy.html §3 promises only "מידע סטטיסטי (כגון דפים
     שנצפו וסוג מכשיר)", and question text is not that. What the shop actually needs from this
     event is "the bot failed, and roughly on what": the shape of the question answers that, and
     digits_present is the useful one, because it says people are trying to leave details in the
     chat box instead of using the callback flow. None of these three can identify anybody. */
  function fallback(){fails++;track('chat_fallback',{q_len:Math.min(lastUser.length,300),q_words:lastUser.split(/\s+/).length,digits_present:/\d/.test(lastUser)?1:0,attempt:fails});var txt=fails>=2?'עדיין לא הצלחתי להבין. הכי טוב לדבר ישירות עם ברוך וסיגל, או להשאיר פרטים ונחזור אליכם:':'לא בטוח שהבנתי. אפשר לבחור נושא, או לדבר ישירות איתנו:';botReply(txt,{cta:contactCta(),sug:['repair','buy','callback']});}
  /* שאלה על דגם נבדקת לפני matchIntent, כי "אחריות על גלקסי A56" הייתה נתפסת על ידי
     הכוונה הגנרית warranty ומקבלת תשובה כללית, ולעולם לא מגיעה לנתון של הדגם.
     deviceAnswer מחזיר false כשאין גם דגם וגם שדה, ואז הזרימה הקיימת נמשכת כרגיל. */
  /* הסדר הוא מהמדויק למעורפל: דגם מהקטלוג, ואז 18 הכוונות שנכתבו ביד, ורק אז חיפוש
     בתוכן. כך תשובה מתוחזקת תמיד מנצחת, והתוכן מדבר רק במקום שבו הבוט היה נופל ל"לא
     הבנתי". זה גם מה שמונע ממנו להיות רועש. */
  /* כוונת פעולה מנצחת תמיד: מי שמבקש לקנות, לתקן או שנחזור אליו מבקש לעשות משהו,
     ומאמר במקום זה הוא תשובה גרועה גם כשההתאמה שלו חזקה. זה נמצא כשהרף הגבוה של
     התוכן חטף את "אני רוצה לקנות מכשיר חדש" למדריך על הדגם החדש מול הקודם. */
  /* deviceAnswer רץ **ראשון**, לפני כוונות הפעולה. הסדר ההפוך היה רגרסיה חמורה:
     מילות המפתח של buy כוללות את שמות המותגים ושל repair את שמות השדות, ולכן
     "מה הסוללה של גלקסי A56" נחטף לזרימת תיקון ו"איזה שבב יש באייפון 17" לזרימת קנייה.
     נמדד דרך handle() בדפדפן: ארבע מחמש שאלות דגם נחטפו, כלומר כל שכבת העובדות הייתה
     קוד מת בניסוח אמיתי. deviceAnswer דורש גם דגם וגם שדה, ולכן הוא לא חוטף בקשת קנייה. */
  var ACTION_INTENT={repair:1,buy:1,callback:1};
  function handle(text){text=(text||'').trim();if(!text)return;lastUser=text;bubble(text,'user');if(flow){handleFlow(text);return;}if(deviceAnswer(text))return;var it=matchIntent(text);if(it&&ACTION_INTENT[it.id]){respond(it);return;}if(contentAnswer(text,8))return;if(it){respond(it);return;}if(contentAnswer(text))return;fallback();}

  var CHIPS=['repair','buy','celcom','hours','callback'];
  (function(){for(var i=0;i<CHIPS.length;i++){(function(id){
    var b=document.createElement('button');b.type='button';b.className='pg-chip';b.textContent=LABELS[id]||id;
    b.addEventListener('click',function(){flow=null;lastUser=LABELS[id];bubble(LABELS[id],'user');doTopic(id);focusInput();});
    chipsWrap.appendChild(b);
  })(CHIPS[i]);}})();
  /* הכפתור שנשאר גלוי כשהסרגל מכווץ. הוא לא מריץ נושא, הוא רק פורש את הסרגל בחזרה,
     כלומר יציאה מהזרימה בלחיצה אחת בלי לאבד את השיחה. */
  (function(){
    var b=document.createElement('button');b.type='button';b.className='pg-chip pg-chip-more';
    b.textContent='שאלה אחרת';
    b.addEventListener('click',function(){if(panel)panel.classList.remove('sug-on');focusInput();});
    chipsWrap.appendChild(b);
  })();

  var wrap=document.getElementById('pgFabWrap'), suppressClick=false;
  function isMobile(){return window.matchMedia('(max-width:820px)').matches;}
  function positionPanel(){
    /* clear any stale inline positioning so the panel follows its CSS: above the button on the left (desktop), bottom sheet (mobile) */
    panel.style.left='';panel.style.top='';panel.style.right='';panel.style.bottom='';panel.style.insetInlineEnd='';panel.style.insetBlockEnd='';
  }
  var dn=false,mv=false,sx=0,sy=0,pid=null,bl=0,bt=0,bw=0,bh=0,curX=0,curY=0,raf=0;
  function applyTransform(){raf=0;wrap.style.transform='translate3d('+curX+'px,'+curY+'px,0)';if(panel.classList.contains('open'))positionPanel();}
  fab.addEventListener('pointerdown',function(e){
    if(typeof e.button==='number'&&e.button!==0)return;
    dn=true;mv=false;sx=e.clientX;sy=e.clientY;pid=e.pointerId;
    var r=wrap.getBoundingClientRect();bl=r.left;bt=r.top;bw=r.width;bh=r.height;
    try{fab.setPointerCapture(pid);}catch(_){}
  });
  fab.addEventListener('pointermove',function(e){
    if(!dn)return;
    var dx=e.clientX-sx,dy=e.clientY-sy;
    if(!mv&&(Math.abs(dx)+Math.abs(dy))>4){mv=true;wrap.classList.add('dragging');wrap.style.willChange='transform';}
    if(mv){
      var m=8;
      curX=Math.min(window.innerWidth-bw-m,Math.max(m,bl+dx))-bl;
      curY=Math.min(window.innerHeight-bh-m,Math.max(m,bt+dy))-bt;
      if(!raf)raf=requestAnimationFrame(applyTransform);
      if(e.cancelable)e.preventDefault();
    }
  });
  function endDrag(){
    if(!dn)return;dn=false;
    try{fab.releasePointerCapture(pid);}catch(_){}
    if(raf){cancelAnimationFrame(raf);raf=0;}
    if(mv){
      mv=false;wrap.classList.remove('dragging');
      var r=wrap.getBoundingClientRect();
      wrap.style.transform='';wrap.style.willChange='';
      wrap.style.left=r.left+'px';wrap.style.top=r.top+'px';wrap.style.right='auto';wrap.style.bottom='auto';wrap.style.insetInlineEnd='auto';wrap.style.insetBlockEnd='auto';
      suppressClick=true;setTimeout(function(){suppressClick=false;},60);
    }
  }
  fab.addEventListener('pointerup',endDrag);
  fab.addEventListener('pointercancel',endDrag);
  var lbl=document.getElementById('pgFabLabel');
  if(lbl)lbl.addEventListener('click',function(){if(!panel.classList.contains('open'))openChat();});

  function focusInput(){try{if(matchMedia('(pointer:fine)').matches)input.focus();}catch(e){}}
  function openChat(){
    positionPanel();
    loadFacts();loadContent();
    panel.removeAttribute('inert');panel.classList.add('open');fab.classList.add('open');wrap.classList.add('chat-open');fab.setAttribute('aria-expanded','true');
    if(!opened){opened=true;track('chat_open',{open:openNow()});var gm=greetWord()+'! אני העוזר הדיגיטלי של פון גת. '+(openNow()?'איך אפשר לעזור?':'אנחנו סגורים כרגע (א-ה 9:00-18:30, ו 9:00-13:00), אבל אפשר לשאול אותי או להשאיר פרטים ונחזור אליכם.');botReply(gm,{sug:['repair','buy','callback']});}
    setTimeout(function(){focusInput();},300);
  }
  function closeChat(){panel.classList.remove('open');fab.classList.remove('open');wrap.classList.remove('chat-open');fab.setAttribute('aria-expanded','false');panel.setAttribute('inert','');}
  fab.addEventListener('click',function(){if(suppressClick){suppressClick=false;return;}panel.classList.contains('open')?closeChat():openChat();});
  closeBtn.addEventListener('click',function(){closeChat();fab.focus();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&panel.classList.contains('open')){closeChat();fab.focus();}});
  sendBtn.addEventListener('click',function(){handle(input.value);input.value='';input.focus();});
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();handle(input.value);input.value='';}});
  window.addEventListener('resize',function(){if(panel.classList.contains('open'))positionPanel();});
})();
/* bot:js:end */
