import {test,expect} from '@playwright/test';
test('attachment scenarios independently verify deterministic routing and estimates',async({page})=>{
 await page.goto('/');
 await page.evaluate(()=>window.PVPT.ready);
 const result=await page.evaluate(()=>{
   const g=window.PVPTGovernance;
   const measures=[{value:400,medium:500,high:1000}];
   return [
     g.delay('machine',[72,24,1]),g.delay('specialist',[2,80,2]),g.delay('material',[2,5,0]),
     g.delay('machine',[72,0,1]),g.delay('material',[2,null,0]),g.windowDays(3,7),g.windowDays(7,3),
     g.route({action:'act',external:'yes',measures:[]}),g.route({action:'act',external:'no',measures}),
     g.route({action:'monitor',external:'no',measures:[]}),g.route({action:'act',external:'no',measures:[{value:null}]}),
     g.route({action:'act',external:'no',measures:[{value:500,medium:500,high:1000}]})
   ];
 });
 expect(result).toEqual([2,0,0,null,null,4,0,'committee','unit','monitor','review','senior']);
 await page.locator('[data-page=issues]').click();
 await page.locator('[data-view=register]').click();
 const capture=page.locator('form[data-form=mang07-case]');
 await capture.locator('[name=title]').fill('پرونده آموزشی ارجاع');
 await capture.locator('[name=resource]').selectOption('MACH-TEST-01');
 await capture.locator('[name=description]').fill('بررسی نیروی تخصصی');
 await capture.locator('button[type=submit]').click();
 const form=page.locator('form[data-form=mang07-routing]');
 await form.locator('[name=action]').selectOption('act');
 await form.locator('[name=external]').selectOption('yes');
 await form.locator('[name=currentDay]').fill('3');
 await form.locator('[name=cutoff]').fill('7');
 await form.locator('[name=routeOrigin]').fill('فرض صریح آزمون');
 await expect(page.locator('[data-pvpt-live-preview="mang07-routing"]')).toContainText('۴ روز');
 await form.locator('button[type=submit]').click();
 await expect(page.locator('summary').filter({hasText:'ارجاع پیشنهادی به کمیته'})).toBeVisible();
 const state=await (await page.request.get('/api/workspace')).json();
 expect(state.cases[0].routing[0]).toMatchObject({recommendation:'committee',window:4});
 expect(state.cases[0].decision).toBeNull();
});
