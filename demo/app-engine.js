/* PVPT connected-domain interaction layer.
   Public catalogue facts are sourced; all operational fixtures stay DEMO_SYNTHETIC.
   This browser prototype persists only in this browser, not in an enterprise database. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const DATA_CLASS={PUBLIC_VERIFIED:'مرجع عمومی',INTERNAL_VERIFIED:'داده داخلی تأییدشده',USER_APPROVED_ASSUMPTION:'فرض تأییدشده کاربر',DEMO_SYNTHETIC:'سناریوی ساختگی دمو',UNKNOWN:'نامشخص'};
const KEYS=['home','decisions','projects','portfolio','issues','solutions','risk','interventions','resources','memory','sources'];
const LABELS_FA={home:'نمای مدیرعامل',decisions:'فرصت‌های تصمیم',projects:'پروژه، تعهد و تولید',portfolio:'سبد محصولات',issues:'مدیریت چالش',solutions:'راهکارها',risk:'نقشه ارزش و ریسک',interventions:'فرصت‌های مداخله',resources:'منابع و ظرفیت‌ها',memory:'حافظه تصمیم و نتایج',sources:'تنظیمات و منشأ داده'};
const LABELS_EN={home:'CEO Cockpit',decisions:'Decision Queue',projects:'Projects & Commitments',portfolio:'Product Portfolio',issues:'Issues',solutions:'Solutions',risk:'Risk & Value Map',interventions:'Intervention Windows',resources:'Resources & Capacity',memory:'Knowledge & Memory',sources:'Settings & Data Provenance'};
let LABELS={...LABELS_FA};
const SUBS={
home:[['overview','نمای کلان'],['priority','تصمیم‌های ضروری']],
decisions:[['queue','صف تصمیم'],['cases','پرونده‌ها و گزینه‌ها'],['council','شورای مدیران'],['register','ثبت تصمیم']],
projects:[['projects','پروژه‌ها'],['commitments','تعهدات'],['milestones','نقاط عطف'],['chain','زنجیره تعهد'],['bom','BOM و Cell'],['routing','مسیر و فعالیت'],['orders','سفارش و اجرا']],
portfolio:[['families','خانواده‌های محصول'],['catalog','کاتالوگ محصول'],['assignments','ارتباط محصول و پروژه']],
issues:[['overview','نمای کلان چالش‌ها'],['active','چالش‌های فعال و بحرانی'],['bottlenecks','گلوگاه‌های ۵M و مالی'],['register','ثبت چالش جدید']],
solutions:[['overview','نمای کلان راهکارها'],['pipeline','صف بررسی و تصویب'],['approved','مصوبات فعال'],['impact','ارزش حفاظت‌شده و کارایی'],['register','پیشنهاد راهکار جدید']],
risk:[['map','نقشه ارزش و ریسک'],['issues','ایشوها'],['impact','زنجیره اثر'],['conflicts','تعارض منابع'],['evidence','شواهد و یکپارچگی']],
interventions:[['windows','پنجره‌های مداخله'],['compare','مقایسه گزینه‌ها'],['simulate','آزمایش سناریو']],
resources:[['overview','نمای منابع'],['materials','متریال و قطعات'],['machines','ماشین‌آلات'],['labor','نیروی انسانی و مهارت'],['capacity','ظرفیت و بارگذاری'],['suppliers','تأمین‌کنندگان'],['cash','نقدینگی و محدودیت مالی']],
memory:[['decisions','حافظه تصمیم'],['outcomes','نتایج واقعی'],['lessons','درس‌آموخته‌ها'],['indicators','شاخص‌های مدیریتی'],['trend','روند ارزش در معرض ریسک']],
sources:[['readiness','آمادگی داده و تنظیمات (Theme & Language)'],['config','پیکربندی مدل و تم'],['provenance','منشأ داده و تأییدها'],['assumptions','فرضیات تأییدشده'],['registry','کاتالوگ منابع'],['access','نقش‌ها و دسترسی']]
};
const KEY='pvpt-interactive-workspace-v1';
let db={issues:[],solutions:[],resources:[],projects:[],commitments:[],catalogResources:[],suppliers:[],sources:[],decisions:[],outcomes:[],lessons:[],assumptions:[],events:[],selectedProject:'',selectedProduct:'',selectedScenario:'part',activeFilter:null};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object')db={...db,...saved,activeFilter:null};}catch(e){}
let catalog={families:[],products:[],assignments:[],projects:[],commitments:[],components:[],orders:[],operations:[],resources:[],suppliers:[],issues:[]};
let currentPage='home',currentView='overview';
const officialUrl='https://mapnagenerator.com/Fa/Products';
const seedProducts=[
 {product_id:'PUB-THERMAL-MGG72-SH2',family_id:'THERMAL_GENERATORS',name:'MGG72-SH2',data_class:'PUBLIC_VERIFIED',source_reference:officialUrl},
 {product_id:'PUB-HYDRO-MGH61-SA32',family_id:'HYDRO_GENERATORS',name:'MGH61-SA32',data_class:'PUBLIC_VERIFIED',source_reference:officialUrl},
 {product_id:'PUB-WIND-MWT2.5-103-G-I',family_id:'WIND_TURBINES',name:'MWT2.5-103-G-I',data_class:'PUBLIC_VERIFIED',source_reference:officialUrl}
];
const seedFamilies=[
 ['THERMAL_GENERATORS','ژنراتورهای حرارتی'],['HYDRO_GENERATORS','ژنراتورهای برق‌آبی'],['WIND_TURBINES','توربین‌های بادی'],['INDUSTRIAL_GENERATORS','ژنراتورهای صنعتی'],['MOTORS','موتورها'],['BUSDuct','باس‌داکت']
].map(([family_id,label_fa],i)=>({family_id,label_fa,display_order:i+1,data_class:'PUBLIC_VERIFIED'}));

/* Canonical CEO Cockpit Executive Scenario Dataset (DEMO_SYNTHETIC — synchronized across Home Page and all 8 operational menus) */
const ceoProjects=[
 {project_id:'P-1405',legacy_id:'PRJ-DEMO-101',project_name:'پروژه P-1405 · ژنراتور نیروگاهی ۳۲۵ مگاوات (MGG72-SH2)',family_id:'THERMAL_GENERATORS',product_id:'PUB-THERMAL-MGG72-SH2',progress:68,status_code:'CRITICAL',status_fa:'بحرانی',var_billion:1200,days_to_pnr:5,customer_at_risk:true,cash_delay_billion:680,margin_at_risk:true,decision_id:'1',scenario_key:'part',issue_summary:'تأخیر ۱۸ روزه تأمین قطعه بحرانی (C-117 / DEMO-COMP-17)',data_class:'DEMO_SYNTHETIC'},
 {project_id:'P-1398',legacy_id:'PRJ-DEMO-102',project_name:'پروژه P-1398 · ژنراتور صنعتی و ایستگاه آزمون مشترک',family_id:'INDUSTRIAL_GENERATORS',product_id:'PUB-IND-GEN-01',progress:55,status_code:'CRITICAL',status_fa:'بحرانی',var_billion:850,days_to_pnr:12,customer_at_risk:true,cash_delay_billion:500,margin_at_risk:true,decision_id:'2',scenario_key:'capacity',issue_summary:'تعارض ظرفیت ایستگاه آزمون مشترک (کسری ۶ ساعت بین دو پروژه)',data_class:'DEMO_SYNTHETIC'},
 {project_id:'P-1412',legacy_id:'PRJ-DEMO-103',project_name:'پروژه P-1412 · توربین بادی ۲.۵ مگاوات (MWT2.5-103-G-I)',family_id:'WIND_TURBINES',product_id:'PUB-WIND-MWT2.5-103-G-I',progress:42,status_code:'HIGH_RISK',status_fa:'پرریسک',var_billion:600,days_to_pnr:28,customer_at_risk:true,cash_delay_billion:0,margin_at_risk:false,decision_id:'',scenario_key:'',issue_summary:'تغییر طراحی ناسل و نیاز به ارزیابی اثر بر BOM، زمان و هزینه',data_class:'DEMO_SYNTHETIC'},
 {project_id:'P-1395',legacy_id:'PRJ-DEMO-104',project_name:'پروژه P-1395 · ژنراتور نیروگاهی سیکل ترکیبی (MGG63-SA2)',family_id:'THERMAL_GENERATORS',product_id:'PUB-THERMAL-MGG63-SA2',progress:75,status_code:'HIGH_RISK',status_fa:'پرریسک',var_billion:400,days_to_pnr:35,customer_at_risk:false,cash_delay_billion:0,margin_at_risk:false,decision_id:'',scenario_key:'',issue_summary:'وصول مرحله‌ای قرارداد مطابق برنامه؛ نیازمند پایش زنجیره تأمین رتور',data_class:'DEMO_SYNTHETIC'},
 {project_id:'P-1401',legacy_id:'PRJ-DEMO-105',project_name:'پروژه P-1401 · بازتوانی و خدمات ژنراتور برق‌آبی (MGH61-SA32)',family_id:'HYDRO_GENERATORS',product_id:'PUB-HYDRO-MGH61-SA32',progress:60,status_code:'ATTENTION',status_fa:'نیازمند توجه',var_billion:230,days_to_pnr:55,customer_at_risk:false,cash_delay_billion:0,margin_at_risk:false,decision_id:'',scenario_key:'',issue_summary:'پایش برنامه تعمیرات و بازتوانی استاتور برق‌آبی',data_class:'DEMO_SYNTHETIC'}
];
const ceoCommitments=[
 {commitment_id:'COM-P1405-DEL',project_id:'P-1405',type:'CUSTOMER_DELIVERY',commitment_type:'تحویل نهایی ژنراتور ۳۲۵ مگاوات به کارفرما',due_date:'1404/02/15 (۵ روز تا نقطه غیرقابل بازگشت)',var_billion:1200,status_code:'CUSTOMER_AT_RISK',status_fa:'در معرض خطر (بحرانی)',data_class:'DEMO_SYNTHETIC'},
 {commitment_id:'COM-P1398-TEST',project_id:'P-1398',type:'CUSTOMER_DELIVERY',commitment_type:'تحویل و گواهی آزمون کارخانه‌ای (FAT) دو مشتری',due_date:'1404/02/22 (۱۲ روز تا نقطه غیرقابل بازگشت)',var_billion:850,status_code:'CUSTOMER_AT_RISK',status_fa:'در معرض خطر (تعارض ظرفیت)',data_class:'DEMO_SYNTHETIC'},
 {commitment_id:'COM-P1412-DEL',project_id:'P-1412',type:'CUSTOMER_DELIVERY',commitment_type:'تحویل مجموعه ناسل و هاب توربین بادی ۲.۵ مگاوات',due_date:'1404/03/10 (۲۸ روز تا نقطه غیرقابل بازگشت)',var_billion:600,status_code:'CUSTOMER_AT_RISK',status_fa:'در معرض خطر (تغییر طراحی)',data_class:'DEMO_SYNTHETIC'},
 {commitment_id:'COM-P1395-MS3',project_id:'P-1395',type:'MILESTONE_PAYMENT',commitment_type:'نقطه عطف مونتاژ رتور و وصول مرحله سوم',due_date:'1404/03/18 (۳۵ روز)',var_billion:400,status_code:'AT_RISK',status_fa:'پایش ویژه (وصول مطابق برنامه)',data_class:'DEMO_SYNTHETIC'},
 {commitment_id:'COM-P1401-SRV',project_id:'P-1401',type:'SERVICE_OVERHAUL',commitment_type:'تحویل بخش بازتوانی‌شده ژنراتور آبی',due_date:'1404/04/08 (۵۵ روز)',var_billion:230,status_code:'ATTENTION',status_fa:'نیازمند توجه',data_class:'DEMO_SYNTHETIC'}
];
const ceoCashStages=[
 {stage_id:'CASH-P1405-M4',project_id:'P-1405',title:'مرحله وصول چهارم (پس از تکمیل مونتاژ و آزمون استاتور P-1405)',amount_billion:680,status_fa:'در معرض تأخیر (وابسته به قطعه DEMO-COMP-17)',delay_risk:'۱۸ روز تأخیر احتمالی در صورت عدم تسریع خرید',data_class:'DEMO_SYNTHETIC'},
 {stage_id:'CASH-P1398-FAT',project_id:'P-1398',title:'مرحله وصول گواهی آزمون نهایی (FAT پروژه P-1398)',amount_billion:500,status_fa:'در معرض تأخیر (وابسته به رفع تعارض ایستگاه آزمون)',delay_risk:'تأخیر در صورت عدم تصویب اضافه‌کاری یا آزمون بیرونی',data_class:'DEMO_SYNTHETIC'},
 {stage_id:'CASH-P1395-M3',project_id:'P-1395',title:'وصول مرحله‌ای قرارداد پروژه P-1395',amount_billion:320,status_fa:'وصول‌شده / مطابق برنامه',delay_risk:'بدون تأخیر (ثبت در آخرین تحولات)',data_class:'DEMO_SYNTHETIC'}
];
const ceoIssues=[
 {id:'ISS-P1405-01',project_id:'P-1405',title:'به‌روزرسانی تعهد تأمین‌کننده پروژه P-1405: تأخیر ۱۸ روزه قطعه بحرانی C-117',type:'MATERIAL',object:'پروژه P-1405 / Cell استاتور / قطعه C-117',severity:'HIGH',var_billion:1200,days_to_pnr:5,time_ago:'۲ ساعت پیش',data_class:'DEMO_SYNTHETIC'},
 {id:'ISS-P1398-02',project_id:'P-1398',title:'گزارش آزمون میانی پروژه P-1398: کسری ۶ ساعت در ایستگاه آزمون مشترک MACH-TEST-01',type:'MACHINE',object:'پروژه P-1398 / ایستگاه آزمون مشترک',severity:'HIGH',var_billion:850,days_to_pnr:12,time_ago:'۴ ساعت پیش',data_class:'DEMO_SYNTHETIC'},
 {id:'ISS-P1412-03',project_id:'P-1412',title:'تغییر طراحی پروژه P-1412: نیاز به ارزیابی اثر بر BOM، زمان و هزینه',type:'METHOD',object:'پروژه P-1412 / BOM مونتاژ هاب و ناسل',severity:'MEDIUM',var_billion:600,days_to_pnr:28,time_ago:'۱ روز پیش',data_class:'DEMO_SYNTHETIC'},
 {id:'ISS-P1401-04',project_id:'P-1401',title:'ریسک تداخل برنامه بازتوانی و خدمات ژنراتور آبی P-1401',type:'MANPOWER',object:'پروژه P-1401 / تیم سیم‌پیچی و خدمات',severity:'MEDIUM',var_billion:230,days_to_pnr:55,time_ago:'۲ روز پیش',data_class:'DEMO_SYNTHETIC'}
];

const ceoDetailedIssues=[
 {id:'ISS-1405-01',project_id:'P-1405',title:'تأخیر ۱۸ روزه تأمین قطعه بحرانی C-117 (پروژه P-1405)',type:'MATERIAL',type_fa:'متریال و قطعات',severity:'CRITICAL',var_billion:1200,wip_cost_million:36,copq_million:120,treasury_lag_days:14,days_to_pnr:5,status:'OPEN',status_fa:'باز / در دست پیگیری',description:'ارزیابی سه‌گانه (سند انبار + لوگ برق ماشین + تلمتری جرثقیل) توقف مونتاژ استاتور به دلیل کسری قطعه C-117 را اثبات کرده است.',data_class:'DEMO_SYNTHETIC',created_at:'امروز ۱۰:۱۵'},
 {id:'ISS-1398-02',project_id:'P-1398',title:'کسری ۶ ساعت ظرفیت در ایستگاه آزمون مشترک MACH-TEST-01 (پروژه P-1398)',type:'MACHINE',type_fa:'ماشین‌آلات و ایستگاه کاری',severity:'CRITICAL',var_billion:850,wip_cost_million:25.5,copq_million:80,treasury_lag_days:21,days_to_pnr:12,status:'OPEN',status_fa:'باز / در دست پیگیری',description:'تعارض ظرفیت تست FAT بین پروژه‌های P-1398 و P-1405 در ایستگاه آزمون مشترک؛ خطر جریمه دیرکرد مشتری.',data_class:'DEMO_SYNTHETIC',created_at:'امروز ۰۸:۳۰'},
 {id:'ISS-1412-03',project_id:'P-1412',title:'تغییر انحراف طراحی ناسل و هاب توربین بادی ۲.۵ مگاوات (پروژه P-1412)',type:'METHOD',type_fa:'روش و مهندسی',severity:'HIGH',var_billion:600,wip_cost_million:18,copq_million:150,treasury_lag_days:7,days_to_pnr:28,status:'SOLUTION_PROPOSED',status_fa:'راهکار پیشنهادی',description:'نیاز به اصلاح نقشه مونتاژ و ابلاغ تغییر BOM بدون ایجاد ریسک کانبیلیزیشن.',data_class:'DEMO_SYNTHETIC',created_at:'دیروز ۱۴:۲۰'},
 {id:'ISS-1401-04',project_id:'P-1401',title:'تأخیر تخصیص نقدینگی و اصطکاک خزانه در بستر بازتوانی ژنراتور (پروژه P-1401)',type:'TREASURY',type_fa:'نقدینگی و اصطکاک خزانه',severity:'MEDIUM',var_billion:230,wip_cost_million:6.9,copq_million:40,treasury_lag_days:28,days_to_pnr:55,status:'SOLUTION_PROPOSED',status_fa:'راهکار پیشنهادی',description:'فاصله ۲۸ روزه بین تأیید فنی صورت‌وضعیت و تخصیص واقعی نقدینگی از سوی خزانه گروه.',data_class:'DEMO_SYNTHETIC',created_at:'۲ روز پیش'}
];

const ceoDetailedSolutions=[
 {id:'SOL-1405-A',issue_id:'ISS-1405-01',project_id:'P-1405',title:'تأمین تسریع‌شده قطعه C-117 با تخصیص بودجه فرعی ۱۸۰ م.ت',strategy_type:'EXPEDITE_PROCUREMENT',strategy_fa:'خرید فوری و تسریع تأمین',feasibility:'FEASIBLE',feasibility_fa:'امکان‌پذیر (شدنی)',cost_million:180,exec_days:2,protected_var_billion:1200,saved_wip_million:36,status:'APPROVED',status_fa:'مصوب مدیرعامل / در حال اجرا',owner:'مدیرعامل / مدیر تأمین',approved_at:'۱۴۰۳/۰۹/۲۷',note:'زمان تحویل ۲ روزه داخل پنجره ۵ روزه LRM است؛ سقف فرضی هزینه ۱۸۰ م.ت در برابر بودجه ۲۰۰ م.ت تأیید شد.',cannibalization_checked:true,data_class:'DEMO_SYNTHETIC'},
 {id:'SOL-1398-B',issue_id:'ISS-1398-02',project_id:'P-1398',title:'اجرای شیفت اضافه‌کاری ۶ ساعته ایستگاه آزمون MACH-TEST-01',strategy_type:'CAPACITY_OVERTIME',strategy_fa:'افزایش ظرفیت با اضافه‌کاری',feasibility:'FEASIBLE',feasibility_fa:'امکان‌پذیر (شدنی)',cost_million:90,exec_days:2,protected_var_billion:850,saved_wip_million:25.5,status:'APPROVED',status_fa:'مصوب مدیرعامل / در حال اجرا',owner:'مدیر کارخانه / مدیر پروژه P-1398',approved_at:'۱۴۰۳/۰۹/۲۶',note:'پوشش کامل کسری ۶ ساعته با هزینه‌ای کمتر از بودجه ۱۵۰ م.ت.',cannibalization_checked:true,data_class:'DEMO_SYNTHETIC'},
 {id:'SOL-1412-C',issue_id:'ISS-1412-03',project_id:'P-1412',title:'انتقال مشروط متریال از پروژه اهداکننده P-1395 پس از تایید ۱۰۰٪ متالورژی',strategy_type:'MATERIAL_BORROW',strategy_fa:'استقراض متریال بین پروژه‌ای (Guardrail Cannibalization)',feasibility:'CONDITIONAL',feasibility_fa:'مشروط به تایید گواهی',cost_million:45,exec_days:3,protected_var_billion:600,saved_wip_million:18,status:'PROPOSED',status_fa:'در انتظار بررسی و تصویب',owner:'کمیته فنی و مهندسی',approved_at:'—',note:'شرط عدم کانبیلیزیشن: تطابق ۱۰۰٪ گواهی متالورژی + سفارش جایگزین ثبت‌شده در حاشیه ایمنی LRM پروژه اهداکننده P-1395.',cannibalization_checked:true,data_class:'DEMO_SYNTHETIC'}
];

const scenarios={
 part:{id:'DEMO-01',project_id:'P-1405',title:'کمبود قطعه بحرانی (پروژه P-1405)',class:'DEMO_SYNTHETIC',need:'۲ قطعه در پنجره ۳ روزه (۵ روز تا نقطه غیرقابل بازگشت پروژه P-1405)',constraint:'موجودی آزاد ۰؛ زمان عادی تأمین ۸ روز؛ گزینه تسریع ۲ روز و ۱۸۰ میلیون تومان در برابر بودجه فرضی ۲۰۰ میلیون تومان.',options:[{id:'expedite',name:'تأمین تسریع‌شده',time:2,cost:180,cap:'۲ قطعه',ok:true,detail:'از نظر زمان و سقف فرضی هزینه عبور می‌کند؛ تأیید تأمین‌کننده، کیفیت و تاریخ تحویل هنوز لازم است.'},{id:'borrow',name:'انتقال از پروژه دیگر',time:0,cost:0,cap:'۲ قطعه',ok:false,detail:'تعهد پروژه دیگر را ۵ روز جابه‌جا می‌کند؛ بدون تغییر رسمی تعهد، ناشدنی است.'},{id:'substitute',name:'قطعه جایگزین مهندسی',time:6,cost:90,cap:'۲ قطعه',ok:false,detail:'اعتبارسنجی ۶ روزه از پنجره نیاز ۳ روزه بیشتر است.'}]},
 capacity:{id:'DEMO-02',project_id:'P-1398',title:'تعارض ظرفیت ایستگاه آزمون (پروژه P-1398)',class:'DEMO_SYNTHETIC',need:'تقاضا ۲۲ ساعت؛ ظرفیت مشترک ۱۶ ساعت (۱۲ روز تا نقطه غیرقابل بازگشت پروژه P-1398)',constraint:'کسری ظرفیت ۶ ساعت؛ سقف اضافه‌کاری ۸ ساعت و بودجه فرضی ۱۵۰ میلیون تومان.',options:[{id:'overtime',name:'اضافه‌کاری ایستگاه',time:2,cost:90,cap:'۸ ساعت افزوده',ok:true,detail:'ظرفیت افزوده ۸ ساعت کسری ۶ ساعت را می‌پوشاند؛ هزینه ۹۰ در سقف فرضی ۱۵۰ است.'},{id:'external',name:'آزمون بیرونی',time:3,cost:140,cap:'۱۰ ساعت',ok:true,detail:'از نظر ظرفیت، زمان و بودجه فرضی قابل‌بررسی است؛ صلاحیت پیمانکار و رزرو باید تأیید شوند.'},{id:'deferA',name:'تعویق پروژه A',time:5,cost:35,cap:'آزادسازی پنجره',ok:false,detail:'تعهد پروژه A را ۵ روز نقض می‌کند؛ فقط با تغییر رسمی موعد قابل بررسی مجدد است.'}]}
};

/* =========================================================================
   COMPANY 1404 MASTER COMMITMENTS & DETAILED PROJECT TABLES
   Exact match to user-supplied Section 2, Section 3 (الف–ز) & Thermal Busducts
   ========================================================================= */
const company1404Meta={
 title_fa:'۲. برنامه کلان تعهدات شرکت در سال ۱۴۰۴',
 title_en:'2. Company Macro Commitments Plan — Year 1404',
 detailed_title_fa:'۳. جداول تفصیلی پروژه‌های سال ۱۴۰۴',
 detailed_title_en:'3. Detailed Company Project Schedules — Year 1404',
 signatories_fa:'امضاکنندگان ذیل صفحه ۴: سرپرست مدیریت برنامه‌ریزی و کنترل تعهدات: بهنام گودرزی / معاونت برنامه‌ریزی و پروژه‌ها: حمیدرضا مقیم بگلو / مدیریت عامل: محمدرضا شاکری',
 signatories_en:'Signatories (Page 4 of 7): Head of Planning & Commitment Control: Behnam Goodarzi / VP Planning & Projects: Hamidreza Moghim Baglou / CEO: Mohammadreza Shakeri',
 data_class:'INTERNAL_VERIFIED'
};

