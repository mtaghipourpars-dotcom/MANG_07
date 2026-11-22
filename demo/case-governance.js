(function (global) {
 'use strict';
 const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
 function route({action, external, measures}) {
   if (action === 'monitor') return 'monitor';
   if (action !== 'act') return 'review';
   if (external === 'yes') return 'committee';
   if (measures.some(({value, high}) => valid(value) && valid(high) && value >= high)) return 'committee';
   if (external !== 'no' || measures.some(({value, high, medium}) =>
     !valid(value) || !valid(high) || !valid(medium) || medium >= high)) return 'review';
   return measures.some(({value, medium}) => value >= medium) ? 'senior' : 'unit';
 }
 function windowDays(today, cutoff) {
   return valid(today) && valid(cutoff) ? Math.max(0, cutoff - today) : null;
 }
 function priorLessons(cases, current) {
   return cases.filter(item => item.id !== current.id && item.resource === current.resource)
     .flatMap(item => (item.lessons || []).filter(lesson => (item.outcomes || []).some(outcome =>
       outcome.id === lesson.outcomeId && outcome.decisionId === lesson.decisionId
     )).map(lesson => ({item, lesson})));
 }
 const delayModels = {
   machine: {label:'ماشین',fields:['توقف در ساعات کاری','ساعت کار در روز','شناوری مسیر (روز)'],formula:'توقف ÷ ساعت کاری روز − شناوری',calculate:(a,b,c)=>b>0?a/b-c:null},
   material: {label:'متریال',fields:['تأخیر تأمین (روز)','پوشش موجودی (روز)','شناوری مسیر (روز)'],formula:'تأخیر تأمین − پوشش موجودی − شناوری',calculate:(a,b,c)=>a-b-c},
   specialist: {label:'متخصص',fields:['فعالیت وابسته (روز)','دسترسی مهارت جایگزین (درصد)','شناوری مسیر (روز)'],formula:'روز فعالیت × (۱ − درصد دسترسی ÷ ۱۰۰) − شناوری',calculate:(a,b,c)=>b<=100?a*(1-b/100)-c:null},
   process: {label:'فرایند ویژه',fields:['بازاعتبارسنجی (روز)','شناوری مسیر (روز)'],formula:'بازاعتبارسنجی − شناوری',calculate:(a,b)=>a-b}
 };
 function delay(kind, values) {
   const model=delayModels[kind];
   if(!model||values.length!==model.fields.length||!values.every(valid))return null;
   const result=model.calculate(...values);
   return result===null?null:Math.max(0,result);
 }
 global.PVPTGovernance = {route, windowDays, priorLessons, delayModels, delay};
})(globalThis);