const company1404MacroPlan=[
 {row:'1',product_fa:'ژنراتور گاز 185 مگاوات',product_en:'Gas Generator 185 MW',sub_fa:'',sub_en:'',code:'MGG58-SA2',annual_plan:'9 واحد',annual_plan_en:'9 Units',family_id:'THERMAL_GENERATORS',months:['-','205','206','-','207','-','208','209','210','211','212','213']},
 {row:'2',product_fa:'ژنراتور گاز 50 مگاوات',product_en:'Gas Generator 50 MW',sub_fa:'',sub_en:'',code:'MGG42-SA2',annual_plan:'7 واحد',annual_plan_en:'7 Units',family_id:'INDUSTRIAL_GENERATORS',months:['-','-','-','06','-','07','-','08','09','10','11','12']},
 {row:'3',product_fa:'ژنراتور گاز 25 مگاوات (4 شاسی)',product_en:'Gas Generator 25 MW (4-Chassis)',sub_fa:'',sub_en:'',code:'MGG33-SA2',annual_plan:'4 واحد',annual_plan_en:'4 Units',family_id:'INDUSTRIAL_GENERATORS',months:['08','-','09','-','-','10','-','-','-','11','-','-']},
 {row:'4',product_fa:'ژنراتور بخار 200 مگاوات',product_en:'Steam Generator 200 MW',sub_fa:'',sub_en:'',code:'MGS58-SA2',annual_plan:'10 واحد',annual_plan_en:'10 Units',family_id:'THERMAL_GENERATORS',months:['-','-','05','06','07','08','09','10','11','12','13','14']},
 {row:'5',product_fa:'ژنراتور 185 مگاوات TX',product_en:'Generator 185 MW TX',sub_fa:'',sub_en:'',code:'MGS56-SA2',annual_plan:'2 واحد',annual_plan_en:'2 Units',family_id:'THERMAL_GENERATORS',months:['-','-','-','-','-','03','-','04','-','-','-','-']},
 {row:'6',product_fa:'ژنراتور بخار 376 مگاوات',product_en:'Steam Generator 376 MW',sub_fa:'',sub_en:'',code:'MGS72-SH2',annual_plan:'1 واحد',annual_plan_en:'1 Unit',family_id:'THERMAL_GENERATORS',months:['-','-','-','-','-','-','-','-','-','-','-','02']},
 {row:'7',product_fa:'ژنراتور گاز 238 مگاوات',product_en:'Gas Generator 238 MW',sub_fa:'',sub_en:'',code:'MGG63-SA2',annual_plan:'1 واحد',annual_plan_en:'1 Unit',family_id:'THERMAL_GENERATORS',months:['-','-','-','-','-','-','-','-','-','-','-','02']},
 {row:'8',product_fa:'توربین بادی 2.5 مگاوات',product_en:'Wind Turbine 2.5 MW',sub_fa:'هاب و ناسل',sub_en:'Hub & Nacelle',code:'—',annual_plan:'10 واحد',annual_plan_en:'10 Units',family_id:'WIND_TURBINES',months:['-','72','73','74','75','76','77','78','79','80','81','-']},
 {row:'8',product_fa:'توربین بادی 2.5 مگاوات',product_en:'Wind Turbine 2.5 MW',sub_fa:'پره',sub_en:'Blade',code:'—',annual_plan:'10 واحد',annual_plan_en:'10 Units',family_id:'WIND_TURBINES',months:['-','-','81','82','83','84','85','86','87','88','89','90']},
 {row:'8',product_fa:'توربین بادی 2.5 مگاوات',product_en:'Wind Turbine 2.5 MW',sub_fa:'گیربکس',sub_en:'Gearbox',code:'—',annual_plan:'10 واحد',annual_plan_en:'10 Units',family_id:'WIND_TURBINES',months:['-','80','81','82','83','84','85','86','87','88','89','-']},
 {row:'8',product_fa:'توربین بادی 2.5 مگاوات',product_en:'Wind Turbine 2.5 MW',sub_fa:'تاور',sub_en:'Tower',code:'—',annual_plan:'10 واحد',annual_plan_en:'10 Units',family_id:'WIND_TURBINES',months:['-','69','70','71','72','73','74','75','76','77','78','-']},
 {row:'9',product_fa:'باسداکت',product_en:'Busduct',sub_fa:'185 مگاوات',sub_en:'185 MW',code:'—',annual_plan:'4 واحد',annual_plan_en:'4 Units',family_id:'BUSDuct',months:['-','01، 02','-','-','03','-','04','-','-','-','-','-']},
 {row:'9',product_fa:'باسداکت',product_en:'Busduct',sub_fa:'200 مگاوات',sub_en:'200 MW',code:'—',annual_plan:'4 واحد',annual_plan_en:'4 Units',family_id:'BUSDuct',months:['-','-','-','-','-','01','-','-','02','-','03','04']},
 {row:'9',product_fa:'باسداکت',product_en:'Busduct',sub_fa:'50 مگاوات',sub_en:'50 MW',code:'—',annual_plan:'6 واحد',annual_plan_en:'6 Units',family_id:'BUSDuct',months:['-','-','01','02، 03','-','04','05','06','-','-','-','-']},
 {row:'9',product_fa:'باسداکت',product_en:'Busduct',sub_fa:'185 مگاوات TX',sub_en:'185 MW TX',code:'—',annual_plan:'2 واحد',annual_plan_en:'2 Units',family_id:'BUSDuct',months:['-','-','-','-','-','-','-','01','-','02','-','-']},
 {row:'9',product_fa:'باسداکت',product_en:'Busduct',sub_fa:'238 مگاوات',sub_en:'238 MW',code:'—',annual_plan:'1 واحد',annual_plan_en:'1 Unit',family_id:'BUSDuct',months:['-','-','-','-','-','-','-','-','01','-','-','-']}
];

const company1404Groups=[
 {key:'A',code_fa:'الف',title_fa:'الف) ژنراتور گاز 185 مگاوات',title_en:'A) Gas Generator 185 MW',family_id:'THERMAL_GENERATORS',page_fa:'',page_en:''},
 {key:'B',code_fa:'ب',title_fa:'ب) ژنراتور گاز 50 مگاوات (صفحه ۴ از ۷)',title_en:'B) Gas Generator 50 MW (Page 4 of 7)',family_id:'INDUSTRIAL_GENERATORS',page_fa:'صفحه ۴ از ۷',page_en:'Page 4 of 7'},
 {key:'C',code_fa:'ج',title_fa:'ج) ژنراتور گاز 25 مگاوات 4 شاسی (صفحه ۴ از ۷)',title_en:'C) Gas Generator 25 MW 4-Chassis (Page 4 of 7)',family_id:'INDUSTRIAL_GENERATORS',page_fa:'صفحه ۴ از ۷',page_en:'Page 4 of 7'},
 {key:'D',code_fa:'د',title_fa:'د) ژنراتور بخار 200 مگاوات (صفحه ۵ از ۷)',title_en:'D) Steam Generator 200 MW (Page 5 of 7)',family_id:'THERMAL_GENERATORS',page_fa:'صفحه ۵ از ۷',page_en:'Page 5 of 7'},
 {key:'E',code_fa:'هـ',title_fa:'هـ) ژنراتور بخار 185 مگاوات – TX (صفحه ۶ از ۷)',title_en:'E) Steam Generator 185 MW – TX (Page 6 of 7)',family_id:'THERMAL_GENERATORS',page_fa:'صفحه ۶ از ۷',page_en:'Page 6 of 7'},
 {key:'F',code_fa:'و',title_fa:'و) ژنراتور بخار 376 مگاوات (صفحه ۶ از ۷)',title_en:'F) Steam Generator 376 MW (Page 6 of 7)',family_id:'THERMAL_GENERATORS',page_fa:'صفحه ۶ از ۷',page_en:'Page 6 of 7'},
 {key:'G',code_fa:'ز',title_fa:'ز) ژنراتور گاز 238 مگاوات (صفحه ۶ از ۷)',title_en:'G) Gas Generator 238 MW (Page 6 of 7)',family_id:'THERMAL_GENERATORS',page_fa:'صفحه ۶ از ۷',page_en:'Page 6 of 7'}
];

const company1404DetailedUnits=[
 // الف) ژنراتور گاز 185 مگاوات
 {group:'A',row:1,unit_no:'205',plant_fa:'سبزوار 2',plant_en:'Sabzevar 2',serial:'MGG58-SA2/205',need_date:'1404/02',note_fa:'استاتور ساخته شده است روتور در برنامه 1404',note_en:'Stator manufactured; Rotor in 1404 plan',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:2,unit_no:'206',plant_fa:'خرم آباد 4',plant_en:'Khorramabad 4',serial:'MGG58-SA2/206',need_date:'1404/03',note_fa:'استاتور ساخته شده است روتور در برنامه 1404',note_en:'Stator manufactured; Rotor in 1404 plan',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:3,unit_no:'207',plant_fa:'نکا 2',plant_en:'Neka 2',serial:'MGG58-SA2/207',need_date:'1404/05',note_fa:'استاتور ساخته شده است روتور در برنامه 1404',note_en:'Stator manufactured; Rotor in 1404 plan',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:4,unit_no:'208',plant_fa:'بهاباد 1',plant_en:'Bahabad 1',serial:'MGG58-SA2/208',need_date:'1404/07',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:5,unit_no:'209',plant_fa:'بهاباد 2',plant_en:'Bahabad 2',serial:'MGG58-SA2/209',need_date:'1404/08',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:6,unit_no:'210',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG58-SA2/210',need_date:'1404/09',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:7,unit_no:'211',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG58-SA2/211',need_date:'1404/10',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:8,unit_no:'212',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG58-SA2/212',need_date:'1404/11',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 {group:'A',row:9,unit_no:'213',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG58-SA2/213',need_date:'1404/12',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 185 مگاوات',category_en:'Gas Gen 185 MW'},
 // ب) ژنراتور گاز 50 مگاوات
 {group:'B',row:1,unit_no:'6',plant_fa:'ری 2',plant_en:'Rey 2',serial:'MGG41-SA2/006',need_date:'1404/04',note_fa:'استاتور ساخته شده است روتور در برنامه 1404',note_en:'Stator manufactured; Rotor in 1404 plan',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 {group:'B',row:2,unit_no:'7',plant_fa:'بیدبلند 1',plant_en:'Bidboland 1',serial:'MGG41-SA2/007',need_date:'1404/06',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 {group:'B',row:3,unit_no:'8',plant_fa:'دهدشت 1',plant_en:'Dehdasht 1',serial:'MGG41-SA2/008',need_date:'1404/08',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 {group:'B',row:4,unit_no:'9',plant_fa:'دهدشت 2',plant_en:'Dehdasht 2',serial:'MGG41-SA2/009',need_date:'1404/09',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 {group:'B',row:5,unit_no:'10',plant_fa:'بیدبلند 2',plant_en:'Bidboland 2',serial:'MGG41-SA2/010',need_date:'1404/10',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 {group:'B',row:6,unit_no:'11',plant_fa:'بید بلند 3',plant_en:'Bidboland 3',serial:'MGG41-SA2/011',need_date:'1404/11',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 {group:'B',row:7,unit_no:'12',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG41-SA2/012',need_date:'1404/12',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 50 مگاوات',category_en:'Gas Gen 50 MW'},
 // ج) ژنراتور گاز 25 مگاوات 4 شاسی
 {group:'C',row:1,unit_no:'8',plant_fa:'شمال EP - 1',plant_en:'Shomal EP - 1',serial:'MGG33-SA2/008',need_date:'1404/01',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 25 مگاوات (4 شاسی)',category_en:'Gas Gen 25 MW (4-Chassis)'},
 {group:'C',row:2,unit_no:'9',plant_fa:'شمال EP - 2',plant_en:'Shomal EP - 2',serial:'MGG33-SA2/009',need_date:'1404/03',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 25 مگاوات (4 شاسی)',category_en:'Gas Gen 25 MW (4-Chassis)'},
 {group:'C',row:3,unit_no:'10',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG33-SA2/010',need_date:'1404/06',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 25 مگاوات (4 شاسی)',category_en:'Gas Gen 25 MW (4-Chassis)'},
 {group:'C',row:4,unit_no:'11',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG33-SA2/011',need_date:'1404/10',note_fa:'-',note_en:'-',family_id:'INDUSTRIAL_GENERATORS',category_fa:'ژنراتور گاز 25 مگاوات (4 شاسی)',category_en:'Gas Gen 25 MW (4-Chassis)'},
 // د) ژنراتور بخار 200 مگاوات
 {group:'D',row:1,unit_no:'5',plant_fa:'الحیدریه',plant_en:'Al-Haidariya',serial:'MGS58-SA2/005',need_date:'1404/03',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:2,unit_no:'6',plant_fa:'سمنان 1',plant_en:'Semnan 1',serial:'MGS58-SA2/006',need_date:'1404/04',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:3,unit_no:'7',plant_fa:'سمنان 2',plant_en:'Semnan 2',serial:'MGS58-SA2/007',need_date:'1404/05',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:4,unit_no:'8',plant_fa:'سبزوار',plant_en:'Sabzevar',serial:'MGS58-SA2/008',need_date:'1404/06',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:5,unit_no:'9',plant_fa:'اردکان',plant_en:'Ardakan',serial:'MGS58-SA2/009',need_date:'1404/07',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:6,unit_no:'10',plant_fa:'خرمشهر 1',plant_en:'Khorramshahr 1',serial:'MGS58-SA2/010',need_date:'1404/08',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:7,unit_no:'11',plant_fa:'خرمشهر 2',plant_en:'Khorramshahr 2',serial:'MGS58-SA2/011',need_date:'1404/09',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:8,unit_no:'12',plant_fa:'خرمشهر 3',plant_en:'Khorramshahr 3',serial:'MGS58-SA2/012',need_date:'1404/10',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:9,unit_no:'13',plant_fa:'زاگرس 1',plant_en:'Zagros 1',serial:'MGS58-SA2/013',need_date:'1404/11',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 {group:'D',row:10,unit_no:'14',plant_fa:'زاگرس 2',plant_en:'Zagros 2',serial:'MGS58-SA2/014',need_date:'1404/12',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 200 مگاوات',category_en:'Steam Gen 200 MW'},
 // هـ) ژنراتور بخار 185 مگاوات – TX
 {group:'E',row:1,unit_no:'3',plant_fa:'علی آباد 1',plant_en:'Aliabad 1',serial:'MGS56-SA2/003',need_date:'1404/06',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 185 مگاوات – TX',category_en:'Steam Gen 185 MW TX'},
 {group:'E',row:2,unit_no:'4',plant_fa:'علی آباد 2',plant_en:'Aliabad 2',serial:'MGS56-SA2/004',need_date:'1404/08',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 185 مگاوات – TX',category_en:'Steam Gen 185 MW TX'},
 // و) ژنراتور بخار 376 مگاوات
 {group:'F',row:1,unit_no:'2',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGS72-SH2/002',need_date:'1404/12',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور بخار 376 مگاوات',category_en:'Steam Gen 376 MW'},
 // ز) ژنراتور گاز 238 مگاوات
 {group:'G',row:1,unit_no:'2',plant_fa:'بی نام',plant_en:'Unnamed',serial:'MGG63-SA2/002',need_date:'1404/12',note_fa:'-',note_en:'-',family_id:'THERMAL_GENERATORS',category_fa:'ژنراتور گاز 238 مگاوات',category_en:'Gas Gen 238 MW'}
];

const company1404Busducts=[
 {id:'BD-01',row:1,type_fa:'گاز 185 مگاوات',type_en:'Gas 185 MW',plant_fa:'نكاء 1',plant_en:'Neka 1',delivery_date:'1404/02',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-02',row:2,type_fa:'گاز 185 مگاوات',type_en:'Gas 185 MW',plant_fa:'مس خاتون آباد',plant_en:'Mes Khatoonabad',delivery_date:'1404/02',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-03',row:3,type_fa:'گاز 50 مگاوات',type_en:'Gas 50 MW',plant_fa:'مس سونگون',plant_en:'Mes Sungun',delivery_date:'1404/03',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-04',row:4,type_fa:'گاز 50 مگاوات',type_en:'Gas 50 MW',plant_fa:'مس سرچشمه',plant_en:'Mes Sarcheshmeh',delivery_date:'1404/04',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-05',row:5,type_fa:'گاز 50 مگاوات',type_en:'Gas 50 MW',plant_fa:'ری 2',plant_en:'Rey 2',delivery_date:'1404/04',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-06',row:6,type_fa:'گاز 185 مگاوات',type_en:'Gas 185 MW',plant_fa:'نكاء 2',plant_en:'Neka 2',delivery_date:'1404/05',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-07',row:7,type_fa:'بخار 200 مگاوات',type_en:'Steam 200 MW',plant_fa:'گل گهر',plant_en:'Gol Gohar',delivery_date:'1404/06',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-08',row:8,type_fa:'گاز 50 مگاوات',type_en:'Gas 50 MW',plant_fa:'بید بلند 1',plant_en:'Bidboland 1',delivery_date:'1404/06',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-09',row:9,type_fa:'گاز 185 مگاوات',type_en:'Gas 185 MW',plant_fa:'بهاباد 1',plant_en:'Bahabad 1',delivery_date:'1404/07',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-10',row:10,type_fa:'بخار 185 مگاوات TX',type_en:'Steam 185 MW TX',plant_fa:'علی آباد 1',plant_en:'Aliabad 1',delivery_date:'1404/08',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-11',row:11,type_fa:'گاز 50 مگاوات',type_en:'Gas 50 MW',plant_fa:'دهدشت 1',plant_en:'Dehdasht 1',delivery_date:'1404/08',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-12',row:12,type_fa:'بخار 238 مگاوات',type_en:'Steam 238 MW',plant_fa:'بعثت',plant_en:'Besat',delivery_date:'1404/09',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-13',row:13,type_fa:'گاز 50 مگاوات',type_en:'Gas 50 MW',plant_fa:'دهدشت 2',plant_en:'Dehdasht 2',delivery_date:'1404/09',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-14',row:14,type_fa:'بخار 200 مگاوات',type_en:'Steam 200 MW',plant_fa:'سمنان 1',plant_en:'Semnan 1',delivery_date:'1404/09',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-15',row:15,type_fa:'بخار 185 مگاوات TX',type_en:'Steam 185 MW TX',plant_fa:'علی آباد 2',plant_en:'Aliabad 2',delivery_date:'1404/10',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-16',row:16,type_fa:'بخار 200 مگاوات',type_en:'Steam 200 MW',plant_fa:'سمنان 2',plant_en:'Semnan 2',delivery_date:'1404/11',note_fa:'-',note_en:'-',family_id:'BUSDuct'},
 {id:'BD-17',row:17,type_fa:'بخار 200 مگاوات',type_en:'Steam 200 MW',plant_fa:'سبزوار',plant_en:'Sabzevar',delivery_date:'1404/12',note_fa:'-',note_en:'-',family_id:'BUSDuct'}
];

function save(){try{const copy={...db};delete copy.activeFilter;localStorage.setItem(KEY,JSON.stringify(copy));}catch(e){}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fa(v){return v===null||v===undefined||v===''?'—':Number(v).toLocaleString('fa-IR');}
function badge(text,kind='neutral'){return '<span class="app-badge '+kind+'">'+esc(text)+'</span>';}
function card(title,body,tag=''){return '<section class="app-card"><header class="app-card-head"><div><h3>'+title+'</h3></div>'+tag+'</header><div class="app-card-body">'+body+'</div></section>';}
function empty(title,desc,tag='DATA REQUIRED'){return '<div class="app-empty"><div class="app-empty-icon">⌁</div><strong>'+esc(title)+'</strong><p>'+esc(desc)+'</p>'+badge(tag,'warn')+'</div>';}
function table(headers,rows){return '<div class="app-table-wrap"><table class="app-table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">'+empty('رکوردی برای نمایش وجود ندارد','پس از ورود داده معتبر یا ایجاد رکورد دمو، اطلاعات در این بخش ظاهر می‌شود.')+'</td></tr>')+'</tbody></table></div>';}
function button(label,action,kind='secondary',attrs=''){return '<button type="button" class="app-btn '+kind+'" data-action="'+action+'" '+attrs+'>'+label+'</button>';}
function input(label,name,placeholder='',type='text',required=true){return '<label class="app-field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" placeholder="'+placeholder+'" '+(required?'required':'')+'></label>';}
function select(label,name,options,required=true){return '<label class="app-field"><span>'+label+'</span><select name="'+name+'" '+(required?'required':'')+'>'+options.map(o=>'<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>').join('')+'</select></label>';}
function form(id,fields,submit='ثبت در محیط محلی دمو'){return '<form class="app-form" data-form="'+id+'">'+fields.join('')+'<div class="app-form-actions"><button class="app-btn primary" type="submit">'+submit+'</button></div></form>';}

function filterBannerHtml(){
 const f=db.activeFilter;
 if(!f||(!f.context&&!f.project&&!f.family&&!f.status&&!f.scenario))return '';
 const tags=[];
 if(f.project)tags.push(badge('پروژه: '+f.project,'blue'));
 if(f.family){const fam=(catalog.families.find(x=>x.family_id===f.family)||{}).label_fa||f.family;tags.push(badge('خانواده محصول: '+fam,'blue'));}
 if(f.status)tags.push(badge('فیلتر وضعیت: '+f.status,'warn'));
 if(f.scenario)tags.push(badge('سناریو: '+(scenarios[f.scenario]?.id||f.scenario),'warn'));
 return '<div class="active-filter-banner"><div><strong>🔗 متصل به انتخاب شما در نمای مدیرعامل:</strong> <span>'+esc(f.context||'نمایش فیلترشده بر اساس انتخاب صفحه اصلی')+'</span> <span style="margin-right:8px">'+tags.join(' ')+'</span></div><div style="display:flex;gap:8px;align-items:center">'+button('نمایش همه رکوردها','clear-filter','secondary')+' '+button('بازگشت به صفحه اصلی ←','back-home','primary')+'</div></div>';
}

function frame(key,view,title,desc,content){
 const subs=SUBS[key]||[];
 return '<section class="app-page"><div class="app-page-title"><div><span class="app-eyebrow">PARS VALUE PROTECTION TOWER / '+esc(key.toUpperCase())+'</span><h1>'+esc(title||LABELS[key])+'</h1><p>'+esc(desc||'نمای عملیاتی متصل به مدل داده مشترک؛ وضعیت منشأ هر رکورد حفظ می‌شود.')+'</p></div><div class="app-page-state">'+badge('LOCAL DEMO','blue')+badge('منبع داخلی متصل نیست','warn')+'</div></div><nav class="app-subnav">'+subs.map(s=>'<button type="button" class="'+(s[0]===view?'active':'')+'" data-view="'+s[0]+'">'+s[1]+'</button>').join('')+'</nav>'+filterBannerHtml()+'<div class="app-page-content">'+content+'</div><footer class="app-page-footer">داده‌های عملیاتی واقعی PARS در این نسخه متصل نیستند. رکوردهای ایجادشده فقط در همین مرورگر ذخیره می‌شوند؛ تصمیم سازمانی یا ثبت ERP انجام نمی‌شود.</footer></section>';
}
function stat(label,value,detail,kind='blue'){return '<div class="app-stat '+kind+'"><span>'+label+'</span><strong>'+value+'</strong><small>'+detail+'</small></div>';}
function metrics(items){return '<div class="app-stats">'+items.join('')+'</div>';}
function provenance(r){return badge(DATA_CLASS[r.data_class]||'نامشخص',r.data_class==='PUBLIC_VERIFIED'?'good':r.data_class==='DEMO_SYNTHETIC'?'warn':'neutral');}

function filterProjectsList(list){
 const f=db.activeFilter;
 if(!f)return list;
 return list.filter(p=>{
   if(f.project && p.project_id!==f.project && p.legacy_id!==f.project)return false;
   if(f.family && p.family_id!==f.family)return false;
   if(f.status==='AT_RISK')return (p.var_billion||0)>=400 || p.status_code==='CRITICAL' || p.status_code==='HIGH_RISK';
   if(f.status==='CUSTOMER_AT_RISK')return Boolean(p.customer_at_risk);
   if(f.status==='CRITICAL')return p.status_code==='CRITICAL';
   if(f.status==='HIGH_RISK')return p.status_code==='HIGH_RISK';
   if(f.status==='ATTENTION')return p.status_code==='ATTENTION';
   if(f.status==='VAR_GT_1000')return (p.var_billion||0)>=1000;
   if(f.status==='VAR_500_1000')return (p.var_billion||0)>=500 && (p.var_billion||0)<1000;
   if(f.status==='VAR_100_500')return (p.var_billion||0)>=100 && (p.var_billion||0)<500;
   return true;
 });
}

function renderHomeIssuesAndSolutions() {
  const issuesList = db.issues && db.issues.length ? db.issues : ceoDetailedIssues;
  const solutionsList = db.solutions && db.solutions.length ? db.solutions : ceoDetailedSolutions;

  const issuesPanel = $('#homeIssuesListPanel');
  if (issuesPanel) {
    issuesPanel.innerHTML = table([
      'شناسه', 'پروژه', 'عنوان چالش', 'دسته ۵M', 'شدت', 'VaR (م.ت)', 'WIP Cost', 'PNR', 'عملیات'
    ], issuesList.slice(0, 4).map(x => [
      '<b>' + esc(x.id) + '</b>',
      '<b>' + esc(x.project_id) + '</b>',
      esc(x.title),
      badge(x.type_fa || x.type, 'neutral'),
      badge(x.severity === 'CRITICAL' ? 'بحرانی' : 'زیاد', x.severity === 'CRITICAL' ? 'bad' : 'warn'),
      fa(x.var_billion),
      fa(x.wip_cost_million) + ' م.ت/ماه',
      '<span style="color:#ed1c2e;font-weight:900">' + fa(x.days_to_pnr) + ' روز</span>',
      button('راهکار 💡', 'propose-solution-for-issue', 'primary', 'data-issue-id="' + esc(x.id) + '" data-project-id="' + esc(x.project_id) + '"')
    ]));
  }

  const solutionsPanel = $('#homeSolutionsListPanel');
  if (solutionsPanel) {
    solutionsPanel.innerHTML = table([
      'شناسه', 'پروژه', 'عنوان راهکار', 'هزینه (م.ت)', 'ارزش حفاظت‌شده', 'وضعیت', 'اقدام'
    ], solutionsList.slice(0, 4).map(x => [
      '<b>' + esc(x.id) + '</b>',
      '<b>' + esc(x.project_id) + '</b>',
      esc(x.title),
      fa(x.cost_million) + ' م.ت',
      '<span style="color:#169c59;font-weight:900">' + fa(x.protected_var_billion) + ' میلیارد</span>',
      badge(x.status_fa || x.status, x.status === 'APPROVED' ? 'good' : 'warn'),
      x.status === 'PROPOSED' || x.status === 'UNDER_REVIEW' ?
        button('تصویب ✓', 'approve-solution', 'primary', 'data-solution-id="' + esc(x.id) + '"') :
        badge('مصوب', 'good')
    ]));
  }

  const issuesBadge = $('#homeIssuesCountBadge');
  if (issuesBadge) issuesBadge.textContent = fa(issuesList.length);

  const solutionsBadge = $('#homeSolutionsCountBadge');
  if (solutionsBadge) solutionsBadge.textContent = fa(solutionsList.length);
}

function renderHomeProjects() {
  const tbody = $('#homeProjectsTbody');
  if (!tbody) return;
  const isEn = (currentLang === 'en');
  const filterTab = db.homeProjTab || 'all';

  let rowsHtml = '';
  if (filterTab === 'macro') {
    rowsHtml = company1404MacroPlan.map(r => {
      const name = (isEn ? r.product_en : r.product_fa) + (r.sub_fa ? ' — ' + (isEn ? r.sub_en : r.sub_fa) : '');
      const activeMonths = r.months.map((m, idx) => m !== '-' ? (isEn ? 'M' + (idx+1) : 'م' + (idx+1)) + ':' + m : '').filter(Boolean).join(' · ');
      return '<tr data-nav-page="projects" data-nav-view="commitments" data-filter-family="' + esc(r.family_id) + '" data-filter-context="' + esc(name) + '">'
        + '<td class="project-id">' + esc(r.code !== '—' ? r.code : (isEn ? 'Item ' + r.row : 'ردیف ' + r.row)) + '</td>'
        + '<td>' + esc(name) + '</td>'
        + '<td><span class="status" style="background:#e7f3fb;color:#1b628d;padding:2px 8px;border-radius:5px">' + esc(isEn ? r.annual_plan_en : r.annual_plan) + '</span></td>'
        + '<td style="white-space:normal;max-width:220px;font-size:9px">' + esc(activeMonths || '—') + '</td>'
        + '</tr>';
    }).join('');
  } else {
    const genRows = (filterTab === 'all' || filterTab === 'generators') ? company1404DetailedUnits.map(u => ({
      sortKey: u.need_date + '-1-' + String(u.row).padStart(2, '0'),
      filterProj: u.serial,
      family: u.family_id,
      col1: '❮ ' + esc(u.serial),
      col2: esc(isEn ? u.plant_en : u.plant_fa) + ' <small style="opacity:.7">(' + esc(isEn ? 'Unit ' + u.unit_no : 'واحد ' + u.unit_no) + ')</small>',
      col3: esc(isEn ? u.category_en : u.category_fa),
      col4: '<b style="color:#1664b0">' + esc(u.need_date) + '</b>',
      col5: u.note_fa !== '-' ? '<span class="status" style="background:#e5f6ed;color:#14754e;padding:2px 7px;border-radius:5px;white-space:normal">' + esc(isEn ? u.note_en : u.note_fa) + '</span>' : '<span style="opacity:.5">-</span>'
    })) : [];

    const bdRows = (filterTab === 'all' || filterTab === 'busduct') ? company1404Busducts.map(b => ({
      sortKey: b.delivery_date + '-2-' + String(b.row).padStart(2, '0'),
      filterProj: b.id,
      family: 'BUSDuct',
      col1: '❮ ' + esc(isEn ? 'Busduct #' + b.row : 'باسداکت ' + b.row),
      col2: esc(isEn ? b.plant_en : b.plant_fa),
      col3: esc(isEn ? b.type_en : b.type_fa),
      col4: '<b style="color:#6b1cb0">' + esc(b.delivery_date) + '</b>',
      col5: b.note_fa !== '-' ? esc(isEn ? b.note_en : b.note_fa) : '<span style="opacity:.5">-</span>'
    })) : [];

    const combined = [...genRows, ...bdRows].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    rowsHtml = combined.map(item =>
      '<tr data-nav-page="projects" data-nav-view="projects" data-filter-project="' + esc(item.filterProj) + '" data-filter-family="' + esc(item.family) + '" data-filter-context="' + esc((isEn ? '1404 Project: ' : 'پروژه سال ۱۴۰۴: ') + item.filterProj) + '">'
      + '<td class="project-id">' + item.col1 + '</td>'
      + '<td>' + item.col2 + '</td>'
      + '<td>' + item.col3 + '</td>'
      + '<td>' + item.col4 + '</td>'
      + '<td>' + item.col5 + '</td>'
      + '</tr>'
    ).join('');
  }
  tbody.innerHTML = rowsHtml;

  const ths = $$('#homePage .project-panel .project-table th');
  const headers = filterTab === 'macro'
    ? (isEn ? ['Code', 'Product / Service', 'Annual Plan', '1404 Monthly Schedule'] : ['کد / ردیف', 'شرح محصول / خدمت', 'برنامه سال', 'برنامه ماهانه ۱۴۰۴'])
    : (isEn ? ['Product Serial / ID', 'Power Plant & Unit', 'Product Type', 'Need / Delivery', 'Remarks'] : ['سریال / کد', 'نام نیروگاه / واحد', 'نوع محصول', 'تاریخ نیاز / تحویل', 'توضیحات']);
  if (ths.length) {
    ths.forEach((th, idx) => {
      if (idx < headers.length) {
        th.style.display = '';
        th.textContent = headers[idx];
      } else {
        th.style.display = 'none';
      }
    });
  }
}

function syncHomeKpis(){
 const decCount = 2 + (db.decisions?.length || 0);
 const decEl = $('#kpiDecisionCount');
 if(decEl) decEl.textContent = String(decCount);
 const badgeEl = $('#decisionPanelBadge');
 if(badgeEl) badgeEl.textContent = fa(decCount);
 const notifEl = $('#liveNotifBadge');
 if(notifEl) notifEl.textContent = String(3 + (db.issues?.length || (ceoDetailedIssues ? ceoDetailedIssues.length : 0)));
 renderHomeProjects();
 renderHomeIssuesAndSolutions();
}

function loadFixture(){return fetch('../data/product-project-fixture.json').then(r=>{if(!r.ok)throw Error('fixture unavailable');return r.json();}).then(d=>{
 catalog.families=d.product_families||seedFamilies;
 catalog.products=d.products||seedProducts;
 const baseAssign=d.project_product_assignments||d.assignments||[];
 const ceoAssign=ceoProjects.map((p,idx)=>({assignment_id:'ASN-CEO-'+(idx+1),project_id:p.project_id,product_id:p.product_id,family_id:p.family_id,data_class:'DEMO_SYNTHETIC'}));
 catalog.assignments=[...ceoAssign,...baseAssign];
 catalog.projects=[...(db.projects||[]),...ceoProjects,...(d.projects||[])];
 catalog.commitments=[...(db.commitments||[]),...ceoCommitments,...(d.commitments||[])];
 catalog.components=[
   {component_id:'CELL-P1405-STATOR (C-117)',project_id:'P-1405',product_id:'PUB-THERMAL-MGG72-SH2',production_order_id:'PO-P1405-01',data_class:'DEMO_SYNTHETIC'},
   {component_id:'CELL-P1398-ROTOR',project_id:'P-1398',product_id:'PUB-IND-GEN-01',production_order_id:'PO-P1398-02',data_class:'DEMO_SYNTHETIC'},
   {component_id:'CELL-P1412-NACELLE',project_id:'P-1412',product_id:'PUB-WIND-MWT2.5-103-G-I',production_order_id:'PO-P1412-03',data_class:'DEMO_SYNTHETIC'},
   ...(d.components||[])
 ];
 catalog.orders=[
   {production_order_id:'PO-P1405-01',component_id:'CELL-P1405-STATOR (C-117)',project_id:'P-1405',status:'BLOCKED_MATERIAL (کمبود قطعه DEMO-COMP-17)',data_class:'DEMO_SYNTHETIC'},
   {production_order_id:'PO-P1398-02',component_id:'CELL-P1398-ROTOR',project_id:'P-1398',status:'TEST_QUEUE_CONFLICT (تعارض ایستگاه آزمون)',data_class:'DEMO_SYNTHETIC'},
   {production_order_id:'PO-P1412-03',component_id:'CELL-P1412-NACELLE',project_id:'P-1412',status:'DESIGN_REVISION (بررسی تغییر طراحی)',data_class:'DEMO_SYNTHETIC'},
   {production_order_id:'PO-P1395-04',component_id:'CELL-P1395-CORE',project_id:'P-1395',status:'RUNNING (در حال اجرا - ۷۵٪)',data_class:'DEMO_SYNTHETIC'},
   ...(d.production_orders||[])
 ];
 catalog.operations=[
   {operation_id:'OP-P1405-30',production_order_id:'PO-P1405-01',project_id:'P-1405',sequence_no:30,machine_resource_id:'MACH-WIND-01 (مونتاژ سیم‌پیچ استاتور)',planned_hours:16,data_class:'DEMO_SYNTHETIC'},
   {operation_id:'OP-P1405-40',production_order_id:'PO-P1405-01',project_id:'P-1405',sequence_no:40,machine_resource_id:'MACH-TEST-01 (آزمون نهایی ژنراتور)',planned_hours:12,data_class:'DEMO_SYNTHETIC'},
   {operation_id:'OP-P1398-20',production_order_id:'PO-P1398-02',project_id:'P-1398',sequence_no:20,machine_resource_id:'MACH-TEST-01 (ایستگاه آزمون مشترک - کسری ۶ ساعت)',planned_hours:22,data_class:'DEMO_SYNTHETIC'},
   ...(d.operations||[])
 ];
 const moneySeeds=[
   {resource_id:'CASH-STAGE-P1405',name:'مرحله وصول P-1405 (در معرض تأخیر)',resource_type:'MONEY',capacity:680,unit:'میلیارد تومان (DEMO)',data_class:'DEMO_SYNTHETIC'},
   {resource_id:'CASH-STAGE-P1398',name:'مرحله وصول P-1398 (در معرض تأخیر)',resource_type:'MONEY',capacity:500,unit:'میلیارد تومان (DEMO)',data_class:'DEMO_SYNTHETIC'},
   {resource_id:'CASH-BUDGET-P1405',name:'سقف بودجه مداخله تأمین تسریع‌شده (P-1405)',resource_type:'MONEY',capacity:200,unit:'میلیون تومان (DEMO)',data_class:'DEMO_SYNTHETIC'},
   {resource_id:'CASH-BUDGET-P1398',name:'سقف بودجه مداخله ایستگاه آزمون (P-1398)',resource_type:'MONEY',capacity:150,unit:'میلیون تومان (DEMO)',data_class:'DEMO_SYNTHETIC'}
 ];
 catalog.resources=[...(db.catalogResources||[]),...(d.resources||[]),...moneySeeds];
 catalog.suppliers=[
   ...(db.suppliers||[]),
   {supplier_id:'SUP-DEMO-01',name:'تأمین‌کننده قطعه بحرانی C-117 (پروژه P-1405 · تأخیر ۱۸ روزه)',part:'DEMO-COMP-17 / C-117',date:'1404/02/10',data_class:'DEMO_SYNTHETIC'},
   {supplier_id:'SUP-DEMO-02',name:'پیمانکار آزمون بیرونی تأییدشده (پروژه P-1398 · ظرفیت ۱۰ ساعت)',part:'FAT-EXTERNAL',date:'1404/02/14',data_class:'DEMO_SYNTHETIC'},
   ...(d.suppliers||[])
 ];
 catalog.issues=[...ceoIssues,...(d.issues||[])];
 syncHomeKpis();
}).catch(()=>{catalog.families=seedFamilies;catalog.products=seedProducts;catalog.projects=ceoProjects;catalog.commitments=ceoCommitments;});}

function viewHome(view){
 const publicCount=catalog.products.filter(p=>p.data_class==='PUBLIC_VERIFIED'||p.source_status==='PUBLIC_VERIFIED').length;
 if(view==='priority')return metrics([stat('پرونده تصمیم ثبت‌شده',fa(db.decisions.length),'محلی / دمو'),stat('فرصت‌های مداخله واقعی','—','INTERNAL SOURCE REQUIRED','orange'),stat('ارزش مالی در معرض ریسک','—','NOT YET QUANTIFIED','red')])+card('صف تصمیم‌های ضروری',db.decisions.length?table(['پرونده','گزینه','وضعیت','عملیات'],db.decisions.map((d,i)=>[esc(d.title),esc(d.optionName),badge(d.status||'ثبت محلی','warn'),button('مشاهده','open-memory','secondary','data-index="'+i+'"')])):empty('پرونده واقعی در دسترس نیست','برای تجربه تعامل می‌توانید از بخش «فرصت‌های تصمیم» یک سناریوی صریحاً ساختگی را بررسی کنید.','INTERNAL SOURCE REQUIRED'));
 return '<div class="app-home-hero"><div><span class="app-eyebrow">EXECUTIVE CONTROL / DATA-TRUTH FIRST</span><h1>سامانه حفاظت از ارزش پروژه‌ها و تعهدات</h1><p>از انحراف و محدودیت منابع تا گزینه شدنی، تصمیم انسانی و ثبت نتیجه.</p></div><div class="app-home-mark">PVPT<span>MISSION CONTROL</span></div></div><div class="source-ribbon app-source-strip"><strong>مرزبندی داده‌ها · وضعیت فعلی سامانه</strong><span>۶ خانواده محصول</span><span>'+fa(publicCount)+' محصول با مرجع عمومی</span><span class="warn">اتصال داده داخلی: برقرار نیست</span><span class="warn">ارزش مالی: محاسبه نشده</span></div>'+metrics([stat('خانواده محصول',fa(catalog.families.length),'طبقه‌بندی ثابت','blue'),stat('محصولات دارای مرجع عمومی',fa(publicCount),'کاتالوگ محصول','green'),stat('پرونده‌های محلی دمو',fa(db.decisions.length),'تصمیم انسانی لازم','purple'),stat('ارزش در معرض ریسک','—','NOT YET QUANTIFIED','red')])+'<div class="app-two-col">'+card('نقشه ارزش و ریسک',empty('ارزش مالی هنوز قابل محاسبه نیست','به issue، تعهد متأثر، مبنای محاسبه مالی، دوره و منبع تأییدشده نیاز است.','NOT YET QUANTIFIED'),badge('بدون داده مالی','warn'))+card('فرصت‌های مداخله',Object.keys(scenarios).map(k=>'<div class="app-list-row"><div><strong>'+esc(scenarios[k].title)+'</strong><p>'+esc(scenarios[k].need)+'</p>'+badge('DEMO_SYNTHETIC','warn')+'</div>'+button('ارزیابی','go-interventions','primary','data-scenario="'+k+'"')+'</div>').join(''))+'</div>'+card('سبد محصولات', '<div class="app-product-row">'+catalog.products.filter(p=>p.data_class==='PUBLIC_VERIFIED'||p.source_status==='PUBLIC_VERIFIED').map(p=>'<article class="app-product"><span>◈</span><strong>'+esc(p.name||p.model_code)+'</strong><small>'+esc((catalog.families.find(f=>f.family_id===p.family_id)||{}).label_fa||'کاتالوگ محصول')+'</small>'+provenance(p)+'</article>').join('')+'</div>'+button('مشاهده کاتالوگ کامل','go-portfolio','secondary'))+card('زنجیره عملیاتی و یادگیری','<div class="app-flow">'+['Issue / انحراف','تعهد و اثر','قید منابع','امکان‌پذیری','تصمیم انسانی','نتیجه واقعی','درس‌آموخته'].map((s,i)=>'<div class="app-flow-node"><b>0'+(i+1)+'</b><span>'+s+'</span></div>').join('')+'</div><p class="app-muted">نقشه مفهومی معماری است؛ وضعیت هر گام تا ورود داده معتبر، تأییدنشده باقی می‌ماند.</p>');
}

function viewPortfolio(view){
 const f=db.activeFilter;
 const activeFam=f?.family||'';
 if(view==='families')return card('شش خانواده رسمی مدل محصول (متصل به پروژه‌های ۱۴۰۴ شرکت)', '<div class="app-family-grid">'+catalog.families.sort((a,b)=>(a.display_order||0)-(b.display_order||0)).map(fam=>{
   const relatedUnits=company1404DetailedUnits.filter(u=>u.family_id===fam.family_id);
   const relatedBds=fam.family_id==='BUSDuct'?company1404Busducts:[];
   const windCount=fam.family_id==='WIND_TURBINES'?10:0;
   const total1404=relatedUnits.length+relatedBds.length+windCount;
   return '<button class="app-family" data-action="family-filter" data-family="'+esc(fam.family_id)+'"><span>◈</span><strong>'+esc(fam.label_fa)+'</strong><small>'+esc(fam.family_id)+'</small>'+provenance(fam)+(total1404?badge('برنامه ۱۴۰۴: '+fa(total1404)+' واحد','blue'):badge('بدون واحد ثبت‌شده در جدول ۱۴۰۴','neutral'))+'</button>';
 }).join('')+'</div>');
 if(view==='assignments'){
   const list=activeFam?catalog.assignments.filter(a=>a.family_id===activeFam||(catalog.products.find(p=>p.product_id===a.product_id)||{}).family_id===activeFam):catalog.assignments;
   const units1404=activeFam?company1404DetailedUnits.filter(u=>u.family_id===activeFam):company1404DetailedUnits;
   return card('ارتباط محصول و پروژه‌های سال ۱۴۰۴ شرکت','<div class="app-filter-row">'+select('فیلتر خانواده','family',[['','همه خانواده‌ها'],...catalog.families.map(fm=>[fm.family_id,fm.label_fa])],false)+'</div>'+table(['سریال محصول','نوع ژنراتور','نام نیروگاه','واحد داخلی','تاریخ نیاز کارفرما','توضیحات','عملیات'],units1404.map(u=>[
     '<code>'+esc(u.serial)+'</code>',
     esc(u.category_fa),
     '<b>'+esc(u.plant_fa)+'</b>',
     esc(u.unit_no),
     badge(u.need_date,'blue'),
     esc(u.note_fa),
     button('زنجیره تعهد','filter-project','secondary','data-project="'+esc(u.serial)+'"')
   ])))+card('ارتباط محصول و پروژه (مدل پایه دمو)',(list.length?table(['شناسه ارتباط','محصول','پروژه','خانواده','منشأ','عملیات'],list.map(a=>{
     const prod=catalog.products.find(p=>p.product_id===a.product_id)||{};
     const famLabel=(catalog.families.find(fm=>fm.family_id===(a.family_id||prod.family_id))||{}).label_fa||(a.family_id||prod.family_id||'—');
     return [esc(a.assignment_id||'—'),esc(prod.name||prod.model_code||a.product_id),esc(a.project_id||'UNKNOWN'),esc(famLabel),provenance(a),a.project_id&&a.project_id.startsWith('P-')?button('مشاهده پروژه','filter-project','secondary','data-project="'+esc(a.project_id)+'"'):'—'];
   })):empty('هیچ ارتباط محصول–پروژه تأییدشده‌ای در دسترس نیست','عضویت محصول در کاتالوگ، وجود پروژه یا تخصیص محصول به پروژه را ثابت نمی‌کند.','INTERNAL SOURCE REQUIRED')));
 }
 const familyOptions=[['','همه خانواده‌ها'],...catalog.families.map(fm=>[fm.family_id,fm.label_fa])];
 const initialProducts=activeFam?catalog.products.filter(p=>p.family_id===activeFam):catalog.products;
 const related1404Units=activeFam?company1404DetailedUnits.filter(u=>u.family_id===activeFam):company1404DetailedUnits;
 const related1404Bds=(!activeFam||activeFam==='BUSDuct')?company1404Busducts:[];
 return card('کاتالوگ محصول و فیلترهای تعاملی','<div class="app-filter-row">'+input('جست‌وجوی مدل یا نام','productSearch','نام یا کد مدل', 'search',false)+select('خانواده محصول','family',familyOptions,false).replace('value="'+esc(activeFam)+'"','value="'+esc(activeFam)+'" selected')+select('منشأ داده','dataClass',[['','همه طبقات'],['PUBLIC_VERIFIED','مرجع عمومی'],['DEMO_SYNTHETIC','دموی ساختگی'],['UNKNOWN','نامشخص']],false)+'</div><div id="product-results">'+productGrid(initialProducts)+'</div><p class="app-muted">مرجع عمومی: <a href="'+officialUrl+'" target="_blank" rel="noopener">کاتالوگ رسمی PARS</a>. مشخصات محصول به‌معنای وجود پروژه، تعهد، ظرفیت یا ارزش مالی نیست.</p>')+card('پروژه‌های برنامه ۱۴۰۴ مرتبط با این حوزه محصول', (related1404Units.length||related1404Bds.length) ? table(['سریال / شناسه','عنوان / نوع محصول','نیروگاه','تاریخ نیاز کارفرما / تحویل','توضیحات','عملیات'],[
   ...related1404Units.map(u=>['<code>'+esc(u.serial)+'</code>',esc(u.category_fa),esc(u.plant_fa)+' (واحد '+esc(u.unit_no)+')',badge(u.need_date,'blue'),esc(u.note_fa),button('ردیابی پروژه','filter-project','primary','data-project="'+esc(u.serial)+'"')]),
   ...related1404Bds.map(b=>['<b>'+esc(b.id)+'</b>','باسداکت '+esc(b.type_fa),esc(b.plant_fa),badge(b.delivery_date,'blue'),esc(b.note_fa),button('ردیابی پروژه','filter-project','primary','data-project="'+esc(b.id)+'"')])
 ]) : empty('در این خانواده محصول، پروژه‌ای در جدول ۱۴۰۴ ثبت نشده است','جدول تعهدات سال ۱۴۰۴ فاقد ردیف تفصیلی در این خانواده است.','INTERNAL SOURCE REQUIRED'));
}

function getProductFamilyImg(familyId){
  const map={
    THERMAL_GENERATORS:'assets/prod-thermal.png',
    HYDRO_GENERATORS:'assets/prod-hydro.png',
    WIND_TURBINES:'assets/prod-wind.png',
    INDUSTRIAL_GENERATORS:'assets/prod-industrial.png',
    MOTORS:'assets/prod-motors.png',
    BUSDuct:'assets/prod-busduct.png'
  };
  return map[familyId] || 'assets/prod-thermal.png';
}

function productGrid(products){return products.length?'<div class="app-product-grid">'+products.map(p=>{
  const imgUrl=getProductFamilyImg(p.family_id);
  return '<article class="app-product"><div class="app-product-symbol"><img src="'+imgUrl+'" alt="'+esc(p.name)+'" style="width:100%;height:100%;object-fit:contain;border-radius:4px;"></div><strong>'+esc(p.name||p.model_code||p.product_id)+'</strong><small>'+esc((catalog.families.find(f=>f.family_id===p.family_id)||{}).label_fa||p.family_id||'خانواده نامشخص')+'</small><code>'+esc(p.product_id||'')+'</code>'+provenance(p)+'<a href="'+esc(p.source_reference||p.source_url||officialUrl)+'" target="_blank" rel="noopener">منبع محصول ↗</a><details class="app-product-details"><summary>جزئیات محصول</summary><div><p>شناسه: '+esc(p.product_id)+'</p><p>طبقه داده: '+esc(p.data_class||p.source_status||'UNKNOWN')+'</p><a href="'+esc(p.source_reference||p.source_url||officialUrl)+'" target="_blank" rel="noopener">مشاهده مرجع ↗</a></div></details></article>';
}).join('')+'</div>':empty('محصولی مطابق فیلتر پیدا نشد','فیلترها را تغییر دهید یا داده کاتالوگ را بررسی کنید.');}

function render1404SignatoriesBanner(isEn){
 return '<div class="app-notice" style="margin-top:8px"><strong>'+(isEn?'Document Approval & Signatories: ':'تأیید و امضاکنندگان برنامه مصوب ۱۴۰۴: ')+'</strong>'+esc(isEn?company1404Meta.signatories_en:company1404Meta.signatories_fa)+'</div>';
}

function render1404MacroTable(isEn, filterFamily=''){
 const rows=(filterFamily?company1404MacroPlan.filter(r=>r.family_id===filterFamily):company1404MacroPlan);
 const headers=isEn
  ? ['Row','Product / Service','Code','Annual Plan','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12']
  : ['ردیف','شرح محصول / خدمت','کد محصول','برنامه سال','ماه 1','ماه 2','ماه 3','ماه 4','ماه 5','ماه 6','ماه 7','ماه 8','ماه 9','ماه 10','ماه 11','ماه 12'];
 return table(headers, rows.map(r=>[
  '<b>'+esc(r.row)+'</b>',
  '<b>'+esc(isEn?r.product_en:r.product_fa)+'</b>'+(r.sub_fa?'<div style="font-size:9px;opacity:.8">'+esc(isEn?r.sub_en:r.sub_fa)+'</div>':''),
  '<code>'+esc(r.code)+'</code>',
  badge(isEn?r.annual_plan_en:r.annual_plan,'blue'),
  ...r.months.map(m=>m==='-'?'<span style="opacity:.45">-</span>':'<b>'+esc(m)+'</b>')
 ]));
}

function viewProjects(view){
 const f=db.activeFilter;
 const isEn=(currentLang==='en');
 const demoNotice='<div class="app-notice warn">'+(isEn
  ? 'Company 1404 commitment schedules & detailed generator/busduct tables match the official 1404 commitment document; live SAP/P6 execution progress & financial exposure (VaR) remain unquantified (INTERNAL SOURCE REQUIRED). Legacy training IDs (DEMO-*/P-1405..P-1401) are DEMO_SYNTHETIC.'
  : 'برنامه کلان تعهدات و جداول تفصیلی پروژه‌های شرکت در سال ۱۴۰۴ مطابق سند رسمی سال ۱۴۰۴ درج شده‌اند؛ مقادیر پیشرفت لحظه‌ای و ریسک مالی واقعی ERP هنوز متصل نیستند (INTERNAL SOURCE REQUIRED). شناسه‌های تمرینی DEMO و P-1405 الی P-1401 برای سناریوهای آموزشی دمو هستند.')+'</div>'+badge('INTERNAL SOURCE REQUIRED','warn');

 const activeGroup=db.proj1404Group||'';
 const activeMonth=db.proj1404Month||'';
 const activeSearch=(db.proj1404Search||'').trim().toLowerCase();

 if(view==='projects'){
   const headersUnit=isEn
    ? ['Row','Internal Unit #','Power Plant & Unit','Product Serial','Customer Need Date','Remarks / Notes','Trace']
    : ['ردیف','شماره واحد داخلی','نام و شماره واحد نیروگاه','سریال محصول','تاریخ نیاز کارفرما','توضیحات','عملیات'];
   const filterBar='<div class="app-filter-row" style="margin-bottom:12px">'
    +select(isEn?'Project Group (A–G / Busduct)':'فیلتر جدول / گروه محصول','proj1404Group',[
      ['',isEn?'All 1404 Groups (34 Generators + 17 Busducts)':'همه گروه‌های ۱۴۰۴ (۳۴ ژنراتور + ۱۷ باسداکت)'],
      ...company1404Groups.map(g=>[g.key,isEn?g.title_en:g.title_fa]),
      ['BUSDUCT',isEn?'Thermal Generator Busducts (17 Units)':'باسداکت ژنراتور های حرارتی (۱۷ ردیف)']
    ],false).replace('value="'+esc(activeGroup)+'"','value="'+esc(activeGroup)+'" selected')
    +select(isEn?'1404 Delivery Month':'فیلتر ماه نیاز کارفرما (۱۴۰۴)','proj1404Month',[
      ['',isEn?'All Months (1404/01–1404/12)':'همه ماه‌ها (۱۴۰۴/۰۱ تا ۱۴۰۴/۱۲)'],
      ...Array.from({length:12},(_,i)=>{const m='1404/'+String(i+1).padStart(2,'0');return [m,m];})
    ],false).replace('value="'+esc(activeMonth)+'"','value="'+esc(activeMonth)+'" selected')
    +'<label class="app-field"><span>'+(isEn?'Search Plant / Serial':'جست‌وجوی نیروگاه یا سریال')+'</span><input name="proj1404Search" type="search" value="'+esc(db.proj1404Search||'')+'" placeholder="'+(isEn?'e.g. Sabzevar, MGG58...':'مثلاً سبزوار، ری، MGG58...')+'"></label>'
    +'</div>';

   const matchesUnit=(u)=>{
     if(f?.family && u.family_id!==f.family)return false;
     if(f?.project && u.serial!==f.project && !u.plant_fa.includes(f.project))return false;
     if(activeGroup && activeGroup!=='BUSDUCT' && u.group!==activeGroup)return false;
     if(activeGroup==='BUSDUCT')return false;
     if(activeMonth && u.need_date!==activeMonth)return false;
     if(activeSearch && !(u.plant_fa+' '+u.plant_en+' '+u.serial+' '+u.unit_no+' '+u.note_fa).toLowerCase().includes(activeSearch))return false;
     return true;
   };
   const matchesBusduct=(b)=>{
     if(f?.family && b.family_id!==f.family)return false;
     if(f?.project && b.id!==f.project && !b.plant_fa.includes(f.project))return false;
     if(activeGroup && activeGroup!=='BUSDUCT')return false;
     if(activeMonth && b.delivery_date!==activeMonth)return false;
     if(activeSearch && !(b.plant_fa+' '+b.plant_en+' '+b.type_fa+' '+b.id).toLowerCase().includes(activeSearch))return false;
     return true;
   };

   const groupCards=[];
   company1404Groups.forEach(g=>{
     const list=company1404DetailedUnits.filter(u=>u.group===g.key && matchesUnit(u));
     if(!list.length)return;
     groupCards.push(card((isEn?g.title_en:g.title_fa)+' — '+fa(list.length)+(isEn?' Units':' واحد'),table(headersUnit,list.map(u=>[
       '<b>'+fa(u.row)+'</b>',
       '<b>'+esc(u.unit_no)+'</b>',
       esc(isEn?u.plant_en:u.plant_fa),
       '<code>'+esc(u.serial)+'</code>',
       badge(u.need_date,'blue'),
       u.note_fa==='-'?'<span style="opacity:.5">-</span>':badge(isEn?u.note_en:u.note_fa,'good'),
       button(isEn?'Chain Trace':'زنجیره تعهد','project-chain','secondary','data-id="'+esc(u.serial)+'"')
     ])),badge('برنامه ۱۴۰۴','blue')));
   });

   const busList=company1404Busducts.filter(matchesBusduct);
   const busductCard=busList.length?card((isEn?'Thermal Generator Busducts':'باسداکت ژنراتور های حرارتی')+' — '+fa(busList.length)+(isEn?' Units':' ردیف'),table(
     isEn?['Row','Plant Type','Power Plant Name','Est. Delivery Date','Remarks','Trace']:['ردیف','نوع نیروگاه','نام نیروگاه','زمان تحویل برآوردی','توضیحات','عملیات'],
     busList.map(b=>[
       '<b>'+fa(b.row)+'</b>',
       esc(isEn?b.type_en:b.type_fa),
       '<b>'+esc(isEn?b.plant_en:b.plant_fa)+'</b>',
       badge(b.delivery_date,'blue'),
       b.note_fa==='-'?'<span style="opacity:.5">-</span>':esc(isEn?b.note_en:b.note_fa),
       button(isEn?'Chain Trace':'زنجیره تعهد','project-chain','secondary','data-id="'+esc(b.id)+'"')
     ])
   ),badge('باسداکت ۱۴۰۴','blue')):'';

   const totalUnits=company1404DetailedUnits.length;
   const statorReadyCount=company1404DetailedUnits.filter(u=>u.note_fa&&u.note_fa!=='-').length;
   const legacyMatch=f?.project && ceoProjects.some(p=>p.project_id===f.project)?filterProjectsList(catalog.projects):[];

   return demoNotice
    + metrics([
      stat(isEn?'1404 Generator Units':'واحدهای ژنراتور برنامه ۱۴۰۴',fa(totalUnits)+(isEn?' Units':' واحد'),isEn?'Groups A–G (185/50/25/200/185TX/376/238 MW)':'۹+۷+۴+۱۰+۲+۱+۱ واحد (جداول الف تا ز)','blue'),
      stat(isEn?'Thermal Busduct Commitments':'باسداکت ژنراتورهای حرارتی',fa(company1404Busducts.length)+(isEn?' Units':' واحد'),isEn?'Gas 185/50/238 & Steam 200/185TX':'۴+۴+۶+۲+۱ واحد در برنامه سال ۱۴۰۴','purple'),
      stat(isEn?'2.5 MW Wind Turbine Plan':'توربین بادی ۲.۵ مگاوات (۱۴۰۴)',fa(10)+(isEn?' Sets':' واحد کامل'),isEn?'10 Hub/Nacelle · 10 Blade · 10 Gearbox · 10 Tower':'۱۰ هاب و ناسل · ۱۰ پره · ۱۰ گیربکس · ۱۰ تاور','green'),
      stat(isEn?'Stator Manufactured (Rotor in 1404)':'استاتور ساخته‌شده (روتور در برنامه ۱۴۰۴)',fa(statorReadyCount)+(isEn?' Units':' واحد'),'MGG58-SA2/205·206·207 & MGG41-SA2/006','orange')
    ])
    + card(isEn?company1404Meta.detailed_title_en:company1404Meta.detailed_title_fa,
        filterBar
        + (groupCards.length||busductCard ? '' : empty(isEn?'No 1404 projects matched your filter':'پروژه‌ای مطابق فیلتر انتخاب‌شده یافت نشد',isEn?'Adjust group, month, or search filters.':'فیلتر گروه، ماه یا عبارت جست‌وجو را تغییر دهید.','FILTER EMPTY'))
        + render1404SignatoriesBanner(isEn),
      badge('برنامه ۱۴۰۴','good'))
    + groupCards.join('')
    + busductCard
    + (legacyMatch.length ? card('سناریوی تمرینی مرتبط (DEMO_SYNTHETIC)',table(['شناسه','نام پروژه','پیشرفت','وضعیت','ارزش در معرض خطر (DEMO)','مهلت تا نقطه غیرقابل بازگشت','منشأ','عملیات'],legacyMatch.map(p=>['<b>'+esc(p.project_id)+'</b>',esc(p.project_name||p.name),p.progress!==undefined?fa(p.progress)+'٪':'—',badge(p.status_fa||'DEMO','warn'),p.var_billion?fa(p.var_billion)+' میلیارد تومان':'—',p.days_to_pnr?fa(p.days_to_pnr)+' روز':'—',provenance(p),button('زنجیره تعهد','project-chain','secondary','data-id="'+esc(p.project_id)+'"')]))):'')
    + card('زنجیره ردیابی عملیاتی', '<div class="app-flow">'+['Project / Commitment','BOM Component / Cell','Production Order','Routing / Operation','Machine / Material / Manpower'].map((x,i)=>'<div class="app-flow-node"><b>0'+(i+1)+'</b><span>'+x+'</span></div>').join('')+'</div><p class="app-muted">تمام شناسه‌ها و مقادیر این صفحه ساختگی هستند مگر آنکه منبع داخلی معتبر صراحتاً تأیید شده باشد.</p>')
    + card('ساخت پروژه تمرینی',form('project',[input('شناسه دمو','id','DEMO-PROJ-01'),input('نام پروژه','name','نام سناریوی تمرینی'),select('خانواده محصول','family',catalog.families.map(fm=>[fm.family_id,fm.label_fa])),select('وضعیت','status',[['PLANNED','برنامه‌ریزی‌شده'],['RUNNING','در حال اجرا'],['BLOCKED','متوقف / مسدود']])],'افزودن پروژه ساختگی'));
 }

 if(view==='commitments'){
   return demoNotice+metrics([
     stat(isEn?'Total Generator Commitments':'جمع تعهدات ژنراتور ۱۴۰۴',fa(34)+(isEn?' Units':' واحد'),'۱۸۵ · ۵۰ · ۲۵ · ۲۰۰ · ۱۸۵TX · ۳۷۶ · ۲۳۸ مگاوات','blue'),
     stat(isEn?'Busduct Commitments':'جمع تعهدات باسداکت ۱۴۰۴',fa(17)+(isEn?' Units':' واحد'),'۱۸۵ (۴) · ۲۰۰ (۴) · ۵۰ (۶) · ۱۸۵TX (۲) · ۲۳۸ (۱)','purple'),
     stat(isEn?'Wind 2.5MW Subassemblies':'زیرمجموعه‌های توربین بادی ۲.۵ مگاوات',fa(10)+(isEn?' Sets':' واحد'),'هاب و ناسل · پره · گیربکس · تاور (ماه ۲ تا ۱۲)','green'),
     stat(isEn?'Live Financial Exposure':'ارزش مالی در معرض ریسک ERP','—','NOT YET QUANTIFIED','orange')
   ])+card(isEn?company1404Meta.title_en:company1404Meta.title_fa,
     render1404MacroTable(isEn, f?.family||'')
     + render1404SignatoriesBanner(isEn),
     badge('INTERNAL_VERIFIED (برنامه مصوب ۱۴۰۴)','good')
   )+card('ثبت تعهد تمرینی',form('commitment',[input('شناسه تعهد','id','DEMO-COM-01'),input('شناسه پروژه','project','MGG58-SA2/205'),input('شرح تعهد','name','تعهد تمرینی'),input('موعد روز نسبی در سناریو','due','30','number')],'ثبت تعهد ساختگی'));
 }

 if(view==='milestones'){
   const months=Array.from({length:12},(_,i)=>{
     const mStr='1404/'+String(i+1).padStart(2,'0');
     const gens=company1404DetailedUnits.filter(u=>u.need_date===mStr);
     const bds=company1404Busducts.filter(b=>b.delivery_date===mStr);
     const windItems=company1404MacroPlan.filter(r=>r.family_id==='WIND_TURBINES' && r.months[i] && r.months[i]!=='-').map(r=>r.sub_fa+': '+r.months[i]);
     return [
       '<b>'+mStr+'</b> ('+(isEn?'Month ':'ماه ')+(i+1)+')',
       gens.length?gens.map(u=>'<div style="margin-bottom:3px"><code>'+esc(u.serial)+'</code> — '+esc(isEn?u.plant_en:u.plant_fa)+' ('+esc(isEn?u.category_en:u.category_fa)+')</div>').join(''):'<span style="opacity:.45">—</span>',
       bds.length?bds.map(b=>'<div style="margin-bottom:3px"><b>'+esc(isEn?b.plant_en:b.plant_fa)+'</b> ('+esc(isEn?b.type_en:b.type_fa)+')</div>').join(''):'<span style="opacity:.45">—</span>',
       windItems.length?windItems.join(' · '):'<span style="opacity:.45">—</span>'
     ];
   });
   return card(isEn?'1404 Monthly Delivery Milestones (Month 1 to 12)':'جدول زمانی نقاط عطف تحویل سال ۱۴۰۴ (ماه ۱ تا ۱۲)',
     table(isEn?['Month (1404)','Generator Units Due','Busduct Deliverables','Wind 2.5MW Units']:['ماه ۱۴۰۴','واحدهای ژنراتور قابل تحویل','باسداکت‌های ژنراتورهای حرارتی','توربین بادی ۲.۵ مگاوات'],months)
     + render1404SignatoriesBanner(isEn)
     + empty('خط مبنا و پیش‌بینی واقعی سیستم Primavera P6 متصل نیست','برنامه فوق منطبق با تاریخ نیاز کارفرما و تحویل برآوردی سال ۱۴۰۴ است؛ مقایسه لحظه‌ای Baseline/Forecast/Actual نیازمند اتصال به P6 و SAP است.','INTERNAL SOURCE REQUIRED'));
 }

 if(view==='chain'){
   const projId=f?.project||db.selectedProject||'MGG58-SA2/205';
   const unit1404=company1404DetailedUnits.find(u=>u.serial===projId || u.plant_fa===projId);
   const bd1404=company1404Busducts.find(b=>b.id===projId || b.plant_fa===projId);
   if(unit1404){
     return card((isEn?'Commitment Chain: ':'زنجیره تعهد و ردیابی واحد ')+esc(unit1404.serial), '<div class="app-flow vertical">'+[
       (isEn?'Product Category: ':'نوع محصول: ')+(isEn?unit1404.category_en:unit1404.category_fa),
       (isEn?'Serial / Internal Unit #: ':'سریال / شماره واحد داخلی: ')+unit1404.serial+' (واحد '+unit1404.unit_no+')',
       (isEn?'Power Plant & Unit: ':'نام و شماره واحد نیروگاه: ')+(isEn?unit1404.plant_en:unit1404.plant_fa),
       (isEn?'Customer Need Date: ':'تاریخ نیاز کارفرما (برنامه ۱۴۰۴): ')+unit1404.need_date,
       (isEn?'Manufacturing Remarks: ':'وضعیت ساخت / توضیحات: ')+(unit1404.note_fa==='-'?'مطابق برنامه تعهدات ۱۴۰۴ (جزئیات SAP متصل نیست)':(isEn?unit1404.note_en:unit1404.note_fa)),
       (isEn?'Financial VaR / Realized Cost: ':'ارزش در معرض ریسک / وضعیت مالی ERP: ')+'NOT YET QUANTIFIED (INTERNAL SOURCE REQUIRED)'
     ].map((x,i)=>'<div class="app-flow-node"><b>0'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>'+render1404SignatoriesBanner(isEn));
   }
   if(bd1404){
     return card((isEn?'Busduct Commitment Chain: ':'زنجیره تعهد باسداکت: ')+esc(bd1404.plant_fa), '<div class="app-flow vertical">'+[
       (isEn?'Busduct Deliverable ID: ':'ردیف باسداکت: ')+bd1404.row+' ('+bd1404.id+')',
       (isEn?'Power Plant Type: ':'نوع نیروگاه: ')+(isEn?bd1404.type_en:bd1404.type_fa),
       (isEn?'Power Plant Name: ':'نام نیروگاه: ')+(isEn?bd1404.plant_en:bd1404.plant_fa),
       (isEn?'Estimated Delivery Date: ':'زمان تحویل برآوردی: ')+bd1404.delivery_date,
       (isEn?'ERP Production Order / Progress: ':'سفارش تولید و پیشرفت واقعی SAP: ')+'INTERNAL SOURCE REQUIRED'
     ].map((x,i)=>'<div class="app-flow-node"><b>0'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>'+render1404SignatoriesBanner(isEn));
   }
   const proj=ceoProjects.find(p=>p.project_id===projId)||ceoProjects[0];
   return card('زنجیره تعهد و ردیابی پروژه '+esc(proj.project_id), '<div class="app-flow vertical">'+[
     'پروژه: '+proj.project_name,
     'تعهد متأثر: '+(ceoCommitments.find(c=>c.project_id===proj.project_id)?.commitment_type||'تعهد تحویل مشتری'),
     'انحراف / ریسک: '+proj.issue_summary,
     'ارزش در معرض خطر (DEMO): '+fa(proj.var_billion)+' میلیارد تومان · '+fa(proj.days_to_pnr)+' روز تا نقطه غیرقابل بازگشت',
     'سفارش تولید و Cell: '+(catalog.orders.find(o=>o.project_id===proj.project_id)?.production_order_id||'PO-DEMO'),
     'تصمیم مدیریتی مرتبط: '+(proj.decision_id?'پرونده تصمیم فعال شماره '+proj.decision_id:'پایش مستمر')
   ].map((x,i)=>'<div class="app-flow-node"><b>0'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div><p class="app-muted">این زنجیره مدل مرجع است. پیوندها فقط در صورت وجود شناسه و مدرک معتبر به‌عنوان واقعی نمایش داده می‌شوند.</p>');
 }
 if(view==='bom'){
   const comps=f?.project?catalog.components.filter(c=>c.project_id===f.project):catalog.components;
   return demoNotice+card('BOM و Cell (ردیابی قطعات بحرانی پروژه‌ها)',comps.length?table(['Cell / Component','پروژه','محصول','سفارش تولید','منشأ'],comps.map(c=>[esc(c.component_id),esc(c.project_id),esc(c.product_id),esc(c.production_order_id||'—'),provenance(c)])):empty('BOM تأییدشده متصل نیست','Cell یک BOM Component است؛ هر Cell در مدل تولید به سفارش تولید متناظر ردیابی می‌شود.','INTERNAL SOURCE REQUIRED'));
 }
 if(view==='routing'){
   const ops=f?.project?catalog.operations.filter(o=>o.project_id===f.project):catalog.operations;
   return demoNotice+card('Routing / Operations (مسیر عملیات و ایستگاه‌های کاری)',ops.length?table(['عملیات','سفارش','پروژه','توالی','ماشین / مرکز کاری','زمان استاندارد (ساعت)','منشأ'],ops.map(o=>[esc(o.operation_id),esc(o.production_order_id),esc(o.project_id||'—'),esc(o.sequence_no),esc(o.machine_resource_id||'—'),esc(o.planned_hours||o.standard_hours||'—'),provenance(o)])):empty('Routing معتبر دریافت نشده است','ترتیب عملیات، مدت، وابستگی و نیاز منابع باید از منبع تولید تأیید شود.','INTERNAL SOURCE REQUIRED'));
 }
 const ords=f?.project?catalog.orders.filter(o=>o.project_id===f.project):catalog.orders;
 return demoNotice+card('سفارش‌های تولید و واقعیات اجرا',ords.length?table(['سفارش','Cell','پروژه','وضعیت','منشأ'],ords.map(o=>[esc(o.production_order_id),esc(o.component_id),esc(o.project_id),esc(o.status),provenance(o)])):empty('سفارش تولید واقعی متصل نیست','وضعیت سفارش، PCNF/CNF/TECO و مصرف واقعی باید از SAP/منبع معتبر خوانده شود.','INTERNAL SOURCE REQUIRED'))+card('ثبت یادداشت اجرای تمرینی',form('execution',[input('شناسه سفارش دمو','order','PO-P1405-01'),select('وضعیت اجرا','status',[['PCNF','تأیید جزئی'],['CNF','تأیید کامل'],['TECO','بسته فنی']]),input('شرح و مدرک','note','توضیح اجرای تمرینی')],'ثبت یادداشت محلی'));
}

function viewRisk(view){
 const f=db.activeFilter;
 const allIssues=[...db.issues,...ceoIssues];
 const filteredIssues=f?.project?allIssues.filter(x=>x.project_id===f.project||String(x.object||'').includes(f.project)):allIssues;
 if(view==='issues')return card('فهرست ایشوها و انحراف‌های ثبت‌شده (متصل به آخرین تحولات مهم)',filteredIssues.length?table(['پروژه','عنوان ایشو / تحول','نوع قید','موضوع متأثر','شدت','ارزش در معرض خطر','منشأ','عملیات'],filteredIssues.map((x,i)=>[
   '<b>'+esc(x.project_id||'LOCAL')+'</b>',
   esc(x.title),
   esc(x.type),
   esc(x.object),
   badge(x.severity,x.severity==='HIGH'?'bad':'warn'),
   x.var_billion?fa(x.var_billion)+' میلیارد تومان':'—',
   badge('DEMO_SYNTHETIC','warn'),
   x.project_id?button('ردیابی پروژه','filter-project','secondary','data-project="'+esc(x.project_id)+'"'):button('جزئیات','issue-detail','secondary','data-index="'+i+'"')
 ])):empty('ایشوی عملیاتی تأییدشده موجود نیست','برای تمرین فرم زیر یک ایشوی ساختگی ایجاد کنید؛ آن را به‌عنوان واقعیت PARS تلقی نکنید.','INTERNAL SOURCE REQUIRED'))+card('ثبت ایشوی تمرینی',form('issue',[input('عنوان ایشو','title','مثلاً تأخیر قطعه بحرانی'),select('نوع','type',[['MATERIAL','کمبود مواد'],['MACHINE','افت ظرفیت ماشین'],['MANPOWER','کمبود مهارت/نیرو'],['DEPENDENCY','وابستگی'],['CASH','نقدینگی'],['MULTI_CONSTRAINT','چند قید هم‌زمان']]),select('شدت','severity',[['HIGH','زیاد'],['MEDIUM','متوسط'],['LOW','کم']]),input('موضوع متأثر','object','P-1405 / تعهد / Cell'),input('شرح و شواهد','description','منبع، تاریخ و مدرک', 'text')],'ثبت ایشوی دمو'));
 if(view==='impact')return card('زنجیره اثر و حاشیه سود پروژه‌ها (متصل به شاخص کلان «وضعیت حاشیه پروژه‌ها»)',table(['پروژه','منشأ انحراف','اثر بر آزمون/تولید','اثر بر تعهد مشتری','اثر بر وصول و حاشیه سود','وضعیت (DEMO)'],[
   ['P-1405','تأخیر ۱۸ روزه تأمین قطعه C-117','توقف مونتاژ استاتور و تأخیر آزمون نهایی','ریسک نقض موعد تحویل ۳۲۵ مگاوات','تأخیر وصول ۶۸۰ میلیارد + هزینه تسریع ۱۸۰ م.ت (کاهش حاشیه)',badge('در معرض کاهش حاشیه','bad')],
   ['P-1398','کسری ۶ ساعت ایستگاه آزمون مشترک','تراکم صف آزمون کارخانه‌ای (FAT)','تأثیر هم‌زمان بر تحویل دو مشتری','تأخیر وصول ۵۰۰ میلیارد + هزینه اضافه‌کاری/آزمون بیرونی (کاهش حاشیه)',badge('در معرض کاهش حاشیه','bad')],
   ['P-1412','تغییر طراحی مجموعه ناسل','بازنگری BOM و عملیات مونتاژ','ریسک جابه‌جایی موعد تحویل ۲۸ روزه','نیازمند برآورد هزینه تغییر مهندسی',badge('در دست ارزیابی','warn')]
 ])+'<div class="app-flow vertical" style="margin-top:12px">'+['Issue / انحراف اولیه','Activity / Routing / Cell','نیاز و محدودیت منابع','نقطه عطف و تعهد متأثر','اثر زمانی و عملیاتی','اثر مالی با مدرک معتبر'].map((x,i)=>'<div class="app-flow-node"><b>0'+(i+1)+'</b><span>'+x+'</span></div>').join('')+'</div>'+empty('مقدار اثر مالی واقعی (ERP) محاسبه نشده است','ارقام فوق سناریوی نمایشی (DEMO_SYNTHETIC) هستند؛ بدون amount، currency، period، method، provenance و approval، مقدار واقعی مالی NULL می‌ماند.','NOT YET QUANTIFIED'));
 if(view==='conflicts')return card('تعارض منابع مشترک (ایستگاه آزمون و قطعات بحرانی)',Object.keys(scenarios).map(k=>'<div class="app-list-row"><div><strong>'+esc(scenarios[k].title)+'</strong><p>'+esc(scenarios[k].constraint)+'</p>'+badge('DEMO_SYNTHETIC','warn')+'</div>'+button('بررسی قید و گزینه‌ها','go-interventions','primary','data-scenario="'+k+'"')+'</div>').join('')+empty('تعارض واقعی متصل نیست','تعارض فقط با بارگذاری زمان‌مند تقاضا و ظرفیت مشترک قابل تأیید است.','INTERNAL SOURCE REQUIRED'));
 if(view==='evidence')return card('یکپارچگی و کیفیت شواهد',table(['کنترل','قاعده','وضعیت فعلی'],[['منشأ هر رکورد','طبقه داده، مرجع، زمان و مالک',badge('بخشی در fixture','warn')],['شناسه‌های داخلی','تطبیق با منبع معتبر',badge('متصل نیست','bad')],['ارقام مالی','واحد، دوره، روش، تأیید',badge('NOT YET QUANTIFIED','warn')],['روند زمانی','چند snapshot معتبر',badge('INSUFFICIENT HISTORY','warn')],['پروژه و تعهد','مرجع داخلی و تأیید مالک',badge('INTERNAL SOURCE REQUIRED','warn')]]));

 const riskProjs=filterProjectsList(ceoProjects);
 return metrics([
   stat('ارزش کل در معرض خطر (DEMO)','۳,۲۵۰ میلیارد','۴ پروژه اصلی در معرض خطر (P-1405، P-1398، P-1412، P-1395)','red'),
   stat('ارزش مالی واقعی (ERP)','—','NOT YET QUANTIFIED (نیازمند اتصال مالی)','orange'),
   stat('بحرانی‌ترین پنجره مداخله','۵ روز','پروژه P-1405 (۱,۲۰۰ میلیارد تومان)','purple')
 ])+card('جدول تفصیلی پروژه‌ها و تعهدات در معرض خطر (متصل به کارت «ارزش در معرض خطر» و «نقشه ریسک»)',table(['پروژه','خانواده محصول','وضعیت ریسک','ارزش در معرض خطر (میلیارد تومان)','زمان تا نقطه غیرقابل بازگشت','علت اصلی و تعهد متأثر','اقدام مدیریتی'],riskProjs.map(p=>[
   '<b>'+esc(p.project_id)+'</b>',
   esc((catalog.families.find(x=>x.family_id===p.family_id)||{}).label_fa||p.family_id),
   badge(p.status_fa,p.status_code==='CRITICAL'?'bad':p.status_code==='HIGH_RISK'?'warn':'neutral'),
   '<b>'+fa(p.var_billion)+'</b>',
   '<span style="color:'+(p.days_to_pnr<=12?'#c41224':'#173653')+';font-weight:800">'+fa(p.days_to_pnr)+' روز</span>',
   esc(p.issue_summary),
   (p.decision_id?button('پرونده تصمیم','legacy-detail','primary','data-detail="'+esc(p.decision_id)+'"')+' ':'')+button('زنجیره پروژه','filter-project','secondary','data-project="'+esc(p.project_id)+'"')
 ])))+card('ماتریس طبقه‌بندی ارزش و ریسک', '<div class="app-risk-map"><div class="app-risk-axis"><span>اثر عملیاتی / مالی ↑</span><span>فوریت →</span></div><div class="app-risk-grid"><div><strong>مداخله فوری (بحرانی · ۴ پروژه در کل سناریو)</strong><p>P-1405 (۱,۲۰۰ میلیارد · ۵ روز) و P-1398 (۸۵۰ میلیارد · ۱۲ روز)</p></div><div><strong>پایش ویژه (پرریسک · ۳ پروژه)</strong><p>P-1412 (۶۰۰ میلیارد · ۲۸ روز) و P-1395 (۴۰۰ میلیارد · ۳۵ روز)</p></div><div><strong>نیازمند توجه (۵ پروژه)</strong><p>P-1401 (۲۳۰ میلیارد · ۵۵ روز) و سایر پروژه‌های تعمیراتی</p></div><div><strong>وضعیت قابل قبول (مطلوب · ۸ پروژه)</strong><p>پروژه‌های فاقد انحراف بحرانی در افق فعلی</p></div></div></div>'+empty('نقاط ریسک واقعی ERP رسم نشده‌اند','ارقام جدول فوق مربوط به سناریوی نمایشی (DEMO_SYNTHETIC) نمای مدیرعامل است.','INTERNAL SOURCE REQUIRED'));
}

function viewInterventions(view){
 const activeScen=db.activeFilter?.scenario||db.selectedScenario||'part';
 if(view==='compare')return card('مقایسه گزینه‌ها و پیامدها','<div class="app-filter-row">'+select('سناریو','scenario',Object.keys(scenarios).map(k=>[k,scenarios[k].id+' · '+scenarios[k].title])).replace('<option value="'+activeScen+'">','<option value="'+activeScen+'" selected>')+'</div><div id="option-compare">'+scenarioOptions(activeScen)+'</div>');
 if(view==='simulate')return card('شبیه‌سازی سناریوی زمان‌مند','<div class="app-notice warn">ورودی‌ها در محدوده سناریوی ساختگی باقی می‌مانند. این ابزار زمان/هزینه فرضی را بررسی می‌کند و برنامه‌ریزی ERP یا تخصیص واقعی منابع نیست.</div>'+form('simulation',[select('سناریو','scenario',Object.keys(scenarios).map(k=>[k,scenarios[k].id+' · '+scenarios[k].title])),input('پنجره زمانی (روز)','window','3','number'),input('بودجه فرضی (میلیون تومان)','budget','200','number'),input('ظرفیت افزوده (ساعت یا واحد)','capacity','8','number')],'اجرای آزمون قید')+'<div id="simulation-result"></div>');
 return card('پنجره‌های مداخله فعال (متصل به کارت «مهلت‌های مداخله نزدیک»)',Object.keys(scenarios).map(k=>'<article class="app-intervention" style="'+(db.activeFilter?.scenario===k?'border:2px solid #2878cf;background:#f4f9fd':'')+'"><div><span class="app-eyebrow">'+scenarios[k].id+' · پروژه '+esc(scenarios[k].project_id)+' · DEMO SYNTHETIC</span><h3>'+esc(scenarios[k].title)+'</h3><p><b>نیاز و مهلت:</b> '+esc(scenarios[k].need)+'</p><p><b>قید سخت:</b> '+esc(scenarios[k].constraint)+'</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">'+button('مقایسه گزینه‌ها','go-compare','primary','data-scenario="'+k+'"')+' '+button('بازکردن Decision Brief','legacy-detail','secondary','data-detail="'+(k==='part'?'1':'2')+'"')+'</div></article>').join('')+empty('پنجره مداخله واقعی قابل محاسبه نیست','مهلت تصمیم، lead time معتبر، تاریخ snapshot و اثر بر تعهدات باید از منابع داخلی بیاید.','INTERNAL SOURCE REQUIRED'));
}
function scenarioOptions(key){const s=scenarios[key]||scenarios.part;return '<div class="app-notice warn">'+s.id+' · تمام مقادیر این سناریو ساختگی‌اند. '+esc(s.constraint)+'</div>'+table(['گزینه','زمان (روز)','هزینه فرضی (میلیون تومان)','قید سخت','نتیجه ارزیابی','اقدام'],s.options.map(o=>{const ok=o.ok;return [esc(o.name),fa(o.time),fa(o.cost),esc(o.cap),badge(ok?'از نظر قیود نمونه قابل‌بررسی':'ناشدنی در وضعیت فعلی',ok?'good':'bad'),button('ارزیابی','evaluate-option','secondary','data-scenario="'+key+'" data-option="'+o.id+'"')]}))+'<div id="option-evaluation" class="app-evaluation">'+empty('گزینه‌ای ارزیابی نشده است','ارزیابی را اجرا کنید تا منطق زمان، هزینه و نقض تعهدات نمایش داده شود.','EVALUATION PENDING')+'</div>';}

function viewResources(view){
 const res=catalog.resources||[];
 const byType=(t)=>res.filter(r=>r.resource_type===t);
 if(view==='materials')return card('متریال و قطعات بحرانی (شامل C-117 در پروژه P-1405)',byType('MATERIAL').length?table(['قطعه','موجودی آزاد','رزرو','در راه','زمان تأمین','منشأ'],byType('MATERIAL').map(r=>[esc(r.name),esc(r.free_stock??'—'),esc(r.reserved_stock??'—'),esc(r.in_transit_qty??'—'),esc(r.lead_time_days??'—'),provenance(r)])):empty('موجودی واقعی و رزرو متصل نیست','موجودی باید از ledger موجودی، رزرو، رسید و مصرف تطبیق داده شود.','INTERNAL SOURCE REQUIRED'))+card('ثبت ظرفیت/موجودی تمرینی',form('resource',[input('نام منبع','name','قطعه بحرانی دمو'),select('نوع منبع','type',[['MATERIAL','متریال'],['MACHINE','ماشین'],['MANPOWER','مهارت/نیرو'],['METHOD','روش/صلاحیت'],['MONEY','نقدینگی']]),input('مقدار قابل‌دسترس دمو','capacity','0','number'),input('واحد','unit','عدد / ساعت / میلیون تومان')],'ثبت منبع محلی'));
 if(view==='machines'||view==='labor')return card(view==='machines'?'ماشین‌آلات و مراکز کاری':'نیروی انسانی و مهارت',((view==='machines'?byType('MACHINE').concat(byType('WORKCENTER'),byType('TEST_STATION')):byType('MANPOWER').concat(byType('SKILL'))).length?table(['منبع','نوع','ظرفیت','واحد','منشأ'],(view==='machines'?byType('MACHINE').concat(byType('WORKCENTER'),byType('TEST_STATION')):byType('MANPOWER').concat(byType('SKILL'))).map(r=>[esc(r.name),esc(r.resource_type||r.type),fa(r.capacity),esc(r.unit),provenance(r)])):empty(view==='machines'?'ظرفیت و تقویم ماشین واقعی متصل نیست':'ماتریس مهارت و ظرفیت نیروی انسانی متصل نیست','ظرفیت مؤثر باید تقویم، توقف، شیفت، مهارت و تعهدات هم‌زمان را در نظر بگیرد.','INTERNAL SOURCE REQUIRED'))+card('افزودن رکورد منبع تمرینی',form('resource',[input('نام منبع','name',view==='machines'?'ایستگاه آزمون دمو':'تیم مهارتی دمو'),select('نوع منبع','type',view==='machines'?[['MACHINE','ماشین'],['WORKCENTER','مرکز کاری'],['TEST_STATION','ایستگاه آزمون']]:[['MANPOWER','نیروی انسانی'],['SKILL','مهارت / صلاحیت']]),input('ظرفیت در هر روز','capacity','8','number'),input('واحد ظرفیت','unit','ساعت / نفر-ساعت')],'ثبت منبع محلی')));
 if(view==='capacity')return metrics([
   stat('محدودیت ظرفیت کلیدی','۱ گلوگاه فعال','ایستگاه آزمون مشترک MACH-TEST-01 (پروژه P-1398)','orange'),
   stat('تقاضای پنجره مشترک','۲۲ ساعت','پروژه A (۱۲ ساعت) + پروژه B (۱۰ ساعت)','red'),
   stat('ظرفیت عادی در دسترس','۱۶ ساعت','کسری ۶ ساعت در پنجره فعلی','blue')
 ])+card('ظرفیت و بارگذاری زمان‌مند (متصل به شاخص کلان «ظرفیت کلیدی» و پروژه P-1398)',scenarioOptions('capacity')+empty('بارگذاری واقعی مشترک ERP موجود نیست','برای اثبات تعارض واقعی باید demand و available capacity به بازه زمانی یکسان وصل شوند.','INTERNAL SOURCE REQUIRED'));
 if(view==='suppliers')return card('تأمین‌کنندگان و تعهدات تأمین (متصل به پروژه P-1405 و تحولات تأمین)',catalog.suppliers.length?table(['تأمین‌کننده / شرح','شناسه','قطعه / موضوع','موعد ثبت‌شده','منشأ'],catalog.suppliers.map(s=>[esc(s.name),esc(s.supplier_id||s.supplier_code),esc(s.part||'C-117'),esc(s.date||'—'),provenance(s)])):empty('تأمین‌کننده و تاریخ وعده واقعی متصل نیست','تأخیر فقط در قیاس با تاریخ مبنا و وعده معتبر قابل محاسبه است.','INTERNAL SOURCE REQUIRED'))+card('ثبت تعهد تأمین تمرینی',form('supplier',[input('تأمین‌کننده','name','DEMO-SUPPLIER-01'),input('قطعه / Cell','part','DEMO-CELL-01'),input('تاریخ وعده','date','1405/08/01')],'ثبت تعهد دمو'));
 if(view==='cash')return metrics([
   stat('مراحل وصول در معرض تأخیر','۲ مرحله','پروژه‌های P-1405 و P-1398 (DEMO)','orange'),
   stat('جمع نقدینگی در معرض تأخیر','≈ ۱,۱۸۰ میلیارد','۶۸۰ میلیارد (P-1405) + ۵۰۰ میلیارد (P-1398)','red'),
   stat('وصول مطابق برنامه','۱ مرحله','پروژه P-1395 (۳۲۰ میلیارد تومان)','green')
 ])+card('مراحل وصول و نقدینگی در معرض تأخیر (متصل به کارت «نقدینگی در معرض تأخیر» و شاخص کلان «وضعیت نقدینگی»)',table(['شناسه مرحله','پروژه','شرح مرحله وصول','مبلغ (میلیارد تومان)','وضعیت','علت / ریسک تأخیر','منشأ','عملیات'],ceoCashStages.map(c=>[
   esc(c.stage_id),
   '<b>'+esc(c.project_id)+'</b>',
   esc(c.title),
   '<b>'+fa(c.amount_billion)+'</b>',
   badge(c.status_fa,c.project_id==='P-1395'?'good':'warn'),
   esc(c.delay_risk),
   badge('DEMO_SYNTHETIC','warn'),
   button('ردیابی پروژه','filter-project','secondary','data-project="'+esc(c.project_id)+'"')
 ])))+card('منابع مالی و سقف بودجه‌های مداخله دمو',table(['منبع','مقدار نمایشی','واحد','منشأ'],byType('MONEY').map(r=>[esc(r.name),fa(r.capacity??r.available??'—'),esc(r.unit),provenance(r)])))+empty('موجودی نقد و رویدادهای مالی متصل نیست','نقدینگی منبع سخت است؛ amount، currency، period، منبع و مجوز لازم است. هرگونه پول تزریق‌شده زمان تأمین را حذف نمی‌کند.','INTERNAL SOURCE REQUIRED');
 return metrics([stat('ماشین / Work Center','۱ گلوگاه دمو','ایستگاه آزمون مشترک (P-1398)','blue'),stat('مهارت / نیروی انسانی','۱ تیم دمو','سیم‌پیچی و مونتاژ استاتور','purple'),stat('متریال آزاد بحرانی','۰ از ۲ عدد','قطعه C-117 در پروژه P-1405','orange'),stat('نقدینگی در معرض تأخیر','≈ ۱,۱۸۰ میلیارد','۲ مرحله وصول دمو (INTERNAL SOURCE REQUIRED)','red')])+card('منابع مدل پایه',table(['نوع منبع','قاعده کنترل','داده فعلی'],[['Machine','تقویم و ظرفیت خالص زمان‌مند',badge('ایستگاه آزمون در سناریوی دمو','warn')],['Manpower / Skill','صلاحیت و ظرفیت در بازه',badge('تیم مونتاژ در سناریوی دمو','warn')],['Material','موجودی آزاد + رسید − رزرو − مصرف',badge('قطعه C-117 در سناریوی دمو','warn')],['Method','تأیید مهندسی / کیفیت',badge('داده داخلی لازم','warn')],['Money / Cash','جریان نقد و سقف مجاز',badge('۲ مرحله وصول در سناریوی دمو','warn')]]))+card('منابع ثبت‌شده محلی',db.resources.length?table(['منبع','نوع','ظرفیت ثبت‌شده','واحد','منشأ'],db.resources.map(r=>[esc(r.name),esc(r.type),fa(r.capacity),esc(r.unit),badge('DEMO_SYNTHETIC','warn')])):empty('منبع محلی ثبت نشده است','از فرم زیر یک منبع تمرینی اضافه کنید.','NO LOCAL RESOURCE'))+card('ثبت منبع برای سناریوی تمرینی',form('resource',[input('نام منبع','name','منبع تمرینی'),select('نوع منبع','type',[['MATERIAL','متریال'],['MACHINE','ماشین'],['MANPOWER','نیروی انسانی'],['METHOD','روش/صلاحیت'],['MONEY','نقدینگی']]),input('ظرفیت / مقدار','capacity','8','number'),input('واحد','unit','ساعت')],'ثبت منبع محلی'));
}

function viewMemory(view){
 if(view==='outcomes')return card('نتایج واقعی و مشاهده‌شده',db.outcomes.length?table(['پرونده','نتیجه مشاهده‌شده','انحراف','منبع','زمان ثبت'],db.outcomes.map(o=>[esc(o.title),esc(o.actual),esc(o.variance),badge(o.data_class==='INTERNAL_VERIFIED'?'داخلی تأییدشده':'DEMO_SYNTHETIC',o.data_class==='INTERNAL_VERIFIED'?'good':'warn'),esc(o.createdAt)])):empty('نتیجه واقعی ثبت نشده است','ثبت نتیجه دمو مجاز است اما تا ارائه مدرک واقعی، outcome واقعی یا ارزش حفاظت‌شده محسوب نمی‌شود.','OUTCOME REQUIRED'))+card('ثبت نتیجه مشاهده‌شده',form('outcome',[select('تصمیم مرتبط','decision',[['','بدون پیوند تصمیم'],...db.decisions.map((d,i)=>[String(i),d.title+' — '+d.optionName])],false),input('عنوان نتیجه','title','نتیجه تصمیم'),input('مقدار/توضیح مشاهده‌شده','actual','شرح نتیجه واقعی یا دمو'),input('انحراف از انتظار','variance','تفاوت با پیش‌بینی'),input('منبع و مدرک','source','شناسه مدرک / منبع')],'ثبت نتیجه'));
 if(view==='lessons')return card('درس‌آموخته‌ها و قواعد پیشنهادی',db.lessons.length?table(['درس','دامنه','وضعیت','عملیات'],db.lessons.map((l,i)=>[esc(l.text),esc(l.scope),badge(l.status,l.status==='APPROVED'?'good':'warn'),button('تغییر وضعیت','lesson-status','secondary','data-index="'+i+'"')])):empty('درس‌آموخته ثبت نشده است','درس باید به تصمیم و نتیجه مرتبط باشد. قاعده پیشنهادی بدون بازبینی صریح، قانون الزام‌آور نمی‌شود.','NO LESSON YET'))+card('ثبت درس‌آموخته',form('lesson',[input('درس / فرضیه قابل آزمون','text','چه چیزی آموخته شد؟'),input('دامنه کاربرد','scope','کدام محصول / نوع مسئله؟'),select('وضعیت اولیه','status',[['PROPOSED','پیشنهادی'],['REVIEWED','بازبینی‌شده'],['APPROVED','تأییدشده'],['RETIRED','بازنشسته']])],'ثبت درس'));
 if(view==='indicators')return metrics([stat('تصمیم‌های ثبت‌شده',fa(db.decisions.length),'سابقه محلی','purple'),stat('نتایج ثبت‌شده',fa(db.outcomes.length),'واقعی بودن نیازمند مدرک','blue'),stat('درس‌آموخته‌ها',fa(db.lessons.length),'تأیید جداگانه لازم است','green'),stat('ارزش حفاظت‌شده','—','NOT YET VERIFIED','orange')])+card('خلاصه شاخص‌های کلان نمای مدیرعامل (DEMO_SYNTHETIC)',table(['شاخص کلان صفحه اصلی','مقدار نمایشی','پروژه‌های مرتبط','صفحه تخصصی مرتبط','عملیات'],[
   ['وضعیت نقدینگی','۲ مرحله در معرض تأخیر (≈ ۱,۱۸۰ میلیارد تومان)','P-1405، P-1398','منابع و ظرفیت ← نقدینگی',button('مشاهده نقدینگی','nav-direct','secondary','data-target-page="resources" data-target-view="cash"')],
   ['ظرفیت کلیدی','۱ محدودیت گلوگاهی (کسری ۶ ساعت ایستگاه آزمون)','P-1398','منابع و ظرفیت ← ظرفیت و بارگذاری',button('مشاهده ظرفیت','nav-direct','secondary','data-target-page="resources" data-target-view="capacity"')],
   ['وضعیت حاشیه پروژه‌ها','۲ پروژه در معرض کاهش حاشیه سود','P-1405، P-1398','نقشه ریسک ← زنجیره اثر',button('مشاهده اثر حاشیه','nav-direct','secondary','data-target-page="risk" data-target-view="impact"')],
   ['وضعیت تحویل مشتری','۳ تعهد تحویل در معرض خطر','P-1405، P-1398، P-1412','پروژه‌ها ← تعهدات',button('مشاهده تعهدات','nav-direct','secondary','data-target-page="projects" data-target-view="commitments"')]
 ]))+card('تفکیک شاخص‌ها و مرزبندی حقیقت داده',table(['مفهوم','معنا','وضعیت فعلی'],[['PLAN','خط مبنای مصوب','INTERNAL SOURCE REQUIRED'],['ACTUAL','واقعیت ثبت‌شده با مدرک','INTERNAL SOURCE REQUIRED'],['Value at Risk','ارزش بالقوه در معرض ریسک؛ نه زیان تحقق‌یافته','NOT YET QUANTIFIED'],['Realized Loss','زیان تحقق‌یافته مستند','NOT YET QUANTIFIED'],['Protected Value','اثر حفاظتی اثبات‌شده','NOT YET VERIFIED']].map(r=>[r[0],r[1],badge(r[2],'warn')])));
 if(view==='trend')return card('روند ارزش در معرض ریسک',empty('INSUFFICIENT HISTORY','نمودار روند فقط پس از وجود snapshotهای تاریخ‌دار معتبر و روش محاسبه ثابت نمایش داده می‌شود.','INSUFFICIENT HISTORY'));
 return card('حافظه تصمیم و بازسازی استدلال',db.decisions.length?table(['زمان','پرونده','گزینه','امکان‌پذیری','تصمیم‌گیر','دلیل','وضعیت'],db.decisions.map((d)=>[esc(d.createdAt||'نشست فعلی'),esc(d.title),esc(d.optionName),badge(d.feasibility||'ثبت دمو','warn'),esc(d.owner||'تعیین نشده'),esc(d.rationale||'ثبت نشده'),badge(d.status||'LOCAL DEMO','neutral')])):empty('حافظه تصمیم خالی است','ابتدا گزینه را ارزیابی و سپس تصمیم انسانی را ثبت کنید. استدلال، نتیجه ارزیابی و وضعیت اجرا باید حفظ شوند.','NO DECISION YET'))+card('ثبت تصمیم انسانی (دمو)',form('decision',[select('پرونده / سناریو','scenario',Object.keys(scenarios).map(k=>[k,scenarios[k].id+' · '+scenarios[k].title])),select('گزینه','option',Object.keys(scenarios).flatMap(k=>scenarios[k].options.map(o=>[k+'|'+o.id,scenarios[k].id+' · '+o.name]))),input('تصمیم‌گیر مسئول','owner','نقش/سمت مسئول'),input('دلیل و ریسک پذیرفته‌شده','rationale','مبنای انتخاب، شواهد و ریسک باقی‌مانده'),select('وضعیت ثبت','status',[['DECIDED','تصمیم ثبت شد'],['PENDING','نیازمند بررسی'],['REJECTED','رد شد']])],'ثبت تصمیم محلی'));
}

function viewSources(view){
 if(view==='provenance')return card('دفتر منشأ داده',table(['منبع','دامنه','طبقه','محدودیت','اقدام'],[[ '<a href="'+officialUrl+'" target="_blank" rel="noopener">کاتالوگ رسمی PARS</a>','نام مدل‌های محصول',badge('PUBLIC_VERIFIED','good'),'اثبات‌کننده پروژه/تعهد/مالی نیست','مرجع محصول'],['product-project-fixture.json','ساختار خانواده‌ها و مدل‌های نمونه',badge('DEMO / PUBLIC MIX','warn'),'تخصیص‌ها و روابط پروژه دمو هستند','مشاهده فایل'],['منابع داخلی SAP / P6 / MES','پروژه، تعهد، ظرفیت، واقعیات',badge('NOT CONNECTED','bad'),'به مالک و اتصال داخلی نیاز دارد','اتصال لازم'],['مالی و خزانه','نقدینگی، حاشیه، exposure',badge('NOT CONNECTED','bad'),'ارقام فعلاً NULL هستند','اتصال لازم'],...db.sources.map(src=>[esc(src.name),esc(src.url||'—'),provenance(src),esc(src.owner||'منبع محلی'),badge('LOCAL DEMO','warn')])]))+card('ثبت مرجع داده محلی',form('source',[input('نام منبع','name','نام سیستم / سند'),input('URL یا شناسه مرجع','url','https://…'),select('طبقه','class',[['PUBLIC_VERIFIED','مرجع عمومی'],['INTERNAL_VERIFIED','داده داخلی تأییدشده'],['USER_APPROVED_ASSUMPTION','فرض تأییدشده'],['DEMO_SYNTHETIC','دموی ساختگی'],['UNKNOWN','نامشخص']]),input('مالک و زمان اعتبار','owner','مالک داده / تاریخ')],'ثبت مرجع محلی'));
 if(view==='assumptions')return card('فرضیات و تأییدها',db.assumptions.length?table(['فرض','دامنه','تأییدکننده','وضعیت'],db.assumptions.map(a=>[esc(a.text),esc(a.scope),esc(a.owner),badge(a.status,'warn')])):empty('فرض تأییدشده‌ای ثبت نشده است','فرض‌های سناریو فقط در محیط دمو هستند. برای ارتقا به فرض تأییدشده، مالک و دامنه تأیید باید ثبت شوند.','NO APPROVED ASSUMPTIONS'))+card('ثبت فرضیه قابل تأیید',form('assumption',[input('شرح فرض','text','فرضیه صریح'),input('دامنه و محدودیت','scope','دامنه کاربرد'),input('مالک تأیید','owner','نقش/سمت'),select('وضعیت','status',[['PROPOSED','پیشنهادی'],['USER_APPROVED_ASSUMPTION','تأییدشده توسط کاربر']])],'ثبت فرض محلی'));
 if(view==='registry')return card('کاتالوگ منابع داده',table(['سیستم','مالکیت داده','داده مورد انتظار','وضعیت اتصال'],[['SAP PP / PM / MM','تراکنش و سفارش تولید','سفارش، BOM، موجودی، ظرفیت','NOT CONNECTED'],['SAP FI/CO / خزانه','واقعی مالی و نقدینگی','هزینه، پرداخت، جریان نقد','NOT CONNECTED'],['Primavera P6','برنامه و خط مبنا','فعالیت، وابستگی، موعد','NOT CONNECTED'],['MES / SCADA','واقعیات اجرا','توقف، تولید، وضعیت ماشین','NOT CONNECTED'],['تدارکات / تأمین‌کننده','تعهد تأمین','سفارش، موعد، رسید','NOT CONNECTED'],['قرارداد / CRM','تعهد مشتری','موعد قراردادی و تغییرات','NOT CONNECTED']].map(r=>[r[0],r[1],r[2],badge(r[3],'warn')])));
 if(view==='access')return card('نقش‌ها و مسئولیت‌های دسترسی',table(['نقش','مجاز به مشاهده','ثبت / تأیید','مرز اختیار'],[['کارشناس / مالک داده','موضوع و شواهد حوزه خود','ثبت issue و منبع','تأیید داده در حیطه مجاز'],['مدیر پروژه / مسئول تعهد','پروژه و تعهدات مرتبط','پیشنهاد گزینه و اقدام','تغییر تعهد فقط با مجوز'],['مالک منبع / برنامه‌ریزی','ظرفیت و تعارض منابع','تأیید ظرفیت و امکان‌پذیری','تخصیص منابع طبق اختیار'],['شورای مدیران','گزینه‌های شدنی و اثر','تصمیم و پذیرش ریسک','مسئولیت نهایی انسانی'],['مدیر سامانه','پیکربندی و دسترسی','تنظیم مدل / نقش','بدون تأیید خودکار تصمیم']]));
 function renderThemeLangCard() {
   const isEn = (currentLang === 'en');
   const themeLabel = currentTheme === 'factory' ? (isEn ? 'Factory Theme (Carbon & Amber)' : 'پوسته صنعتی کارخانه') : (currentTheme === 'dark' ? (isEn ? 'Dark Night Theme' : 'پوسته تاریک شب') : (isEn ? 'Light Corporate Theme' : 'پوسته روشن روز'));
   const langLabel = currentLang === 'en' ? 'English (LTR)' : 'فارسی (راست‌به‌چپ / RTL)';

   return card(isEn ? 'System Visual Theme & Language Preferences' : 'تنظیمات پوسته گرافیکی و زبان سامانه (Theme & Language)',
     '<div style="display:grid;gap:16px">' +
       '<div class="app-filter-row" style="background:#f4f8fc;padding:16px;border-radius:12px;border:1px solid #d5e4f2;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">' +
         '<div class="app-field">' +
           '<label style="display:flex;justify-content:space-between;align-items:center;font-weight:800;margin-bottom:8px">' +
             '<span>' + (isEn ? '🎨 Visual Theme Selection' : '🎨 انتخاب پوسته گرافیکی (Theme)') + '</span>' +
             badge(themeLabel, 'blue') +
           '</label>' +
           '<select id="themeSelectorSettings" onchange="window.pvptApplyTheme(this.value)" style="width:100%;padding:10px;font-weight:700;border-radius:8px;border:1px solid #c2d6ea;background:#fff">' +
             '<option value="light"' + (currentTheme==='light'?' selected':'') + '>' + (isEn ? '☀️ Light Corporate Theme (Executive Baseline)' : '☀️ پوسته روشن (پیش‌فرض اجرایی)') + '</option>' +
             '<option value="dark"' + (currentTheme==='dark'?' selected':'') + '>' + (isEn ? '🌙 Dark Night Operations Theme' : '🌙 پوسته تاریک (اتاق وضعیت شب)') + '</option>' +
             '<option value="factory"' + (currentTheme==='factory'?' selected':'') + '>' + (isEn ? '🏭 Industrial Factory Floor Theme (Carbon & Amber)' : '🏭 پوسته صنعتی کارخانه (کربن و امبر)') + '</option>' +
           '</select>' +
         '</div>' +
         '<div class="app-field">' +
           '<label style="display:flex;justify-content:space-between;align-items:center;font-weight:800;margin-bottom:8px">' +
             '<span>' + (isEn ? '🌐 Interface Language & Layout' : '🌐 انتخاب زبان و چیدمان (Language & Direction)') + '</span>' +
             badge(langLabel, 'good') +
           '</label>' +
           '<select id="langSelectorSettings" onchange="window.pvptApplyLanguage(this.value)" style="width:100%;padding:10px;font-weight:700;border-radius:8px;border:1px solid #c2d6ea;background:#fff">' +
             '<option value="fa"' + (currentLang==='fa'?' selected':'') + '>🇮🇷 فارسی — راست‌به‌چپ (RTL - Persian Executive)</option>' +
             '<option value="en"' + (currentLang==='en'?' selected':'') + '>🇬🇧 English — Left-to-Right (LTR - International)</option>' +
           '</select>' +
         '</div>' +
       '</div>' +

       '<div>' +
         '<h4 style="margin:0 0 10px;font-size:12px;font-weight:800">' + (isEn ? 'Direct Theme Tiles (1-Click Switch):' : 'انتخاب مستقیم پوسته گرافیکی با یک کلیک:') + '</h4>' +
         '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">' +
           '<div style="border:2px solid ' + (currentTheme==='light'?'#2878cf':'#e2ebf3') + ';background:#ffffff;border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">' +
             '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>' + (isEn ? 'Light Theme' : 'پوسته روشن') + '</strong>' + (currentTheme==='light'?badge(isEn?'Active':'فعال','good'):'') + '</div>' +
             '<p style="font-size:10.5px;color:#6b8094;margin:0 0 10px;line-height:1.7">' + (isEn ? 'Executive baseline daylight theme matching reference design.' : 'تم استاندارد مدیریتی مطابق با طراحی اصلی و پرتردد.') + '</p>' +
             button(isEn ? 'Activate Light Theme' : 'فعال‌سازی پوسته روشن', 'set-theme', currentTheme==='light'?'primary':'secondary', 'data-theme="light"') +
           '</div>' +
           '<div style="border:2px solid ' + (currentTheme==='dark'?'#2878cf':'#263b50') + ';background:#111e2d;color:#e2edf8;border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">' +
             '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="color:#e2edf8">' + (isEn ? 'Dark Theme' : 'پوسته تاریک') + '</strong>' + (currentTheme==='dark'?badge(isEn?'Active':'فعال','good'):'') + '</div>' +
             '<p style="font-size:10.5px;color:#8da6be;margin:0 0 10px;line-height:1.7">' + (isEn ? 'High-contrast dark palette for control rooms & low-light environments.' : 'پوسته تاریک با کنتراست بالا جهت اتاق‌های کنترل و پایش شبانه.') + '</p>' +
             button(isEn ? 'Activate Dark Theme' : 'فعال‌سازی پوسته تاریک', 'set-theme', currentTheme==='dark'?'primary':'secondary', 'data-theme="dark"') +
           '</div>' +
           '<div style="border:2px solid ' + (currentTheme==='factory'?'#f59e0b':'#30363d') + ';background:#161b22;color:#f3f4f6;border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">' +
             '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="color:#fbbf24">' + (isEn ? 'Factory Theme' : 'پوسته صنعتی کارخانه') + '</strong>' + (currentTheme==='factory'?badge(isEn?'Active':'فعال','good'):'') + '</div>' +
             '<p style="font-size:10.5px;color:#9ca3af;margin:0 0 10px;line-height:1.7">' + (isEn ? 'Industrial carbon with safety amber accents for shop-floor telemetries.' : 'پوسته صنعتی کربن تیره با المان‌های هشدار زرد کارخانه‌ای.') + '</p>' +
             button(isEn ? 'Activate Factory Theme' : 'فعال‌سازی پوسته کارخانه', 'set-theme', currentTheme==='factory'?'primary':'secondary', 'data-theme="factory"') +
           '</div>' +
         '</div>' +
       '</div>' +

       '<div>' +
         '<h4 style="margin:0 0 10px;font-size:12px;font-weight:800">' + (isEn ? 'Direct Language & Direction Switcher:' : 'انتخاب مستقیم زبان و جهت نمایش:') + '</h4>' +
         '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">' +
           '<div style="border:2px solid ' + (currentLang==='fa'?'#19a974':'#d6e5f2') + ';background:#ffffff;border-radius:10px;padding:12px">' +
             '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>🇮🇷 فارسی (Persian - RTL)</strong>' + (currentLang==='fa'?badge(isEn?'Active':'فعال','good'):'') + '</div>' +
             '<p style="font-size:10.5px;color:#6b8094;margin:0 0 10px;line-height:1.7">' + (isEn ? 'Native Persian right-to-left layout for MAPNA executive board.' : 'زبان پیش‌فرض فارسی با چیدمان راست‌به‌چپ، اعداد فارسی و فونت وزیرمتن.') + '</p>' +
             button('تغییر به فارسی (RTL)', 'set-lang', currentLang==='fa'?'primary':'secondary', 'data-lang="fa"') +
           '</div>' +
           '<div style="border:2px solid ' + (currentLang==='en'?'#19a974':'#d6e5f2') + ';background:#ffffff;border-radius:10px;padding:12px">' +
             '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>🇬🇧 English (LTR)</strong>' + (currentLang==='en'?badge(isEn?'Active':'فعال','good'):'') + '</div>' +
             '<p style="font-size:10.5px;color:#6b8094;margin:0 0 10px;line-height:1.7">' + (isEn ? 'English left-to-right interface with full metric and menu translations.' : 'چیدمان چپ‌به‌راست و ترجمه انگلیسی تمام منوها، جداول و شاخص‌ها.') + '</p>' +
             button('Switch to English (LTR)', 'set-lang', currentLang==='en'?'primary':'secondary', 'data-lang="en"') +
           '</div>' +
         '</div>' +
       '</div>' +
     '</div>'
   );
 }

 if(view==='config') {
   const isEn = (currentLang === 'en');
   return renderThemeLangCard() + card(isEn ? 'Model Governance & Hard Gate Architecture' : 'پیکربندی قواعد مدل و معماری دروازه‌های سخت', table(
     isEn ? ['Rule / Gate', 'Behavior & Constraint', 'Operational Status'] : ['قاعده / گیت', 'رفتار و قید', 'وضعیت فعلی'],
     isEn ? [
       ['Hard Gates', 'Dependency → Material → Machine → Manpower/Skill → Method → Cash', badge('Active in Demo Scenarios', 'good')],
       ['Feasibility Logic', 'FEASIBLE / PARTIALLY_FEASIBLE / NOT_FEASIBLE / UNKNOWN', badge('Verified Domain Engine', 'good')],
       ['Data Provenance', 'PUBLIC_VERIFIED / INTERNAL_VERIFIED / ASSUMPTION / DEMO', badge('Zero-Trust Labeling Active', 'good')],
       ['Cannibalization Guardrail', '100% Metallurgy Match + LRM Safety Margin Order Locked', badge('Zero-Trust Mandate Enforced', 'good')],
       ['No Feasible Option', 'Resource Crisis Escalation → Senior Executive Council', badge('Human Ownership Rule', 'good')]
     ] : [
       ['Hard gates', 'Dependency → Material → Machine → Manpower/Skill → Method → Cash', badge('فعال در سناریوهای محدود دمو', 'good')],
       ['Feasibility', 'FEASIBLE / PARTIALLY_FEASIBLE / NOT_FEASIBLE / UNKNOWN', badge('نمونه؛ تأیید عملیاتی لازم', 'good')],
       ['گاردریل کانبیلیزیشن', 'تطابق ۱۰۰٪ متالورژی + سفارش جبرانی در حاشیه ایمنی LRM', badge('دستورالعمل اجرایی مدیرعامل', 'good')],
       ['Data provenance', 'PUBLIC / INTERNAL / ASSUMPTION / DEMO / UNKNOWN', badge('نمایش برچسب‌ها فعال', 'good')],
       ['No feasible option', 'Resource crisis → escalate constraint change', badge('قاعده تصمیم انسانی', 'good')]
     ]
   ));
 }
 return renderThemeLangCard() + card('آمادگی داده و موانع اتصال · اطلاعات داخلی موردنیاز',metrics([stat('کاتالوگ عمومی','موجود','نام مدل‌های محصول','green'),stat('پروژه و تعهد واقعی','—','INTERNAL SOURCE REQUIRED','orange'),stat('ظرفیت و موجودی واقعی','—','INTERNAL SOURCE REQUIRED','orange'),stat('داده مالی معتبر','—','NOT YET QUANTIFIED','red')])+table(['دامنه','حداقل داده لازم','وضعیت'],[['پروژه','شناسه داخلی، محصول، مالک، منبع','داده لازم'],['تعهد','نوع، موعد مصوب، تغییر رسمی، منبع','داده لازم'],['منابع','ظرفیت زمان‌مند، تقویم، رزرو و outage','داده لازم'],['مالی','مبلغ، ارز، دوره، روش، منبع و تأیید','داده لازم'],['نتیجه','مشاهده واقعی، تاریخ، مدرک و پیوند تصمیم','داده لازم'],['اتصال منابع داخلی','SAP / P6 / MES / Finance','NOT CONNECTED']].map(r=>[r[0],r[1],badge(r[2],'warn')])));
}

function viewIssues(view){
  const f=db.activeFilter;
  const issuesList = (db.issues && db.issues.length) ? db.issues : ceoDetailedIssues;
  const filtered = f?.project ? issuesList.filter(x => x.project_id === f.project) : issuesList;

  if (view === 'active') {
    const activeOnly = filtered.filter(x => x.severity === 'CRITICAL' || x.severity === 'HIGH' || x.status === 'OPEN');
    return card('چالش‌های فعال و بحرانی نیازمند راهکار عاجل', activeOnly.length ? table([
      'شناسه','پروژه','عنوان چالش','دسته ۵M','شدت','VaR (م.ت)','هزینه WIP (م.ت/ماه)','COPQ (م.ت)','مهلت PNR','عملیات'
    ], activeOnly.map(x => [
      '<b>' + esc(x.id) + '</b>',
      '<b>' + esc(x.project_id) + '</b>',
      esc(x.title),
      badge(x.type_fa || x.type, 'neutral'),
      badge(x.severity === 'CRITICAL' ? 'بحرانی' : 'زیاد', x.severity === 'CRITICAL' ? 'bad' : 'warn'),
      fa(x.var_billion),
      fa(x.wip_cost_million),
      fa(x.copq_million),
      '<span style="color:#ed1c2e;font-weight:900">' + fa(x.days_to_pnr) + ' روز</span>',
      button('پیشنهاد راهکار 💡', 'propose-solution-for-issue', 'primary', 'data-issue-id="' + esc(x.id) + '" data-project-id="' + esc(x.project_id) + '"')
    ])) : empty('چالش فعال بحرانی یافت نشد', 'تمام چالش‌ها تعیین‌تکلیف شده‌اند یا بر اساس فیلتر موردی وجود ندارد.'));
  }

  if (view === 'bottlenecks') {
    const totalWip = issuesList.reduce((acc, i) => acc + (Number(i.wip_cost_million) || 0), 0);
    const totalCopq = issuesList.reduce((acc, i) => acc + (Number(i.copq_million) || 0), 0);
    const avgTreasuryLag = Math.round(issuesList.reduce((acc, i) => acc + (Number(i.treasury_lag_days) || 0), 0) / (issuesList.length || 1));

    return metrics([
      stat('هزینه ماندگار WIP کل', fa(totalWip) + ' م.ت/ماه', 'محاسبه با نرخ سرمایه ۳۶٪', 'red'),
      stat('هزینه عدم کیفیت (COPQ)', fa(totalCopq) + ' میلیون تومان', 'خسارت کیفیت و دوباره‌کاری', 'orange'),
      stat('اصطکاک و لَگ خزانه', fa(avgTreasuryLag) + ' روز', 'میانگین زمان تا تخصیص نقدینگی', 'purple'),
      stat('تحلیل ۵M', '۵ دسته اصلی', 'متریال، ماشین، نیرو، روش، مالی', 'blue')
    ]) + card('تحلیل تفکیکی گلوگاه‌های ۵M و اصطکاک خزانه', table([
      'دسته گلوگاه ۵M', 'چالش‌های مرتبط', 'جمع VaR در معرض خطر', 'هزینه ماندگار WIP', 'خسارت COPQ', 'تأخیر تخصیص خزانه', 'ارزیابی کنترل'
    ], [
      ['متریال و تأمین (Material)', 'تأخیر قطعه C-117 در P-1405', '۱,۲۰۰ میلیارد تومان', '۳۶ م.ت/ماه', '۱۲۰ م.ت', '۱۴ روز', badge('توقف خط - گاردریل کانبیلیزیشن', 'bad')],
      ['ماشین‌آلات و ایستگاه (Machine)', 'تعارض ظرفیت ایستگاه آزمون P-1398', '۸۵۰ میلیارد تومان', '۲۵.۵ م.ت/ماه', '۸۰ م.ت', '۲۱ روز', badge('تراکم صف FAT', 'bad')],
      ['روش و مهندسی (Method)', 'تغییر طراحی ناسل P-1412', '۶۰۰ میلیارد تومان', '۱۸ م.ت/ماه', '۱۵۰ م.ت', '۷ روز', badge('ارزیابی BOM و نقشه', 'warn')],
      ['نقدینگی و خزانه (Money / Treasury)', 'اصطکاک تخصیص نقدینگی P-1401', '۲۳۰ میلیارد تومان', '۶.۹ م.ت/ماه', '۴۰ م.ت', '۲۸ روز', badge('فاصله تأیید فنی تا پرداخت', 'warn')]
    ])) + card('قاعده حفاظت از ارزش و گاردریل کانبیلیزیشن (Guardrail Cannibalization)', '<div class="app-notice warn"><strong>دستورالعمل اجرایی مدیرعامل:</strong><br>۱. هیچ ادعای پیشرفت فیزیکی کاغذی بدون تأیید سه‌گانه کارگاهی (سند انبار + لوگ برق ماشین + تلمتری جرثقیل) پذیرفته نیست.<br>۲. جابه‌جایی و استقراض قطعه بین پروژه‌ها فقط در صورت تطابق ۱۰۰٪ گواهی متالورژی و ثبت سفارش جایگزین در حاشیه ایمنی LRM پروژه اهداکننده مجاز است.<br>۳. در بحران‌های ملی (قطع برق شبکه)، هزینه‌های دیزل/اضافه‌کاری اجباری در دفترچه فوریت‌های ملی ثبت می‌شود تا عملکرد کارخانه جریمه نشود.</div>');
  }

  if (view === 'register') {
    return card('ثبت چالش جدید در دفترچه چالش‌های اجرایی (ISSUE)', form('issue', [
      input('عنوان چالش / انحراف', 'title', 'مثلاً تأخیر قطعه استاتور یا اصطکاک خزانه'),
      input('شناسه پروژه مرتبط', 'project_id', 'P-1405'),
      select('دسته گلوگاه ۵M / مالی', 'type', [
        ['MATERIAL', 'متریال و قطعات (Material)'],
        ['MACHINE', 'ماشین‌آلات و ایستگاه کاری (Machine)'],
        ['MANPOWER', 'نیروی انسانی و مهارت (Manpower)'],
        ['METHOD', 'روش و انحراف طراحی (Method)'],
        ['TREASURY', 'نقدینگی و اصطکاک خزانه (Money/Treasury)'],
        ['COPQ', 'کیفیت و هزینه عدم کیفیت (COPQ)']
      ]),
      select('درجه شدت چالش', 'severity', [
        ['CRITICAL', 'بحرانی (CRITICAL)'],
        ['HIGH', 'زیاد (HIGH)'],
        ['MEDIUM', 'متوسط (MEDIUM)'],
        ['LOW', 'کم (LOW)']
      ]),
      input('ارزش در معرض خطر VaR (میلیارد تومان)', 'var_billion', '1200', 'number'),
      input('هزینه ماندگار WIP (میلیون تومان/ماه)', 'wip_cost_million', '36', 'number'),
      input('هزینه عدم کیفیت COPQ (میلیون تومان)', 'copq_million', '120', 'number'),
      input('تأخیر تخصیص خزانه (روز)', 'treasury_lag_days', '14', 'number'),
      input('مهلت تا نقطه غیرقابل بازگشت PNR (روز)', 'days_to_pnr', '5', 'number'),
      input('شرح چالش و شواهد سه‌گانه', 'description', 'شواهد سند انبار، لوگ برق و تلمتری جرثقیل', 'text')
    ], 'ثبت چالش در سامانه'));
  }

  const totalVar = issuesList.reduce((acc, i) => acc + (Number(i.var_billion) || 0), 0);
  const totalWip = issuesList.reduce((acc, i) => acc + (Number(i.wip_cost_million) || 0), 0);
  const totalCopq = issuesList.reduce((acc, i) => acc + (Number(i.copq_million) || 0), 0);

  return metrics([
    stat('تعداد چالش‌های باز', fa(issuesList.length) + ' مورد', 'چالش‌های فعال پروژه‌ها', 'red'),
    stat('جمع ارزش در معرض خطر VaR', fa(totalVar) + ' میلیارد تومان', 'ریسک مالی کل چالش‌ها', 'orange'),
    stat('هزینه ماندگار WIP', fa(totalWip) + ' م.ت/ماه', 'نرخ سرمایه ۳۶٪ سالانه', 'purple'),
    stat('خسارت عدم کیفیت COPQ', fa(totalCopq) + ' میلیون تومان', 'Cost of Poor Quality', 'blue')
  ]) + card('مدیریت چالش‌ها و انحرافات اجرایی (Issues List)', filtered.length ? table([
    'شناسه', 'پروژه', 'عنوان چالش', 'دسته ۵M', 'شدت', 'VaR (م.ت)', 'WIP Cost (م.ت/ماه)', 'COPQ (م.ت)', 'تأخیر خزانه', 'مهلت PNR', 'وضعیت', 'عملیات'
  ], filtered.map(x => [
    '<b>' + esc(x.id) + '</b>',
    '<b>' + esc(x.project_id) + '</b>',
    esc(x.title),
    badge(x.type_fa || x.type, 'neutral'),
    badge(x.severity === 'CRITICAL' ? 'بحرانی' : x.severity === 'HIGH' ? 'زیاد' : 'متوسط', x.severity === 'CRITICAL' ? 'bad' : x.severity === 'HIGH' ? 'warn' : 'neutral'),
    fa(x.var_billion),
    fa(x.wip_cost_million),
    fa(x.copq_million),
    fa(x.treasury_lag_days) + ' روز',
    '<span style="color:' + (x.days_to_pnr <= 12 ? '#ed1c2e' : '#173653') + ';font-weight:800">' + fa(x.days_to_pnr) + ' روز</span>',
    badge(x.status_fa || x.status, x.status === 'OPEN' ? 'bad' : 'good'),
    button('پیشنهاد راهکار 💡', 'propose-solution-for-issue', 'primary', 'data-issue-id="' + esc(x.id) + '" data-project-id="' + esc(x.project_id) + '"')
  ])) : empty('هیچ چالشی ثبت نشده است', 'می‌توانید از تب «ثبت چالش جدید» یک چالش جدید تعریف کنید.'));
}

function viewSolutions(view){
  const f=db.activeFilter;
  const solutionsList = (db.solutions && db.solutions.length) ? db.solutions : ceoDetailedSolutions;
  const filtered = f?.project ? solutionsList.filter(x => x.project_id === f.project) : solutionsList;

  if (view === 'pipeline') {
    const proposed = filtered.filter(x => x.status === 'PROPOSED' || x.status === 'UNDER_REVIEW');
    return card('صف بررسی و تصویب راهکارهای مدیریتی (CEO Solution Approval Pipeline)', proposed.length ? table([
      'شناسه راهکار', 'چالش مرتبط', 'پروژه', 'عنوان راهکار', 'نوع استراتژی', 'هزینه (م.ت)', 'زمان (روز)', 'ارزش حفاظت‌شده', 'وضعیت امکان‌پذیری', 'عملیات تصویب'
    ], proposed.map(x => [
      '<b>' + esc(x.id) + '</b>',
      esc(x.issue_id),
      '<b>' + esc(x.project_id) + '</b>',
      esc(x.title),
      badge(x.strategy_fa || x.strategy_type, 'blue'),
      fa(x.cost_million),
      fa(x.exec_days) + ' روز',
      '<b>' + fa(x.protected_var_billion) + ' میلیارد</b>',
      badge(x.feasibility_fa || x.feasibility, x.feasibility === 'FEASIBLE' ? 'good' : 'warn'),
      '<div style="display:flex;gap:4px">' +
        button('تصویب راهکار ✓', 'approve-solution', 'primary', 'data-solution-id="' + esc(x.id) + '"') + ' ' +
        button('رد ✕', 'reject-solution', 'danger', 'data-solution-id="' + esc(x.id) + '"') +
      '</div>'
    ])) : empty('راهکار جدیدی در صف بررسی وجود ندارد', 'همه راهکارهای پیشنهادی بررسی و تعیین‌تکلیف شده‌اند.'));
  }

  if (view === 'approved') {
    const approved = filtered.filter(x => x.status === 'APPROVED' || x.status === 'EXECUTING' || x.status === 'COMPLETED');
    return card('مصوبات فعال و راهکارهای در حال اجرا', approved.length ? table([
      'شناسه راهکار', 'پروژه', 'عنوان مصوبه', 'مسئول اجرا', 'تاریخ تصویب', 'هزینه اجرای مصوبه', 'زمان اجرا', 'ارزش حفاظت‌شده', 'وضعیت'
    ], approved.map(x => [
      '<b>' + esc(x.id) + '</b>',
      '<b>' + esc(x.project_id) + '</b>',
      esc(x.title),
      esc(x.owner),
      esc(x.approved_at),
      fa(x.cost_million) + ' م.ت',
      fa(x.exec_days) + ' روز',
      '<span style="color:#169c59;font-weight:900">' + fa(x.protected_var_billion) + ' میلیارد</span>',
      badge(x.status_fa || x.status, 'good')
    ])) : empty('مصوبه‌ای ثبت نشده است', 'راهکارهای تصویب‌شده در این بخش قرار می‌گیرند.'));
  }

  if (view === 'impact') {
    const totalProtected = solutionsList.reduce((acc, s) => acc + (Number(s.protected_var_billion) || 0), 0);
    const totalCost = solutionsList.reduce((acc, s) => acc + (Number(s.cost_million) || 0), 0);
    const totalSavedWip = solutionsList.reduce((acc, s) => acc + (Number(s.saved_wip_million) || 0), 0);
    const roiRatio = totalCost > 0 ? ((totalProtected * 1000) / totalCost).toFixed(1) : '—';

    return metrics([
      stat('ارزش کل حفاظت‌شده', fa(totalProtected) + ' میلیارد تومان', 'پتانسیل حفظ ارزش با مصوبات', 'green'),
      stat('جمع هزینه اجرای راهکارها', fa(totalCost) + ' میلیون تومان', 'هزینه افزوده عملیاتی', 'blue'),
      stat('صرفه‌جویی هزینه WIP', fa(totalSavedWip) + ' م.ت/ماه', 'کاهش خواب سرمایه در گردش', 'purple'),
      stat('نسبت کارایی مالی (ROI)', roiRatio + ' برابر', 'ارزش حفاظت‌شده نسبت به هزینه', 'orange')
    ]) + card('ارزیابی کارایی مالی و ارزش آفرینی راهکارها', table([
      'عنوان راهکار', 'پروژه', 'هزینه اجرای راهکار', 'ارزش حفاظت‌شده VaR', 'صرفه‌جویی هزینه WIP', 'نسبت بازدهی مالی', 'وضعیت'
    ], solutionsList.map(x => {
      const ratio = x.cost_million > 0 ? ((x.protected_var_billion * 1000) / x.cost_million).toFixed(1) : '—';
      return [
        esc(x.title),
        '<b>' + esc(x.project_id) + '</b>',
        fa(x.cost_million) + ' م.ت',
        fa(x.protected_var_billion) + ' میلیارد',
        fa(x.saved_wip_million) + ' م.ت/ماه',
        '<b>' + ratio + ' برابر</b>',
        badge(x.status_fa || x.status, x.status === 'APPROVED' ? 'good' : 'warn')
      ];
    })));
  }

  if (view === 'register') {
    return card('پیشنهاد راهکار جدید (SOLUTION)', form('solution', [
      input('عنوان راهکار پیشنهادی', 'title', 'مثلاً تأمین تسریع‌شده یا شیفت اضافه‌کاری'),
      input('شناسه چالش مرتبط (Issue ID)', 'issue_id', 'ISS-1405-01'),
      input('شناسه پروژه مرتبط', 'project_id', 'P-1405'),
      select('نوع استراتژی راهکار', 'strategy_type', [
        ['EXPEDITE_PROCUREMENT', 'خرید فوری و تسریع تأمین (Expedite)'],
        ['CAPACITY_OVERTIME', 'افزایش ظرفیت با اضافه‌کاری (Overtime)'],
        ['EXTERNAL_OUTSOURCING', 'آزمون و پیمانکاری بیرونی (Outsource)'],
        ['MATERIAL_BORROW', 'استقراض متریال بین پروژه‌ای (Borrow/Cannibalization)'],
        ['TREASURY_EXPEDITE', 'تسریع تخصیص نقدینگی خزانه (Treasury)'],
        ['EMERGENCY_OVERTIME', 'فوریت‌های ملی و شیفت اضطراری (Emergency)']
      ]),
      select('ارزیابی اولیه امکان‌پذیری', 'feasibility', [
        ['FEASIBLE', 'امکان‌پذیر و شدنی (FEASIBLE)'],
        ['CONDITIONAL', 'مشروط به تأیید مدارک/گواهی (CONDITIONAL)'],
        ['INFEASIBLE', 'ناشدنی (INFEASIBLE)']
      ]),
      input('هزینه اجرای راهکار (میلیون تومان)', 'cost_million', '180', 'number'),
      input('زمان اجرای راهکار (روز)', 'exec_days', '2', 'number'),
      input('ارزش حفاظت‌شده Protected VaR (میلیارد تومان)', 'protected_var_billion', '1200', 'number'),
      input('صرفه‌جویی هزینه WIP (میلیون تومان/ماه)', 'saved_wip_million', '36', 'number'),
      input('مسئول پیشنهادی اجرای راهکار', 'owner', 'مدیر پروژه P-1405 / مدیر کارخانه'),
      input('ملاحظات عدم کانبیلیزیشن و متالورژی', 'note', 'تطابق ۱۰۰٪ متالورژی و سفارش جایگزین در حاشیه ایمنی LRM', 'text')
    ], 'ارسال راهکار به صف بررسی و تصویب'));
  }

  const totalProtected = solutionsList.reduce((acc, s) => acc + (Number(s.protected_var_billion) || 0), 0);
  const approvedCount = solutionsList.filter(s => s.status === 'APPROVED' || s.status === 'EXECUTING').length;

  return metrics([
    stat('تعداد کل راهکارها', fa(solutionsList.length) + ' مورد', 'راهکارهای ثبت‌شده', 'blue'),
    stat('مصوبات فعال', fa(approvedCount) + ' مورد', 'مصوب مدیرعامل', 'green'),
    stat('ارزش کل حفاظت‌شده', fa(totalProtected) + ' میلیارد تومان', 'Protected Value', 'purple'),
    stat('وضعیت صف', fa(solutionsList.length - approvedCount) + ' در انتظار تصویب', 'نیازمند بررسی', 'orange')
  ]) + card('فهرست راهکارها و مصوبات اجرایی (Solutions Register)', filtered.length ? table([
    'شناسه', 'چالش مرتبط', 'پروژه', 'عنوان راهکار', 'نوع استراتژی', 'هزینه (م.ت)', 'زمان (روز)', 'ارزش حفاظت‌شده', 'امکان‌پذیری', 'وضعیت مصوبه', 'عملیات'
  ], filtered.map(x => [
    '<b>' + esc(x.id) + '</b>',
    esc(x.issue_id),
    '<b>' + esc(x.project_id) + '</b>',
    esc(x.title),
    badge(x.strategy_fa || x.strategy_type, 'blue'),
    fa(x.cost_million),
    fa(x.exec_days) + ' روز',
    '<b>' + fa(x.protected_var_billion) + ' میلیارد</b>',
    badge(x.feasibility_fa || x.feasibility, x.feasibility === 'FEASIBLE' ? 'good' : 'warn'),
    badge(x.status_fa || x.status, x.status === 'APPROVED' ? 'good' : 'warn'),
    x.status === 'PROPOSED' || x.status === 'UNDER_REVIEW' ?
      button('تصویب ✓', 'approve-solution', 'primary', 'data-solution-id="' + esc(x.id) + '"') :
      badge('مصوب', 'good')
  ])) : empty('راهکاری ثبت نشده است', 'از تب «پیشنهاد راهکار جدید» می‌توانید یک راهکار جدید ثبت کنید.'));
}

function contentFor(key,view){switch(key){case'home':return viewHome(view);case'portfolio':return viewPortfolio(view);case'projects':return viewProjects(view);case'issues':return viewIssues(view);case'solutions':return viewSolutions(view);case'risk':return viewRisk(view);case'interventions':return viewInterventions(view);case'resources':return viewResources(view);case'memory':return viewMemory(view);case'sources':return viewSources(view);case'decisions':return viewDecisions(view);default:return viewHome('overview');}}

function viewDecisions(view){
 if(view==='council')return card('شورای مدیران و تعهدات تصمیم', '<div class="app-notice">شورا فقط بین گزینه‌های feasible و دارای شواهد کافی انتخاب می‌کند. اگر هیچ گزینه‌ای شدنی نباشد، بحران منابع و تغییر قید باید escalated شود.</div>'+empty('پرونده واقعی آماده شورا وجود ندارد','سناریوهای DEMO فقط برای تمرین‌اند؛ تصمیم در آن‌ها مجوز تخصیص واقعی نیست.','INTERNAL SOURCE REQUIRED'));
 if(view==='register')return card('دفتر ثبت تصمیم',db.decisions.length?table(['پرونده','گزینه','مسئول','دلیل','وضعیت','اقدام'],db.decisions.map((d,i)=>[esc(d.title),esc(d.optionName),esc(d.owner),esc(d.rationale),badge(d.status,'warn'),button('حذف محلی','delete-decision','danger','data-index="'+i+'"')])):empty('تصمیمی ثبت نشده است','پرونده تصمیم فقط پس از ارزیابی امکان‌پذیری و تأیید انسانی ثبت می‌شود.'));
 if(view==='cases')return card('پرونده‌ها و گزینه‌های تصمیم (P-1405 و P-1398)','<div class="app-two-col">'+Object.keys(scenarios).map(k=>'<article class="app-case"><span class="app-eyebrow">'+scenarios[k].id+' · پروژه '+esc(scenarios[k].project_id)+' · DEMO SYNTHETIC</span><h3>'+esc(scenarios[k].title)+'</h3><p>'+esc(scenarios[k].need)+'</p><p>'+esc(scenarios[k].constraint)+'</p><div style="display:flex;gap:8px;flex-wrap:wrap">'+button('بازکردن پرونده و مقایسه','go-compare','primary','data-scenario="'+k+'"')+' '+button('ردیابی پروژه '+esc(scenarios[k].project_id),'filter-project','secondary','data-project="'+esc(scenarios[k].project_id)+'"')+'</div></article>').join('')+'</div>');
 return card('صف تصمیم ضروری (متصل به کارت «تصمیم‌های ضروری مدیریت» و «لیست تصمیم‌های ضروری»)', '<div class="app-notice warn">پرونده‌های زیر سناریوهای ساختگی‌اند (DEMO_SYNTHETIC) و به کارت‌های تصمیم صفحه اصلی متصل هستند.</div><div class="app-two-col">'+Object.keys(scenarios).map(k=>'<article class="app-case"><span class="app-eyebrow">'+scenarios[k].id+' · پروژه '+esc(scenarios[k].project_id)+' · DEMO</span><h3>'+esc(scenarios[k].title)+'</h3><p>'+esc(scenarios[k].need)+'</p><div style="display:flex;gap:8px;flex-wrap:wrap">'+button('ارزیابی گزینه‌ها','go-compare','primary','data-scenario="'+k+'"')+' '+button('بازکردن Decision Brief','legacy-detail','secondary','data-detail="'+(k==='part'?'1':'2')+'"')+' '+button('مشاهده پروژه '+esc(scenarios[k].project_id),'filter-project','secondary','data-project="'+esc(scenarios[k].project_id)+'"')+'</div></article>').join('')+'</div>'+empty('صف تصمیم‌های واقعی ERP دریافت نشده است','تصمیم مدیریتی واقعی فقط پس از شناسایی انحراف، بررسی گزینه‌های feasible و تعیین اختیار تصمیم ایجاد می‌شود.','INTERNAL SOURCE REQUIRED'));
}

function render(key,view){
 const container=$('#entityContent');if(!container)return;
 const safeView=(SUBS[key]||[]).some(s=>s[0]===view)?view:(SUBS[key]||[['overview']])[0][0];
 const title=(SUBS[key]||[]).find(s=>s[0]===safeView)?.[1]||LABELS[key];
 container.innerHTML=frame(key,safeView,title,'صفحه متصل به مدل داده مشترک · برچسب منشأ و محدودیت شواهد در تمام رکوردها حفظ می‌شود.',contentFor(key,safeView));
 container.dataset.appPage=key;container.dataset.appView=safeView;
 delete container.dataset.page;delete container.dataset.view;
 const page=$('#entityPage');if(page){page.classList.add('show');$('#homePage')?.classList.add('hide');}
 const t=$('#entityTitle');if(t)t.textContent=LABELS[key];
 const d=$('#entityDesc');if(d)d.textContent=db.activeFilter?.context||'صفحه متصل به مدل داده مشترک · برچسب منشأ و محدودیت شواهد در تمام رکوردها حفظ می‌شود.';
 const pt=$('#entityPanelTitle');if(pt)pt.textContent=title;
}

function appOpenPage(key,view,preserveFilter=false){
 if(!KEYS.includes(key))key='home';
 if(!preserveFilter)db.activeFilter=null;
 currentPage=key;currentView=view||(key==='home'?'overview':(SUBS[key]||[])[0]?.[0]);
 $$('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===key));
 if(key==='home'){
   const hp=$('#homePage'),ep=$('#entityPage');
   if(hp){hp.classList.remove('hide');}
   if(ep)ep.classList.remove('show');
   syncHomeKpis();
   return;
 }
 render(key,currentView);
}

function navigateFromHome(opts={}){
 const page=opts.page||'home';
 const view=opts.view||'';
 if(opts.scenario)db.selectedScenario=opts.scenario;
 if(opts.project)db.selectedProject=opts.project;
 db.activeFilter=(opts.project||opts.family||opts.status||opts.scenario||opts.context)?{
   project:opts.project||'',
   family:opts.family||'',
   status:opts.status||'',
   scenario:opts.scenario||'',
   context:opts.context||''
 }:null;
 appOpenPage(page,view,true);
}

function rerender(){const c=$('#entityContent');if(c&&c.dataset.appPage)render(c.dataset.appPage,c.dataset.appView);else appOpenPage('home','overview');}
function go(key,view,preserveFilter=false){appOpenPage(key,view,preserveFilter);}
function notify(title,detail){const el=document.createElement('div');el.className='app-toast';el.innerHTML='<strong>'+esc(title)+'</strong><span>'+esc(detail)+'</span>';document.body.appendChild(el);setTimeout(()=>el.remove(),2800);}

function submitForm(f){
 const fd=new FormData(f),v=Object.fromEntries(fd.entries()),type=f.dataset.form,stamp=new Date().toISOString();
 if(type==='issue'){
  if(!v.title || !v.title.trim()){notify('خطای ورودی','عنوان چالش الزامی است و نمی‌تواند خالی باشد.');return;}
  if('project_id' in v){
    if(!v.project_id || !v.project_id.trim()){notify('خطای ورودی','شناسه پروژه الزامی است.');return;}
    if(v.var_billion===undefined || v.var_billion==='' || isNaN(Number(v.var_billion))){notify('خطای ورودی','ارزش در معرض خطر (VaR) الزامی است و مقدار پیش‌فرض پذیرفته نمی‌شود.');return;}
    if(v.wip_cost_million===undefined || v.wip_cost_million==='' || isNaN(Number(v.wip_cost_million))){notify('خطای ورودی','هزینه ماندگار WIP الزامی است.');return;}
    if(v.copq_million===undefined || v.copq_million==='' || isNaN(Number(v.copq_million))){notify('خطای ورودی','هزینه عدم کیفیت COPQ الزامی است.');return;}
    if(v.treasury_lag_days===undefined || v.treasury_lag_days==='' || isNaN(Number(v.treasury_lag_days))){notify('خطای ورودی','تأخیر تخصیص نقدینگی خزانه الزامی است.');return;}
    if(v.days_to_pnr===undefined || v.days_to_pnr==='' || isNaN(Number(v.days_to_pnr))){notify('خطای ورودی','مهلت تا نقطه غیرقابل بازگشت (PNR) الزامی است.');return;}
  }

  const newIss={
    ...v,
    id: v.id ? v.id.trim() : ('ISS-' + Date.now().toString().slice(-4)),
    project_id: (v.project_id || (v.object ? v.object.split(' ')[0] : 'P-1405')).trim(),
    title: v.title.trim(),
    type: v.type || 'MATERIAL',
    type_fa: v.type === 'MATERIAL' ? 'متریال و قطعات' : v.type === 'MACHINE' ? 'ماشین‌آلات' : v.type === 'MANPOWER' ? 'نیروی انسانی' : v.type === 'METHOD' ? 'روش و انحراف طراحی' : 'نقدینگی و اصطکاک خزانه',
    object: v.object || v.title.trim(),
    severity: v.severity || 'HIGH',
    var_billion: Number(v.var_billion) || 0,
    wip_cost_million: Number(v.wip_cost_million) || 0,
    copq_million: Number(v.copq_million) || 0,
    treasury_lag_days: Number(v.treasury_lag_days) || 0,
    days_to_pnr: Number(v.days_to_pnr) || 30,
    status: 'OPEN',
    status_fa: 'باز / در دست پیگیری',
    description: v.description ? v.description.trim() : 'ثبت شده در سامانه PVPT (نیازمند شواهد سه‌گانه)',
    data_class: 'DEMO_SYNTHETIC',
    created_at: new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})
  };
  if (!db.issues) db.issues = [];
  db.issues.unshift(newIss);
  db.events.unshift({type:'issue',title:v.title,object:v.object||v.title,severity:v.severity,createdAt:stamp});
 }
 else if(type==='solution'){
   if(!v.title || !v.title.trim()){notify('خطای ورودی','عنوان راهکار پیشنهادی الزامی است.');return;}
   if(!v.issue_id || !v.issue_id.trim()){notify('خطای ورودی','شناسه چالش مرتبط (Issue ID) الزامی است.');return;}
   if(!v.project_id || !v.project_id.trim()){notify('خطای ورودی','شناسه پروژه مرتبط الزامی است.');return;}
   if(v.cost_million===undefined || v.cost_million==='' || isNaN(Number(v.cost_million))){notify('خطای ورودی','هزینه اجرای راهکار الزامی است.');return;}
   if(v.exec_days===undefined || v.exec_days==='' || isNaN(Number(v.exec_days))){notify('خطای ورودی','زمان اجرای راهکار الزامی است.');return;}
   if(v.protected_var_billion===undefined || v.protected_var_billion==='' || isNaN(Number(v.protected_var_billion))){notify('خطای ورودی','ارزش حفاظت‌شده الزامی است.');return;}
   if(v.saved_wip_million===undefined || v.saved_wip_million==='' || isNaN(Number(v.saved_wip_million))){notify('خطای ورودی','صرفه‌جویی هزینه WIP الزامی است.');return;}

   const newSol={
     id: v.id ? v.id.trim() : ('SOL-' + Date.now().toString().slice(-4)),
     issue_id: v.issue_id.trim(),
     project_id: v.project_id.trim(),
     title: v.title.trim(),
     strategy_type: v.strategy_type || 'EXPEDITE_PROCUREMENT',
     strategy_fa: v.strategy_type === 'EXPEDITE_PROCUREMENT' ? 'خرید فوری' : v.strategy_type === 'CAPACITY_OVERTIME' ? 'اضافه‌کاری' : v.strategy_type === 'MATERIAL_BORROW' ? 'استقراض متریال' : 'راهکار اجرایی',
     feasibility: v.feasibility || 'FEASIBLE',
     feasibility_fa: v.feasibility === 'FEASIBLE' ? 'امکان‌پذیر' : 'مشروط',
     cost_million: Number(v.cost_million),
     exec_days: Number(v.exec_days),
     protected_var_billion: Number(v.protected_var_billion),
     saved_wip_million: Number(v.saved_wip_million),
     status: 'PROPOSED',
     status_fa: 'در انتظار بررسی و تصویب',
     owner: v.owner ? v.owner.trim() : 'مدیر پروژه',
     approved_at: '—',
     note: v.note ? v.note.trim() : 'ثبت‌شده در صف بررسی راهکارها',
     cannibalization_checked: true,
     data_class: 'DEMO_SYNTHETIC'
   };
   if (!db.solutions || !db.solutions.length) db.solutions = [...ceoDetailedSolutions];
   db.solutions.unshift(newSol);
   db.events.unshift({type:'solution',title:v.title,createdAt:stamp});
 }
 else if(type==='resource'){const r={...v,id:'LOCAL-RES-'+Date.now(),resource_type:v.type,capacity:Number(v.capacity)||0,data_class:'DEMO_SYNTHETIC',createdAt:stamp};db.resources.unshift(r);db.catalogResources.unshift(r);catalog.resources.unshift(r);}
 else if(type==='decision'){
   const [sid,oid]=String(v.option).split('|');const scenario=scenarios[sid]||scenarios[v.scenario];const opt=(scenarios[sid]||scenarios[v.scenario]).options.find(o=>o.id===(oid||v.option));
   if(!opt){notify('ثبت نشد','گزینه انتخاب‌شده معتبر نیست.');return;}
   if(!opt.ok){notify('گزینه ناشدنی','ابتدا قید نقض‌شده باید اصلاح و دوباره ارزیابی شود.');return;}
   db.decisions.unshift({title:scenario.title,scenario:sid||v.scenario,optionId:opt.id,optionName:opt.name,owner:v.owner,rationale:v.rationale,status:v.status||'DECIDED',feasibility:'FEASIBLE · DEMO ONLY',data_class:'DEMO_SYNTHETIC',createdAt:stamp});
 }
 else if(type==='outcome'){db.outcomes.unshift({...v,data_class:'DEMO_SYNTHETIC',createdAt:stamp});}
 else if(type==='lesson'){db.lessons.unshift({...v,data_class:'DEMO_SYNTHETIC',createdAt:stamp});}
 else if(type==='assumption'){db.assumptions.unshift({...v,data_class:v.status==='USER_APPROVED_ASSUMPTION'?'USER_APPROVED_ASSUMPTION':'DEMO_SYNTHETIC',createdAt:stamp});}
 else if(type==='source'){const src={...v,id:'LOCAL-SOURCE-'+Date.now(),data_class:v.class,createdAt:stamp};db.sources.unshift(src);db.events.unshift({type:'source',title:v.name,source:v.url,class:v.class,owner:v.owner,createdAt:stamp});}
 else if(type==='project'){const p={project_id:v.id,project_name:v.name,family_id:v.family,data_class:'DEMO_SYNTHETIC',status:v.status};catalog.projects.unshift(p);db.projects.unshift(p);db.events.unshift({type:'project',title:v.name,createdAt:stamp});}
 else if(type==='commitment'){const c={commitment_id:v.id,project_id:v.project,type:'INTERNAL',label:v.name,due_day:Number(v.due)||null,data_class:'DEMO_SYNTHETIC'};catalog.commitments.unshift(c);db.commitments.unshift(c);}
 else if(type==='execution'){db.events.unshift({type:'execution',title:v.order+' · '+v.status,note:v.note,data_class:'DEMO_SYNTHETIC',createdAt:stamp});}
 else if(type==='supplier'){const sup={supplier_id:'LOCAL-'+Date.now(),name:v.name,part:v.part,date:v.date,data_class:'DEMO_SYNTHETIC'};catalog.suppliers.unshift(sup);db.suppliers.unshift(sup);}
 else if(type==='simulation'){
   const s=scenarios[v.scenario]||scenarios.part;const window=Number(v.window),budget=Number(v.budget),cap=Number(v.capacity);
   const opts=s.options.map(o=>({name:o.name,time:o.time,cost:o.cost,feasible:o.ok&&o.time<=window&&o.cost<=budget&&(v.scenario!=='capacity'||o.id!=='overtime'||cap>=6)}));
   const result=$('#simulation-result');if(result)result.innerHTML=card('نتیجه آزمون قیود',table(['گزینه','زمان','هزینه','نتیجه'],opts.map(o=>[esc(o.name),fa(o.time)+' روز',fa(o.cost)+' میلیون تومان',badge(o.feasible?'از نظر قیود ورودی قابل‌بررسی':'ناشدنی',''+(o.feasible?'good':'bad'))]))+'<p class="app-muted">آزمون فقط بر اساس ورودی‌های دموست؛ تأیید مالک منابع و تعهدات واقعی همچنان لازم است.</p>');notify('آزمون تمام شد','نتیجه محاسبه در صفحه نمایش داده شد.');return;}
 save();syncHomeKpis();rerender();notify('ثبت شد','رکورد در ذخیره‌سازی محلی همین مرورگر نگهداری شد.');
}

document.addEventListener('click',function(e){
 const chosen=e.target.closest('[data-select]');if(!chosen)return;
 const sid=chosen.dataset.select,opt=(scenarios[sid]||{}).options?.find(o=>o.id===chosen.dataset.option);
 if(!opt||!opt.ok)return;
 db.decisions.unshift({title:scenarios[sid].title,scenario:sid,optionId:opt.id,optionName:opt.name,owner:'مدیر مسئول (دمو)',rationale:'ثبت انتخاب از Decision Brief؛ تأیید مالک منبع و پیش‌شرط‌های عملیاتی هنوز لازم است.',status:'SELECTED DEMO',feasibility:'FEASIBLE · DEMO ONLY',data_class:'DEMO_SYNTHETIC',createdAt:new Date().toISOString()});
 save();syncHomeKpis();
},true);

document.addEventListener('click',function(e){
 const view=e.target.closest('[data-view]');if(view){e.preventDefault();e.stopImmediatePropagation();const key=view.closest('#homePage')?'home':($('#entityContent')?.dataset.appPage||'home');go(key,view.dataset.view,true);return;}
 const action=e.target.closest('[data-action]');if(!action)return;
 const a=action.dataset.action;
 if(a==='legacy-detail'){
   e.preventDefault();e.stopImmediatePropagation();
   const detailId = action.dataset.detail || '1';
   if(typeof openModal === 'function' && typeof decisionBrief === 'function'){
     openModal('Decision Brief · ' + (detailId === '1' ? 'DEMO-01 (P-1405)' : 'DEMO-02 (P-1398)'), decisionBrief(detailId));
   }
   return;
 }
 e.preventDefault();e.stopImmediatePropagation();
 if(a==='propose-solution-for-issue'){
   const issueId = action.dataset.issueId;
   const projId = action.dataset.projectId;
   go('solutions', 'register', true);
   setTimeout(() => {
     const issueInput = $('[name=issue_id]'); if (issueInput) issueInput.value = issueId;
     const projInput = $('[name=project_id]'); if (projInput) projInput.value = projId;
   }, 50);
   return;
 }
 if(a==='approve-solution'){
   const solId = action.dataset.solutionId;
   if (!db.solutions || !db.solutions.length) db.solutions = [...ceoDetailedSolutions];
   const s = db.solutions.find(x => x.id === solId);
   if (s) {
     s.status = 'APPROVED';
     s.status_fa = 'مصوب مدیرعامل / در حال اجرا';
     s.approved_at = new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
     save();
     syncHomeKpis();
     rerender();
     notify('تصویب شد ✓', 'راهکار ' + solId + ' با موفقیت به تصویب مدیرعامل رسید و ابلاغ شد.');
   }
   return;
 }
 if(a==='reject-solution'){
   const solId = action.dataset.solutionId;
   if (!db.solutions || !db.solutions.length) db.solutions = [...ceoDetailedSolutions];
   const s = db.solutions.find(x => x.id === solId);
   if (s) {
     s.status = 'REJECTED';
     s.status_fa = 'رد شد / نیازمند اصلاح';
     save();
     syncHomeKpis();
     rerender();
     notify('رد شد', 'راهکار ' + solId + ' جهت بازنگری و اصلاح عودت داده شد.');
   }
   return;
 }
 if(a==='clear-filter'){db.activeFilter=null;rerender();return;}
 if(a==='back-home'){db.activeFilter=null;go('home','overview');return;}
 if(a==='filter-project'){const pid=action.dataset.project;navigateFromHome({page:'projects',view:'projects',project:pid,context:'ردیابی یکپارچه پروژه '+pid});return;}
 if(a==='nav-direct'){navigateFromHome({page:action.dataset.targetPage,view:action.dataset.targetView,context:'مشاهده جزئیات شاخص کلان از صفحه دانش و تجربه'});return;}
 if(a==='go-interventions'){db.selectedScenario=action.dataset.scenario||'part';go('interventions','windows',true);return;}
 if(a==='go-compare'){db.selectedScenario=action.dataset.scenario||'part';go('interventions','compare',true);return;}
 if(a==='go-portfolio'){go('portfolio','catalog');return;}
 if(a==='family-filter'){navigateFromHome({page:'portfolio',view:'catalog',family:action.dataset.family,context:'فیلتر خانواده محصول: '+action.dataset.family});setTimeout(()=>{const f=$('[name=family]');if(f){f.value=action.dataset.family;f.dispatchEvent(new Event('change'));}},0);return;}
 if(a==='evaluate-option'){const s=scenarios[action.dataset.scenario],o=s?.options.find(x=>x.id===action.dataset.option);if(!s||!o)return;const result=$('#option-evaluation');if(result)result.innerHTML='<div class="app-evaluation-result '+(o.ok?'good':'bad')+'"><h4>'+esc(o.name)+' · '+(o.ok?'از نظر قیود نمونه قابل‌بررسی':'ناشدنی در وضعیت فعلی')+'</h4><p>'+esc(o.detail)+'</p><p>زمان: '+fa(o.time)+' روز · هزینه فرضی: '+fa(o.cost)+' میلیون تومان</p><p class="app-muted">این نتیجه فقط DEMO_SYNTHETIC است؛ پیش‌شرط‌های تأیید نشده، FEASIBLE عملیاتی محسوب نمی‌شوند.</p>'+(!o.ok?'<strong>اقدام بعدی: اصلاح قید/تعهد و ارزیابی مجدد؛ در نبود گزینه شدنی، ارجاع بحران منابع به شورای مدیران.</strong>':'<strong>پیش‌شرط‌ها: تأیید مالک منبع، کیفیت/صلاحیت و تعهدات متأثر.</strong>')+'</div>';return;}
 if(a==='product-detail'){const cardEl=action.closest('.app-product');const code=cardEl?.querySelector('code')?.textContent;const label=cardEl?.querySelector('strong')?.textContent;const p=catalog.products.find(x=>x.product_id===action.dataset.id)||catalog.products.find(x=>x.product_id===code)||catalog.products.find(x=>(x.name||x.model_code)===label);openInfo('جزئیات محصول',p?'<p><b>'+esc(p.name||p.model_code)+'</b></p><p>شناسه: '+esc(p.product_id)+'</p><p>خانواده: '+esc((catalog.families.find(f=>f.family_id===p.family_id)||{}).label_fa||'نامشخص')+'</p><p>طبقه داده: '+esc(p.data_class||p.source_status||'UNKNOWN')+'</p><p><a target="_blank" rel="noopener" href="'+esc(p.source_reference||p.source_url||officialUrl)+'">مرجع محصول</a></p>':'<p>شناسه محصول در کاتالوگ بارگذاری‌شده پیدا نشد.</p>');return;}
 if(a==='project-chain'){if(action.dataset.id)db.selectedProject=action.dataset.id;go('projects','chain',true);return;}
 if(a==='issue-detail'){const x=db.issues[Number(action.dataset.index)];if(x)openInfo('جزئیات ایشو',Object.entries(x).map(([k,v])=>'<p><b>'+esc(k)+'</b>: '+esc(v)+'</p>').join(''));return;}
  if(a==='set-theme'){
    window.pvptApplyTheme(action.dataset.theme);
    rerender();
    notify(currentLang==='en'?'Theme Updated':'پوسته تغییر یافت', action.dataset.theme==='factory'?(currentLang==='en'?'Factory Floor Theme Active':'پوسته صنعتی کارخانه فعال شد'):action.dataset.theme==='dark'?(currentLang==='en'?'Dark Night Theme Active':'پوسته تاریک شب فعال شد'):(currentLang==='en'?'Light Theme Active':'پوسته روشن فعال شد'));
    return;
  }
  if(a==='set-lang'){
    window.pvptApplyLanguage(action.dataset.lang);
    rerender();
    notify(action.dataset.lang==='en'?'Language Switched':'زبان تغییر یافت', action.dataset.lang==='en'?'English LTR Mode Active':'زبان فارسی (راست‌به‌چپ) فعال شد');
    return;
  }
  if(a==='set-home-proj-tab'){
    db.homeProjTab=action.dataset.tab||'all';
    $$('#homePage .home-proj-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===db.homeProjTab));
    renderHomeProjects();
    return;
  }
  if(a==='open-memory'){go('memory','decisions');return;}
  if(a==='delete-decision'){db.decisions.splice(Number(action.dataset.index),1);save();syncHomeKpis();rerender();notify('حذف شد','رکورد محلی حذف شد.');return;}
  if(a==='lesson-status'){const l=db.lessons[Number(action.dataset.index)];if(l){const order=['PROPOSED','REVIEWED','APPROVED','RETIRED'];l.status=order[(order.indexOf(l.status)+1)%order.length];save();rerender();}return;}
});
document.addEventListener('submit',function(e){const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();submitForm(f);},true);
function handleWorkbenchChange(e){
 if(e.target.matches('[name=productSearch],[name=family],[name=dataClass]')){const root=$('#product-results');if(!root)return;let ps=catalog.products.slice();const search=($('[name=productSearch]')?.value||'').toLowerCase();const fam=$('[name=family]')?.value||'';const cls=$('[name=dataClass]')?.value||'';ps=ps.filter(p=>(!search||String(p.name||p.model_code||'').toLowerCase().includes(search)||String(p.product_id).toLowerCase().includes(search))&&(!fam||p.family_id===fam)&&(!cls||(p.data_class||p.source_status)===cls));root.innerHTML=productGrid(ps);}
 if(e.target.matches('[name=proj1404Group],[name=proj1404Month],[name=proj1404Search]')){
   db.proj1404Group=$('[name=proj1404Group]')?.value||'';
   db.proj1404Month=$('[name=proj1404Month]')?.value||'';
   db.proj1404Search=$('[name=proj1404Search]')?.value||'';
   const focusName=e.target.name;
   const cursorPos=e.target.selectionStart;
   rerender();
   if(focusName==='proj1404Search'){const el=$('[name=proj1404Search]');if(el){el.focus();if(cursorPos!==null)el.setSelectionRange(cursorPos,cursorPos);}}
 }
 if(e.target.matches('[name=scenario]')&&$('#option-compare')){$('#option-compare').innerHTML=scenarioOptions(e.target.value);db.selectedScenario=e.target.value;save();}
}
document.addEventListener('change',handleWorkbenchChange,true);
document.addEventListener('input',handleWorkbenchChange,true);
function openInfo(title,body){const modal=$('#modal');if(!modal)return;$('#modalTitle').textContent=title;$('#modalBody').innerHTML='<div class="app-info-modal">'+body+'</div>';modal.classList.add('open');}
window.openPage=appOpenPage;
window.PVPT={render,go,db,navigateFromHome,getCatalog:()=>catalog,openProductDetail:(id)=>{const cardEl=$('[data-action="product-detail"][data-id="'+id+'"]')?.closest('.app-product');const code=cardEl?.querySelector('code')?.textContent;const label=cardEl?.querySelector('strong')?.textContent;const p=catalog.products.find(x=>x.product_id===id)||catalog.products.find(x=>x.product_id===code)||catalog.products.find(x=>(x.name||x.model_code)===label);openInfo('جزئیات محصول',p?'<p><b>'+esc(p.name||p.model_code)+'</b></p><p>شناسه: '+esc(p.product_id)+'</p><p>خانواده: '+esc((catalog.families.find(f=>f.family_id===p.family_id)||{}).label_fa||'نامشخص')+'</p><p>طبقه داده: '+esc(p.data_class||p.source_status||'UNKNOWN')+'</p><p><a target="_blank" rel="noopener" href="'+esc(p.source_reference||p.source_url||officialUrl)+'">مرجع محصول</a></p>':'<p>شناسه محصول در کاتالوگ بارگذاری‌شده پیدا نشد.</p>');}};

let currentTheme = localStorage.getItem('pvpt_theme') || 'light';
let currentLang = localStorage.getItem('pvpt_lang') || 'fa';

window.pvptApplyTheme = function(theme) {
  if (!['light', 'dark', 'factory'].includes(theme)) theme = 'light';
  currentTheme = theme;
  try { localStorage.setItem('pvpt_theme', theme); } catch(e){}
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  const sel = $('#themeSelectorSettings'); if (sel) sel.value = theme;
};

window.pvptApplyLanguage = function(lang) {
  if (!['fa', 'en'].includes(lang)) lang = 'fa';
  currentLang = lang;
  try { localStorage.setItem('pvpt_lang', lang); } catch(e){}
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
  document.body.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
  const sel = $('#langSelectorSettings'); if (sel) sel.value = lang;
  Object.assign(LABELS, lang === 'en' ? LABELS_EN : LABELS_FA);
  updateNavLanguage(lang);
  updateHomePageLanguage(lang);
  renderHomeIssuesAndSolutions();
};

function updateNavLanguage(lang) {
  const isEn = (lang === 'en');
  const dict = {
    home: isEn ? "Main Dashboard" : "صفحه اصلی",
    projects: isEn ? "Projects" : "پروژه‌ها",
    decisions: isEn ? "Management Decisions" : "تصمیم‌های مدیریتی",
    risk: isEn ? "Risk & Value Map" : "نقشه ریسک و ارزش",
    portfolio: isEn ? "Reports & Portfolio" : "گزارش‌ها و سبد محصول",
    issues: isEn ? "Issues" : "مدیریت چالش",
    solutions: isEn ? "Solutions" : "راهکارها",
    memory: isEn ? "Knowledge & Memory" : "دانش و تجربه",
    interventions: isEn ? "Intervention Windows" : "فرصت‌های مداخله",
    resources: isEn ? "Resources & Capacity" : "منابع و ظرفیت",
    sources: isEn ? "Settings & Data Provenance" : "تنظیمات و منشأ داده"
  };
  const icons = {
    home: '🏠', projects: '📋', decisions: '👥', risk: '🎯',
    portfolio: '📊', issues: '⚠️', solutions: '💡', memory: '🧠', interventions: '⚡', resources: '⚙️', sources: '🛡️'
  };
  $$('.nav').forEach(btn => {
    const key = btn.dataset.page;
    if (key && dict[key]) {
      btn.innerHTML = '<span class="ico">' + (icons[key]||'') + '</span>' + dict[key];
    }
  });
  const ceoB = $('.user b');
  if (ceoB) ceoB.textContent = isEn ? "CEO" : "مدیرعامل";
  const ceoSub = $('.user div div');
  if (ceoSub) ceoSub.textContent = isEn ? "MAPNA PARS GENERATOR" : "مبنا پارس ژنراتور";
  const slogan = $('.sidebar-slogan');
  if (slogan) slogan.innerHTML = isEn ? "Iranian Generators<br>For a Sustainable Future" : "ژنراتورهای ایرانی<br>برای آینده‌ای پایدار";
}

function updateHomePageLanguage(lang) {
  const isEn = (lang === 'en');

  // KPI 1: Value at Risk
  const kpi1Title = $('.kpi-var-highlight .kpi-head-title');
  if (kpi1Title) kpi1Title.textContent = isEn ? "Value at Risk (VaR)" : "ارزش در معرض خطر";
  $$('.kpi-var-highlight span').forEach(s => {
    if (s.textContent.includes('میلیارد تومان') || s.textContent.includes('Billion Tomans')) s.textContent = isEn ? "Billion Tomans" : "میلیارد تومان";
    if (s.textContent.includes('پروژه / تعهد') || s.textContent.includes('Projects/Commitments')) s.textContent = isEn ? "Projects/Commitments" : "پروژه / تعهد";
  });

  // KPI 2: Customer Commitments
  const kpi2Title = $('.kpi-orange-tint .kpi-head-title');
  if (kpi2Title) kpi2Title.textContent = isEn ? "Customer Commitments at Risk" : "تعهدات مشتری در معرض خطر";
  const kpi2Unit = $('.kpi-orange-tint .sub-unit');
  if (kpi2Unit) kpi2Unit.textContent = isEn ? "Projects" : "پروژه";

  // KPI 3: Delayed Cash
  const kpi3Title = $('.kpi-amber-tint .kpi-head-title');
  if (kpi3Title) kpi3Title.textContent = isEn ? "Delayed Cash Collection" : "نقدینگی در معرض تأخیر";
  $$('.kpi-amber-tint span').forEach(s => {
    if (s.textContent.includes('میلیارد تومان') || s.textContent.includes('Billion Tomans')) s.textContent = isEn ? "Billion Tomans" : "میلیارد تومان";
    if (s.textContent.includes('مرحله وصول') || s.textContent.includes('Milestones')) s.textContent = isEn ? "Milestones" : "مرحله وصول";
  });

  // KPI 4: Urgent Decisions
  const kpi4Title = $('.kpi-blue-tint .kpi-head-title');
  if (kpi4Title) kpi4Title.textContent = isEn ? "Urgent Management Decisions" : "تصمیم‌های ضروری مدیریت";
  const kpi4Unit = $('.kpi-blue-tint .sub-unit');
  if (kpi4Unit) kpi4Unit.textContent = isEn ? "Cases" : "مورد";

  // KPI 5: Near-Term Windows
  const kpi5Title = $('.kpi-purple-tint .kpi-head-title');
  if (kpi5Title) kpi5Title.textContent = isEn ? "Near-Term Intervention Windows" : "مهلت‌های مداخله نزدیک";
  $$('.kpi-purple-tint span').forEach(s => {
    if (s.textContent.includes('کمتر از ۵ روز') || s.textContent.includes('Under 5 Days')) s.textContent = isEn ? "Under 5 Days" : "کمتر از ۵ روز";
    if (s.textContent === 'مورد' || s.textContent === 'Windows') s.textContent = isEn ? "Windows" : "مورد";
  });

  // Risk Map Panel
  const riskH2 = document.querySelector('.risk-map-layout')?.closest('.panel')?.querySelector('.panel-head h2');
  if (riskH2) riskH2.textContent = isEn ? "Project Value & Risk Map" : "نقشه ارزش و ریسک پروژه‌ها";
  const riskLink = document.querySelector('.risk-map-layout')?.closest('.panel')?.querySelector('.link-btn');
  if (riskLink) riskLink.textContent = isEn ? "Map Analysis →" : "تحلیل نقشه ←";

  // SVG Chart Texts
  $$('.risk-chart text').forEach(t => {
    const txt = t.textContent.trim();
    if (txt === 'مداخله فوری' || txt === 'Urgent Action') t.textContent = isEn ? "Urgent Action" : "مداخله فوری";
    if (txt === 'پایش ویژه' || txt === 'Special Monitoring') t.textContent = isEn ? "Special Monitoring" : "پایش ویژه";
    if (txt === 'وضعیت قابل قبول' || txt === 'Acceptable Status') t.textContent = isEn ? "Acceptable Status" : "وضعیت قابل قبول";
    if (txt === 'ارزش در معرض خطر' || txt === 'Value at Risk') t.textContent = isEn ? "Value at Risk" : "ارزش در معرض خطر";
    if (txt === '(میلیارد تومان)' || txt === '(Billion Tomans)') t.textContent = isEn ? "(Billion Tomans)" : "(میلیارد تومان)";
    if (txt === 'زمان تا نقطه غیرقابل بازگشت (روز)' || txt === 'Days to Point of No Return (PNR)') t.textContent = isEn ? "Days to Point of No Return (PNR)" : "زمان تا نقطه غیرقابل بازگشت (روز)";
  });

  // Legend
  const legendRows = $$('.risk-legend-row');
  const legTransFa = ['بحرانی (مداخله فوری)', 'پرریسک (پایش ویژه)', 'نیازمند توجه', 'وضعیت قابل قبول'];
  const legTransEn = ['Critical (Urgent Action)', 'High Risk (Monitoring)', 'Needs Attention', 'Acceptable / Optimal'];
  legendRows.forEach((r, idx) => {
    const st = r.querySelector('strong');
    if (st && idx < 4) st.textContent = isEn ? legTransEn[idx] : legTransFa[idx];
  });

  // Middle Right Panel 1 (Decisions)
  const decPanelHead = document.querySelector('.right-stack .panel:nth-child(1) .panel-head');
  if (decPanelHead) {
    const h2 = decPanelHead.querySelector('h2');
    if (h2) h2.textContent = isEn ? "Urgent Management Decisions" : "تصمیم‌های ضروری مدیریت";
    const sub = decPanelHead.querySelector('.panel-sub');
    if (sub) sub.textContent = isEn ? "Cases Requiring Immediate CEO Action" : "پرونده‌های نیازمند اقدام فوری مدیرعامل";
    const link = decPanelHead.querySelector('.link-btn');
    if (link) link.textContent = isEn ? "Decision Queue →" : "صف تصمیم‌ها ←";
  }

  // Middle Right Panel 2 (Portfolio)
  const portPanelHead = document.querySelector('.right-stack .panel:nth-child(2) .panel-head');
  if (portPanelHead) {
    const h2 = portPanelHead.querySelector('h2');
    if (h2) h2.textContent = isEn ? "Strategic Product Portfolio" : "سبد محصولات راهبردی پارس";
    const sub = portPanelHead.querySelector('.panel-sub');
    if (sub) sub.textContent = isEn ? "Generator Families & Industrial Equipment" : "خانواده‌های ژنراتور و تجهیزات نیروگاهی";
    const link = portPanelHead.querySelector('.link-btn');
    if (link) link.textContent = isEn ? "Full Catalog →" : "کاتالوگ کامل ←";
  }

  // Bottom 3-column headers (preserving Decisions & Timeline, updating Projects panel cleanly)
  const decColHead = document.querySelector('.bottom-grid .decision-panel .panel-head h2');
  if (decColHead) decColHead.textContent = isEn ? "Urgent Management Decisions" : "لیست تصمیم‌های ضروری مدیریت";
  const projColHead = document.querySelector('.bottom-grid .project-panel .panel-head h2');
  if (projColHead) projColHead.textContent = isEn ? "Company 1404 Projects Schedule" : "پروژه‌های شرکت (برنامه سال ۱۴۰۴)";
  const projColBtn = document.querySelector('.bottom-grid .project-panel .panel-head .link-btn');
  if (projColBtn) projColBtn.textContent = isEn ? "All 1404 Tables →" : "مشاهده جداول کامل ❯";
  const latestColHead = document.querySelector('.bottom-grid .latest-panel .panel-head h2');
  if (latestColHead) latestColHead.textContent = isEn ? "Latest Key Developments" : "آخرین تحولات مهم";

  // Home project filter tab buttons
  const tabLabels = isEn
    ? { all: 'All (51)', generators: 'Generators (34)', busduct: 'Busduct (17)', macro: 'Macro Plan' }
    : { all: 'همه (۵۱)', generators: 'ژنراتورها (۳۴)', busduct: 'باسداکت (۱۷)', macro: 'برنامه کلان' };
  $$('#homePage .home-proj-tab').forEach(btn => {
    const t = btn.dataset.tab;
    if (t && tabLabels[t]) btn.textContent = tabLabels[t];
  });
  renderHomeProjects();

  // Bottom Issues & Solutions panel headers
  const issCardHead = document.querySelector('#homeIssuesListPanel')?.closest('.panel')?.querySelector('.panel-head h2');
  if (issCardHead) issCardHead.textContent = isEn ? "Latest Operational Issues & Bottlenecks" : "آخرین چالش‌ها و انحرافات اجرایی (Issues)";
  const issLink = document.querySelector('#homeIssuesListPanel')?.closest('.panel')?.querySelector('.link-btn');
  if (issLink) issLink.textContent = isEn ? "Issue Management →" : "مدیریت چالش‌ها ←";

  const solCardHead = document.querySelector('#homeSolutionsListPanel')?.closest('.panel')?.querySelector('.panel-head h2');
  if (solCardHead) solCardHead.textContent = isEn ? "Latest Executive Solutions & Approvals" : "آخرین راهکارها و مصوبات اجرایی (Solutions)";
  const solLink = document.querySelector('#homeSolutionsListPanel')?.closest('.panel')?.querySelector('.link-btn');
  if (solLink) solLink.textContent = isEn ? "Solutions & Approvals →" : "راهکارها و مصوبات ←";

  // Topbar demo pill
  const pill = $('.demo-pill');
  if (pill) pill.innerHTML = isEn ? '<i class="dot"></i> DEMO MODE · Synthetic Scenario' : '<i class="dot"></i> DEMO MODE · سناریوی نمایشی';

  // Clock
  const clk = $('.top-clock');
  if (clk) {
    clk.innerHTML = isEn ?
      '<span>Tuesday, Dec 17, 2024</span><span style="opacity:.45">|</span><span>10:25 AM</span>' :
      '<span>سه‌شنبه ۲۷ آذر ۱۴۰۳</span><span style="opacity:.45">|</span><span>10:25</span>';
  }

  // Footer
  const foot = $('#homePage .footer');
  if (foot) {
    const divs = foot.querySelectorAll('div');
    if (divs.length >= 2) {
      divs[0].textContent = isEn ?
        "PARS Value Protection Tower (PVPT) · Operational scenarios are synthetic (DEMO_SYNTHETIC)" :
        "سامانه برج هدایت و حفاظت از ارزش پارس (PVPT) · کلیه سناریوهای عملیاتی ساختگی (DEMO_SYNTHETIC) هستند";
      divs[1].textContent = isEn ? "CEO Evaluation Build v0.3" : "نسخه ارزیابی مدیرعامل v0.3";
    }
  }
}

loadFixture().then(() => {
  appOpenPage(currentPage, currentView);
  window.pvptApplyTheme(currentTheme);
  window.pvptApplyLanguage(currentLang);
});
})();
